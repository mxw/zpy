/*
 * Webserver implementation, wrapped around a generic game engine.
 */

import {isOK, isErr} from 'utils/result.ts'

import {Engine} from 'protocol/engine.ts'
import * as P from 'protocol/protocol.ts'
import * as Session from 'server/session.ts'

import * as WebSocket from 'ws'
import * as Http from 'http'
import * as Uuid from 'uuid'

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
};

function log_client(client: Client) {
  return {
    session: client.principal,
    uid: client.user?.id ?? null,
    nick: client.user?.nick ?? '<unknown>',
  };
}

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
  participation: Record<Principal, GameId[]>;

  // callback for when our last client leaves
  destroy: () => void;

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
    participation: Record<Principal, GameId[]>,
    destroy: () => void,
  ) {
    this.id = id;
    this.engine = engine;
    this.config = config;
    this.owner = owner;
    this.participation = participation;
    this.destroy = destroy;
    this.state = this.engine.init(config);
  }

  /*
   * process a hello message from a client
   *
   * this marks them as present but not yet synchronized; they won't receive
   * updates until they ask for a reset
   */
  hello(source: Client, nick: string): void {
    const known = source.principal in this.users;

    if (!known) {
      // new principal; conjure a user object for them
      this.users[source.principal] = {
        id: this.next_uid++,
        nick: nick,
      };

      // help the game server track the games each principal belongs to
      this.participation[source.principal] =
        this.participation[source.principal] ?? [];
      this.participation[source.principal].push(this.id);
    }
    source.user = this.users[source.principal];

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
    // then remove the victim client
    victim.sync = false;
    victim.socket.close();
    this.clients.splice(this.clients.indexOf(victim));

    if (victim.user === null) return;

    // broadcast the part.  de-syncing the victim above prevents us from
    // attempting to send messages over the closed socket.
    this.broadcast(victim, {
      verb: "user:part",
      id: victim.user.id,
    });

    // if our last client has left, tell the server we're finished (probably)
    if (this.clients.length === 0) this.destroy();
  }

  /*
   * process a bye request from a client: simply reply 'bye' and disconnect
   */
  bye(client: Client) {
    client.send(JSON.stringify(
      P.Bye.encode({
        verb: "bye"
      })
    ));
    this.dispose(client);
  }

  /*
   * kick a naughty client by sending them 'bye' and disconnecting
   */
  kick(client: Client, reason: string) {
    log.info('kick', {...log_client(client), reason});
    this.bye(client)
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
    const client = new Client(session.id, sock);

    this.clients.push(client);

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
          ...log_client(client),
          msg: d,
          draw: P.draw_error(e),
        });
        this.kick(client, 'invalid msg');
      });
    });

    sock.on('close', () => this.dispose(client));
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
  participation: Record<Principal, GameId[]> = {};

  /*
   * attach to the provided http server to handle upgrade requests
   */
  constructor(engine: Eng, server: Http.Server, url_pref: string) {
    this.engine = engine;
    this.ws = new WebSocket.Server({noServer: true});

    server.on('upgrade', async (req: Http.IncomingMessage, sock, head) => {
      const bail = (reason: string, details?: object) => {
        log.error('websocket upgrade failure', {...details, reason});

        sock.write('HTTP/1.1 400 Bad Request\r\n' +
                   'X-Reason: ' + reason + '\r\n');
        sock.destroy();
        return;
      };

      // is the url cromulent
      const matches = req.url.match(`^\/${url_pref}\/([^\\\/]*)\/$`);
      if (matches === null) {
        return bail('invalid uri', {uri: req.url});
      }

      // is the game a real thing
      const game_id = matches[1];
      if (!(game_id in this.games)) {
        return bail(`no such game: ${game_id}`, {game: game_id});
      }
      const game = this.games[game_id];

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

      const session = Session.get(id);
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
      req: Http.IncomingMessage,
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
  public begin_game(cfg: Config, owner: Principal): GameId {
    const id = Uuid.v4();

    const cleanup = () => {
      log.info('queueing game for deletion', {game: id});

      setTimeout(() => {
        if (id in this.games &&
            this.games[id].clients.length === 0) {
          log.info('deleting game', {game: id});
          delete this.games[id];
        }
      }, options.game_expiry); // 30 minutes of inactivity
    };

    this.games[id] = new Game(
      id,
      this.engine,
      cfg,
      owner,
      this.participation,
      cleanup,
    );
    return id;
  }

  /*
   * propagate a nick change to all live games
   */
  public rename(principal: Principal, nick: string) {
    const gids = this.participation[principal] ?? [];

    for (const gid of gids) {
      this.games[gid]?.rename(principal, nick);
    }
  }
};
