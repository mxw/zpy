/*
 * Webserver implementation, wrapped around a generic game engine.
 */

import {isOK, isErr} from 'utils/result.ts'

import {Engine} from 'protocol/engine.ts'
import * as P from 'protocol/protocol.ts'
import * as Session from 'server/session.ts'

import * as WebSocket from 'ws'
import * as Http from 'http'
import assert from 'assert'
import * as Uuid from 'uuid'

export type GameId = string;
export type Principal = Session.Id;

interface Client {
  principal: Principal;
  user: P.User | null;
  sync: boolean;
  socket: WebSocket;
};

// the server-side protocol monkey
//
// this manages the network communication w/ the clients and shovels updates
// into the game engine as appropriate.
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
  engine: Eng;
  config: Config;
  owner: Principal;
  state: State;

  // currently connected clients
  clients: Client[] = [];

  // user object corresponding to every client we've seen
  known_users: Record<Principal, {
    user: P.User;
    part_ts: null | number;
  }> = {};

  // next uid to allocate
  next_uid: number = 0;

  /*
   * start a new game w/ no players
   *
   * the principal identifies the player who will be marked as the game owner
   * once they join
   */
  constructor(engine: Eng, owner: Principal, config: Config) {
    this.engine = engine;
    this.config = config;
    this.owner = owner;
    this.state = this.engine.init(config);
  }

  /*
   * process a hello message from a client
   *
   * this marks them as present but not yet synchronized; they won't receive
   * updates until they ask for a reset
   */
  hello(source: Client, nick: string): void {
    const known = this.known_users[source.principal] ?? null;

    const user = (() => {
      if (known !== null) {
        known.part_ts = null;
        return known.user;
      }
      const user = {
        id: this.next_uid++,
        nick: nick,
      };
      this.known_users[source.principal] = {user, part_ts: null};

      return user;
    })();

    source.user = user;
    source.socket.send(JSON.stringify(
      P.Hello.encode({
        verb: "hello",
        you: user,
      })
    ));

    for (let client of this.clients) {
      if (!client.sync) continue;

      const Update = P.Update(this.engine.Effect(this.state));

      client.socket.send(JSON.stringify(
        Update.encode({
          verb: "update",
          tx: null,
          command: {
            kind: "protocol",
            effect: {
              verb: known === null ? "user:join" : "user:rejoin",
              who: user,
            },
          },
        })
      ));
    }
  }

  // process an update request from a client. the response will be marked w/ the
  // transaction id provided here; either as an update messsage after we handle
  // the update or as an update-reject message
  update(source: Client, tx: P.TxID, intent: Intent) {
    let result = this.engine.larp(
      this.state,
      intent,
      source.user,
      this.clients.map(c => c.user),
    );

    if (isErr(result)) {
      const UpdateReject = P.UpdateReject(this.engine.UpdateError);

      source.socket.send(JSON.stringify(
        UpdateReject.encode({
          verb: "reject",
          tx: tx,
          reason: result.err,
        })
      ));
      return;
    }
    let [state, effects] = result.ok;

    this.state = state;

    for (let client of this.clients) {
      if (!client.sync) continue;
      if (!(client.user.id in effects)) continue;

      let for_tx = client === source ? tx : null;

      const Update = P.Update(this.engine.Effect(this.state));

      client.socket.send(JSON.stringify(
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

  // process a reset request from a client; we simply need to forward that
  // client's state
  reset(client: Client) {
    let cs = this.engine.redact(this.state, client.user);
    client.sync = true;

    const Reset = P.Reset(this.engine.ClientState(this.state));

    client.socket.send(JSON.stringify(
      Reset.encode({
        verb: "reset",
        state: cs,
        who: this.clients.map(cli => cli.user),
      })
    ));
  }

  // after we are finished w/ a client session, close their socket and remove
  // them from the list of clients
  //
  // TODO this should also be responsible for processing leaves if necessary
  dispose(client: Client) {
    client.sync = false;
    client.socket.close();
    this.clients.splice(this.clients.indexOf(client));
  }

  // process a bye request from a client. simply reply 'bye' and disconnect
  bye(client: Client) {
    client.socket.send(JSON.stringify(
      P.Bye.encode({
        verb: "bye"
      })
    ));
    this.dispose(client);
  }

  // kick a naughty client by sending them 'bye' and disconnecting
  kick(client: Client, reason: string) {
    console.log("kick: " + reason);
    this.bye(client)
  }

  // handle a new connection for the given session and websocket; the game
  // takes ownership of the websocket at this point
  connect(session: Session.T, sock: WebSocket) {
    let client: Client = {
      principal: session.id,
      user: null,
      sync: false,
      socket: sock,
    };

    this.clients.push(client);

    sock.on('message', (data: string) => {
      let d = JSON.parse(data);
      let ClientMessage = P.ClientMessage(this.engine.Intent(this.state));

      P.on_decode(ClientMessage, d, msg => {
        switch (msg.verb) {
          case "req:bye": this.bye(client); break;
          case "req:hello": this.hello(client, msg.nick); break;
          case "req:reset": this.reset(client); break
          case "req:update": this.update(client, msg.tx, msg.intent); break;
        }
      }, (e: any) => {
        console.error(P.draw_error(e), d);
        this.kick(client, "invalid msg");
      });
    })
  }
}

// a websocket server that can handle multiple games for a given engine
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

  // attach to the provided http server to handle upgrade requests.
  constructor(engine: Eng, server: Http.Server, url_pref: string) {
    this.engine = engine;
    this.ws = new WebSocket.Server({noServer: true});

    server.on('upgrade', async (req: Http.IncomingMessage, sock, head) => {
      let bail = (reason: string) => {
        console.log(reason)
        sock.write('HTTP/1.1 400 Bad Request\r\n' +
                   'X-Reason: ' + reason + '\r\n');
        sock.destroy();
        return;
      };

      // is the url cromulent
      let matches = req.url.match(`^\/${url_pref}\/([^\\\/]*)\/$`);
      if (matches === null) {
        return bail("invalid uri");
      }

      // is the game a real thing
      let game_id = matches[1];
      if (!(game_id in this.games)) {
        return bail("no such game: " + game_id);
      }
      let game = this.games[game_id];

      // is this someone we know about
      let id: string | null = null;
      let token: string | null = null;

      for (let c of req.headers.cookie.split(';')) {
        // sketchy cookie parsing let's gooooo
        let matches = c.trim().match(/^([^=]*)=([^=]*)$/);
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

      let session = Session.get(id);
      if (session === null) {
        return bail("no session " + id);
      }

      if (token !== session.token) {
        return bail("invalid token: " + token);
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

  // make a new room for a game with the given owner. returns the game id.
  public begin_game(
    cfg: Config,
    owner: Principal,
  ): GameId {
    let id = Uuid.v4();
    this.games[id] = new Game(this.engine, owner, cfg);
    return id;
  }
};
