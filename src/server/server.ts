/*
 * Webserver implementation, wrapped around a generic game engine.
 */

import * as P from 'protocol/protocol.ts'
import * as wscode from 'protocol/code.ts'
import { Engine } from 'protocol/engine.ts'

import * as db from 'server/db.ts'
import * as Session from 'server/session.ts'

import { o_map } from 'utils/array.ts'
import { isOK, isErr } from 'utils/result.ts'

import * as WebSocket from 'ws'
import * as http from 'http'
import * as net from 'net'
import * as uuid from 'uuid'

import * as options from 'options.ts'
import assert from 'utils/assert.ts'
import log from 'utils/logger.ts'

export type GameId = string;
export type Principal = Session.Id;


class Client {
  principal: Principal;
  user: P.User | null;
  sync: boolean;
  socket: WebSocket;
  pingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    principal: Principal,
    socket: WebSocket,
  ) {
    this.principal = principal;
    this.user = null;
    this.sync = false;
    this.socket = socket;
    this.resetPingTimer();
  }

  resetPingTimer(): void {
    if (this.pingTimer !== null) {
      clearTimeout(this.pingTimer);
    }
    this.pingTimer = setTimeout(() => this.ping(), options.ping_interval);
  }

  ping(): void {
    this.socket.ping();
    this.resetPingTimer();
  }

  send(msg: string): void {
    this.socket.send(msg);
    this.resetPingTimer();
  }

  close(): void {
    this.socket.close(wscode.DONE);
  }

  log_entry() {
    return {
      session: this.principal,
      uid: this.user?.id ?? null,
      nick: this.user?.nick ?? '<unknown>',
    };
  }
};

/*
 * the server-side protocol monkey
 *
 * this manages the network communication w/ the clients and shovels updates
 * into the game engine as appropriate.
 */
class Game<
  Config,
  Intent,
  State,
  Action,
  ClientState,
  Effect,
  UpdateError,
  Eng extends Engine<
    Config,
    Intent,
    State,
    Action,
    ClientState,
    Effect,
    UpdateError
  >
