/*
 * Webserver implementation, wrapped around a generic game engine.
 */

import * as Protocol from './protocol'
import * as Session from './session.ts'

import * as WebSocket from 'ws'
import * as Http from 'http'
import * as assert from 'assert'
import * as Uuid from 'uuid'

export type GameId = string;
export type Principal = Session.Id;

interface Client {
  id: Protocol.UserId;
  principal: Principal;
  socket: WebSocket;
};

interface Game<State> {
  state: State;
  owner: Principal;
  clients: Client[];
}

export class GameServer<
  Cfg, S, A, CS, CA,
  Eng extends Protocol.Engine<Cfg, S, A, CS, CA>
> {
  #engine: Eng;
  #ws: WebSocket.Server;
  #games: Record<GameId, Game<S>>;

  constructor(engine: Eng, server: Http.Server) {
    this.#engine = engine;
    this.#ws = new WebSocket.Server({noServer: true});
    this.#games = {};

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
      if (!(gameId in this.#games)) {
        return bail("no such game: " + gameId);
      }
      let game = this.#games[gameId];

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

      this.#ws.handleUpgrade(req, sock, head, async (ws: WebSocket) => {
        this.#ws.emit('connection', ws, req, game)
      });
    });

    this.#ws.on('connection', this.newClient);
  }

  public beginGame(
    cfg: Cfg,
    owner: Principal
  ): GameId {
    let id = Uuid.v4();
    let state = this.#engine.init(cfg);
    this.#games[id] = {
      state: this.#engine.init(cfg),
      owner,
      clients: []
    };
    return id;
  }

  private newClient(
    sock: WebSocket,
    req: Http.IncomingMessage,
    game: Game<Eng>
  ) {
    console.log("blorf");
    sock.close();
  }
};
