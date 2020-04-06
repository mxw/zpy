import { CounterEngine } from 'trivial-engine.ts'

import { GameServer } from 'server/server.ts'
import * as Session from 'server/session.ts'

import CookieParser from 'cookie-parser'
import express from 'express'
import * as Http from 'http'
import * as WebSocket from 'ws'

let app = express();

app.use('/', express.static("assets/html"))
app.use('/static/js', express.static("dist/ui"))
app.use('/static/style', express.static("assets/style"))
app.use(CookieParser());
app.use(Session.middleware);

let server = Http.createServer(app);
let gs = new GameServer(CounterEngine, server);

var activeGame: string | null = null;

app.get('/api/session', (req, res) => {
  let r = req as (typeof req & {session: Session.Session});
  res.send(r.session.id);
});

app.get('/api/activeGame', (req, res) => {
  let r = req as (typeof req & {session: Session.Session});
  res.send(activeGame);
});

server.listen(8080, () => {
  console.log("listening on port 8080");

  activeGame = gs.beginGame(undefined, "jgriego");
  console.log(activeGame);
})