> {
  id: GameId;
  engine: Eng;
  config: Config;
  owner: Principal;
  state: State;

  // currently connected clients; possibly more than 1 per principal
  clients: Client[] = [];

  // user corresponding to each principal we've seen; guaranteed to alias the
  // `user` field of each Client of said principal
  users: Record<Principal, P.User> = {};

  // next user id to allocate
  next_uid: number = 0;

  // shared with GameServer
  participation: Record<Principal, Set<GameId>>;

  // setTimeout() result for expiring this game
  expiry_timer: null | ReturnType<typeof setTimeout> = null;

  // true if destruction has been triggered and this game is no longer
  // responding to clients
  zombie: boolean = false;

  /*
   * start a new game w/ no players
   *
   * the principal identifies the player who will be marked as the game owner
   * once they join
   */
  constructor(
    id: GameId,
    engine: Eng,
    config: Config,
    owner: Principal,
    participation: Record<Principal, Set<GameId>>,
    destroy: () => Promise<void>,
    state?: State,
    users?: Record<Principal, P.User>,
  ) {
    this.id = id;
    this.engine = engine;
    this.config = config;
    this.owner = owner;
    this.participation = participation;
    this.destroy = this.destroy.bind(this, destroy);
    this.state = state ?? this.engine.init(config);
    this.users = users ?? {};

    this.reset_expiry();
  }

  /*
   * mark a new update and reset the expiry timer
   */
  private reset_expiry() {
    if (this.expiry_timer !== null) {
      clearTimeout(this.expiry_timer);
    }
    this.expiry_timer = setTimeout(this.destroy, options.game_expiry);
  }

  /////////////////////////////////////////////////////////////////////////////

  /*
   * process a hello message from a client
   *
   * this marks them as present but not yet synchronized; they won't receive
   * updates until they ask for a reset
   */
  hello(source: Client, nick: string): void {
    const sid = source.principal;
    const known = sid in this.users;

    if (!known) {
      // new principal; conjure a user object for them
      this.users[sid] = {
        id: this.next_uid++,
        nick: nick,
      };
    }
    // this is relevant if either (a) the user changed their nick in another
    // game before they reconnected, or (b) this game was freshly loaded from a
    // snapshot
    this.users[sid].nick = nick;

    source.user = this.users[sid];

    // help the game server track the games each principal belongs to
    //
    // we do this unconditionally because (a) the known users might have been
    // retrieved from a snapshot, and this might be the first time the client
    // has said hello in this instance of the server, and (b) we remove users
    // when their last client disconnects, so we potentially need to add them
    // back.
    this.participation[sid] = this.participation[sid] ?? new Set();
    this.participation[sid].add(this.id);

    log.info('client hello', {
      ...source.log_entry(),
      game: this.id,
      rejoin: known,
    });

    source.send(JSON.stringify(
      P.Hello.encode({
        verb: "hello",
        you: source.user,
      })
    ));

    this.broadcast(source, {
      verb: known ? "user:rejoin" : "user:join",
      who: source.user,
    });
  }

  /*
   * process an update request from a client
   *
   * the response will be marked w/ the transaction id provided here; either as
   * an update messsage after we handle the update or as a reject message
   *
   * this function also handles translated protocol action broadcasts
   */
  update(source: Client, tx: P.TxID, intent: Intent) {
    const result = this.engine.larp(
      this.state,
      intent,
      source.user,
      Object.values(this.users),
    );

    if (isErr(result)) {
      if (!source.sync) return;

      const UpdateReject = P.UpdateReject(this.engine.UpdateError);

      source.send(JSON.stringify(
        UpdateReject.encode({
          verb: "reject",
          tx: tx,
          reason: result.err,
        })
      ));
      return;
    }
    const [state, effects] = result.ok;

    this.state = state;
    this.reset_expiry();

    for (let client of this.clients) {
      if (!client.sync) continue;
      if (!(client.user.id in effects)) continue;

      const for_tx = client === source ? tx : null;

      const Update = P.Update(this.engine.Effect(this.state));

      client.send(JSON.stringify(
        Update.encode({
          verb: "update",
          tx: for_tx,
          command: {
            kind: "engine",
            effect: effects[client.user.id],
          },
        })
      ));
    }
  }

  /*
   * process a reset request from a client; we simply need to forward that
   * client's state
   */
  reset(client: Client) {
    const cs = this.engine.redact(this.state, client.user);

    const Reset = P.Reset(this.engine.ClientState);

    client.send(JSON.stringify(
      Reset.encode({
        verb: "reset",
        state: cs,
        who: Object.values(this.users),
      })
    ));
    client.sync = true;
  }

  /*
   * after we are finished w/ a client session, close their socket and remove
   * them from the list of clients, and notify all clients appropriately
   */
  dispose(victim: Client) {
    const sid = victim.principal;

    // remove the victim client
    victim.sync = false;
    victim.close();
    this.clients.splice(this.clients.indexOf(victim), 1);

    log.info('client dispose', {
      ...victim.log_entry(),
      game: this.id,
    });

    // if `victim` was the last client for a principal, mark that they're no
    // longer participating in this game
    if (!this.clients.find(cl => cl.principal === sid)) {
      this.participation[sid].delete(this.id);
    }

    // if no user was assigned yet, there's no reason to broadcast a part
    if (victim.user === null) return;

    // broadcast the part.  de-syncing the victim above prevents us from
    // attempting to send messages over the closed socket.
    this.broadcast(victim, {
      verb: "user:part",
      id: victim.user.id,
    });
  }

  /*
   * process a bye request from a client: simply reply 'bye' and disconnect
   */
  bye(client: Client, reason: null | string = null) {
    client.send(JSON.stringify(
      P.Bye.encode({
        verb: "bye",
        reason,
      })
    ));
    this.dispose(client);
  }

  /*
   * kick a naughty client by sending them 'bye' and disconnecting
   */
  kick(client: Client, reason: string) {
    log.info('kick', {
      ...client.log_entry(),
      game: this.id,
      reason
    });
    this.bye(client, reason);
  }

  /*
   * register and broadcast a nickname change for the user of `principal`
   */
  rename(principal: Principal, nick: string) {
    const user = this.users[principal] ?? null;
    if (user === null) return;

    user.nick = nick;

    const source = this.clients.find(cl => cl.principal === principal);
    if (!source) return;

    this.broadcast(source, {
      verb: "user:nick",
      who: user,
    });
  }

  /*
   * broadcast a protocol action, including any associated engine effect
   */
  broadcast(source: Client, pa: P.ProtocolAction) {
    const Update = P.Update(this.engine.Effect(this.state));

    const update = JSON.stringify(
      Update.encode({
        verb: "update",
        tx: null,
        command: {
          kind: "protocol",
          effect: pa,
        },
      })
    );

    for (let client of this.clients) {
      if (!client.sync) continue;
      client.send(update);
    }

    // engine action follows protocol action
    const intent = this.engine.translate(this.state, pa, source.user);
    if (intent !== null) this.update(source, null, intent);
  }

  /*
   * handle a new connection for the given session and websocket
   *
   * the game takes ownership of the websocket at this point
   */
  connect(session: Session.T, sock: WebSocket) {
    if (this.zombie) return;

    const client = new Client(session.id, sock);
    this.clients.push(client);

    // check the active games limit.  we do this after setting up the client
    // because this.kick() assumes the client has been materialized in our data
    // structures.
    if (this.participation[session.id]?.size >= options.max_games) {
      return this.kick(
        client,
        `limit ${options.max_games} concurrent games`,
      );
    }

    sock.on('message', (data: string) => {
      const d = JSON.parse(data);
      const ClientMessage = P.ClientMessage(this.engine.Intent(this.state));

      P.on_decode(ClientMessage, d, msg => {
        switch (msg.verb) {
          case "req:bye": this.bye(client); break;
          case "req:hello": this.hello(client, msg.nick); break;
          case "req:reset": this.reset(client); break
          case "req:update": this.update(client, msg.tx, msg.intent); break;
        }
      }, (e: any) => {
        log.error('failed to decode client message', {
          ...client.log_entry(),
          game: this.id,
          msg: d,
          draw: P.draw_error(e),
        });
        this.kick(client, 'invalid msg');
      });
    });

    sock.on('close', (code: number, reason: string) => {
      log.info('socket close', {code, reason, ...client.log_entry()});
      if (code !== wscode.DONE) this.dispose(client);
    });
  }

  /*
   * write state into persistent storage
   */
  async snapshot() {
    const config = this.engine.Config.encode(this.config);
    const state = this.engine.State.encode(this.state);

    try {
      await db.pool.query(
        'INSERT INTO games (id, config, owner, state, ts) ' +
        'VALUES ($1, $2, $3, $4, NOW()) ' +
        'ON CONFLICT (id) DO ' +
        'UPDATE SET config = $2, owner = $3, state = $4, ts = NOW()',
        [this.id, config, this.owner, state]
      );
    } catch (err) {
      log.error('snapshot failed (games): ', err);
      return;
    }

    try {
      const user_rows = o_map(
        this.users,
        (principal, user) => [this.id, principal, user.id, user.nick]
      );
      if (user_rows.length > 0) {
        await db.pool.query(db.format(
          'INSERT INTO participation (game, principal, uid, nick) VALUES %L ' +
          'ON CONFLICT DO NOTHING',
          user_rows,
        ));
      }
    } catch (err) {
      log.error('snapshot failed (participation): ', err);
      return;
    }
  }

  /*
   * terminate this game
   */
  async destroy(callback: () => Promise<void>) {
    this.zombie = true;

    if (this.expiry_timer !== null) {
      clearTimeout(this.expiry_timer);
    }
    while (this.clients.length > 0) {
      // we can't just iterate this.clients because client disposal involves
      // removing the client from the array
      this.bye(this.clients[0]);
    }
    return callback();
  }
}

