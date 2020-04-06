/*
 * Webserver implementation, wrapped around a generic game engine.
 */

import {Engine} from '../protocol/engine.ts'
import * as Protocol from '../protocol/protocol.ts'
import * as Session from './session.ts'

import * as WebSocket from 'ws'
import * as Http from 'http'
import assert from 'assert'
import * as Uuid from 'uuid'

export type GameId = string;
export type Principal = Session.Id;

interface Client {
  principal: Principal;
  user: Protocol.User | null;
  sync: boolean;
  socket: WebSocket;
};

class Game<Cfg, I, S, A, CS, Eff, UE,
           Eng extends Engine<Cfg, I, S, A, CS, Eff, UE>>
{
  state: S;
  owner: Principal;
  clients: Client[];
  config: Cfg;
  engine: Eng;
  next_id: number

  constructor(engine: Eng, owner: Principal, config: Cfg) {
    this.engine = engine
    this.config = config
    this.owner = owner
    this.state = this.engine.init(config)
    this.clients = [];
    this.next_id = 0;
  }

  processUpdate(act: A | Protocol.ProtocolAction,
                source: null | Client,
                tx: null | Protocol.TxId): UE | null {
    let newstate = this.engine.apply(this.state, act);
    if (this.engine.tUpdateError.is(newstate)) {
      return newstate;
    } else {
      this.state = newstate;

      for (let client of this.clients) {
        if (!client.sync) continue;

        let eff = Protocol.tProtocolAction.is(act)
          ? act
          : this.engine.redact_action(this.state, act, client.user);

        let forTx = client === source ? tx : null;
        client.socket.send(JSON.stringify({
          verb: "update",
          tx: forTx,
          effect: eff
        }));
      }

      return null;
    }
  }

  hello(client: Client, nick: string) {
    let user = {
      id: this.next_id,
      nick: nick
    };

    this.next_id += 1;

    let res = this.processUpdate({
      verb: 'user:join',
      who: user,
    }, client, null);
    assert(res === null);

    client.user = user;
    client.socket.send(JSON.stringify({
      verb: "hello",
      you: user
    }));
  }

  update(client: Client, tx: Protocol.TxId, int: I) {
    let bail = (ue: UE) => client.socket.send(JSON.stringify({
      verb: "update-reject",
      tx: tx,
      reason: act
    }));

    let act = this.engine.listen(this.state, int);
    if (this.engine.tUpdateError.is(act)) {
      return bail(act);
    }

    let err = this.processUpdate(act, client, tx);
    if (err !== null) {
      return bail(err);
    }
  }

  reset(client: Client) {
    let cs = this.engine.redact(this.state, client.user);
    client.sync = true;
    client.socket.send(JSON.stringify({
      verb: "reset",
      state: cs,
      who: this.clients.map(cli => cli.user)
    }));
  }

  disposeClient(client: Client) {
    client.sync = false;
    client.socket.close();
    this.clients.splice(this.clients.indexOf(client));
  }

  bye(client: Client) {
    client.socket.send(JSON.stringify({
      verb: "bye"
    }));
    this.disposeClient(client);
  }

  kick(client: Client, reason: string) {
    console.log("kick: " + reason);
    this.bye(client)
  }

  connect(session: Session.Session, sock: WebSocket) {
    let client: Client = {
      principal: session.id,
      user: null,
      sync: false,
      socket: sock
    };

    this.clients.push(client);

    sock.on('message', (data: string) => {
      let payload = JSON.parse(data);
      let tClientMessage = Protocol.tClientMessage(this.engine.tIntent);

      if (tClientMessage.is(payload)) {
        switch (payload.verb) {
          case "req:bye": this.bye(client); break;
          case "req:hello": this.hello(client, payload.nick); break;
          case "req:reset": this.reset(client); break
          case "req:update": this.update(client, payload.tx, payload.intent); break;
        }
      } else {
        this.kick(client, "invalid msg");
      }
    })
  }
}

export class GameServer<Cfg, I, S, A, CS, E, UE,
                        Eng extends Engine<Cfg, I, S, A, CS, E, UE>> {
  engine: Eng;
  ws: WebSocket.Server;
  games: Record<GameId, Game<Cfg, I, S, A, CS, E, UE, Eng>>;

  constructor(engine: Eng, server: Http.Server) {
    this.engine = engine;
    this.ws = new WebSocket.Server({noServer: true});
    this.games = {};

    server.on('upgrade', async (req: Http.IncomingMessage, sock, head) => {
      let bail = (reason: string) => {
        console.log(reason)
        sock.write('HTTP/1.1 400 Bad Request\r\n' +
            'X-Reason: ' + reason + '' +
            '\r\n');
        sock.destroy();
        return;
      };

      // is the url cromulent
      let matches = req.url.match(/^\/game\/([^\/]*)\/$/);
      if (matches === null) {
        return bail("invalid uri");
      }

      // is the game a real thing
      let gameId = matches[1];
      if (!(gameId in this.games)) {
        return bail("no such game: " + gameId);
      }
      let game = this.games[gameId];

      // is this someone we know about
      var id: string | null = null;
      var token: string | null = null;

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

      let session = Session.getSession(id);
      if (session === null) {
        return bail("no session " + id);
      }

      if (token !== session.token) {
        return bail("invalid token: " + token);
      }

      this.ws.handleUpgrade(req, sock, head, async (ws: WebSocket) => {
        this.ws.emit('connection', ws, req, game, session)
      });
    });

    this.ws.on('connection', (ws: WebSocket,
                              req: Http.IncomingMessage,
                              game: Game<Cfg, I, S, A, CS, E, UE, Eng>,
                              session: Session.Session) => {
                                return game.connect(session, ws);
                              });
  }

  public beginGame(
    cfg: Cfg,
    owner: Principal
  ): GameId {
    let id = Uuid.v4();
    let state = this.engine.init(cfg);
    this.games[id] = new Game(this.engine, owner, cfg);
    return id;
  }
};