/*
 * a websocket server that can handle multiple games for a given engine
 */
export class GameServer<
  Config,
  Intent,
  State,
  Action,
  ClientState,
  Effect,
  UpdateError,
  Eng extends Engine<
    Config,
    Intent,
    State,
    Action,
    ClientState,
    Effect,
    UpdateError
  >
> {
  engine: Eng;
  ws: WebSocket.Server;

  games: Record<
    GameId,
    Game<Config, Intent, State, Action, ClientState, Effect, UpdateError, Eng>
  > = {};

  // all the games a given principal is a part of
  participation: Record<Principal, Set<GameId>> = {};

  /*
   * attach to the provided http server to handle upgrade requests
   */
  constructor(engine: Eng, server: http.Server, url_pref: string) {
    this.engine = engine;
    this.ws = new WebSocket.Server({noServer: true});

    server.on('upgrade', async (
      req: http.IncomingMessage,
      sock: net.Socket,
      head: Buffer,
    ) => {
      const bail = (reason: string, details?: object) => {
        log.error('websocket upgrade failure', {...details, reason});

        this.ws.handleUpgrade(req, sock, head, async (ws: WebSocket) => {
          ws.close(wscode.REJECT, reason);
        });
      };

      // is the url cromulent
      const matches = req.url.match(`^\/${url_pref}\/([^\\\/]*)\/$`);
      if (matches === null) {
        return bail('invalid uri', {uri: req.url});
      }

      // is the game a real thing
      const game_id = matches[1];
      const game = await this.fetch_game(game_id);
      if (game === null) {
        return bail(`no such game: ${game_id}`, {game: game_id});
      }

      // is this someone we know about
      let id: string | null = null;
      let token: string | null = null;

      for (let c of req.headers.cookie.split(';')) {
        // sketchy cookie parsing let's gooooo
        const matches = c.trim().match(/^([^=]*)=([^=]*)$/);
        if (matches === null || matches.length !== 3) {
          continue;
        } else if (matches[1] === "id") {
          id = matches[2];
        } else if (matches[1] === "token") {
          token = matches[2];
        }
      }

      if (id === null || token === null) {
        return bail("no principal provided (log in first)");
      }

      const session = await Session.get(id);
      if (session === null) {
        return bail(`no such session: ${id}`, {id});
      }

      if (token !== session.token) {
        return bail(`invalid token: ${token}`, {token});
      }

      this.ws.handleUpgrade(req, sock, head, async (ws: WebSocket) => {
        this.ws.emit('connection', ws, req, game, session);
      });
    });

    this.ws.on('connection', (
      ws: WebSocket,
      req: http.IncomingMessage,
      game: Game<Config, Intent, State, Action,
                 ClientState, Effect, UpdateError, Eng>,
      session: Session.T
    ) => {
      return game.connect(session, ws);
    });
  }

  /*
   * make a new room for a game with the given owner
   *
   * returns the game id
   */
  begin_game(cfg: Config, owner: Principal): GameId {
    const id = uuid.v4();

    this.games[id] = new Game(
      id,
      this.engine,
      cfg,
      owner,
      this.participation,
      async () => await this.delete_game(id),
    );
    return id;
  }

  /*
   * obtain a game, possibly deserializing it from a snapshot
   */
  async fetch_game(id: GameId): Promise<null | Game<
    Config, Intent, State, Action,
    ClientState, Effect, UpdateError, Eng
  >> {
    if (id in this.games) return this.games[id];

    const games_res = await (async () => {
      try {
        return await db.pool.query('SELECT * FROM games WHERE id = $1', [id]);
      } catch (err) {
        log.error('snapshot retrieval failed (games): ', err);
      }
      return null;
    })();
    if (games_res === null) return null;

    if (games_res.rows.length !== 1) return null;
    const row = games_res.rows[0];

    const config = P.on_decode(
      this.engine.Config, row.config,
      (config: Config) => config,
      (e: any) => {
        log.error('snapshot decode failed', {
          game: id,
          draw: P.draw_error(e),
          column: 'config',
        });
        return null;
      }
    );
    if (config === null) return null;

    const state = P.on_decode(
      this.engine.State, row.state,
      (state: State) => state,
      (e: any) => {
        log.error('snapshot decode failed', {
          game: id,
          draw: P.draw_error(e),
          column: 'state',
        });
        return null;
      }
    );
    if (state === null) return null;

    const prtc_res = await (async() => {
      try {
        return await db.pool.query(
          'SELECT * FROM participation WHERE game = $1',
          [id]
        );
      } catch (err) {
        log.error('snapshot retrieval failed (participation): ', err);
      }
    })();
    if (prtc_res === null) return null;

    const users: Record<Principal, P.User> = Object.fromEntries(
      prtc_res.rows.map(
        ({principal, uid, nick}) => [principal, {id: uid, nick}]
      )
    );
    log.info('snapshot decode succeeded', {game: id});

    return this.games[id] = new Game(
      id,
      this.engine,
      config,
      row.owner,
      this.participation,
      async () => await this.delete_game(id),
      state,
      users,
    );
  }

  /*
   * delete all data for a game
   *
   * includes all persistent snapshots, user participation, and the game object
   * itself from this.games
   */
  async delete_game(id: GameId) {
    if (!(id in this.games)) return;
    if (this.games[id].clients.length > 0) return;

    log.info('game deletion', {game: id});

    try {
      await db.pool.query('DELETE FROM games WHERE id = $1', [id]);
    } catch (err) {
      log.error('snapshot deletion failed: ', err);
    }

    for (const principal in this.games[id].users) {
      this.participation[principal].delete(id);
    }
    delete this.games[id];
  }

  /*
   * propagate a nick change to all live games
   */
  rename(principal: Principal, nick: string) {
    const gids: Iterable<GameId> = this.participation[principal] ?? [];

    for (const gid of gids) {
      this.games[gid]?.rename(principal, nick);
    }
  }
};
