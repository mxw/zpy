import * as ZPYEngine from 'lib/zpy/engine.ts'

import { GameServer, GameId } from 'server/server.ts'
import * as Session from 'server/session.ts'

import { escape_backslashes } from 'utils/string.ts';

import CookieParser from 'cookie-parser'
import express from 'express'
import * as HTTP from 'http'
import * as WebSocket from 'ws'

const app = express();

app.use('/', express.static("assets/html"));
app.use(
  `/zpy/:game_id(${escape_backslashes(Session.regex.source)})`,
  express.static("assets/html")
);

app.use('/static/js', express.static("dist/ui"));
app.use('/static/style', express.static("assets/style"));
app.use('/static/svg', express.static("assets/svg"));

app.use(CookieParser());
app.use(Session.middleware);

const server = HTTP.createServer(app);
const gs = new GameServer(ZPYEngine, server, "zpy");

app.get('/api/session', (req, res) => {
  const r = req as (typeof req & {session: Session.T});
  res.send(r.session.id);
});

app.post('/api/new_game', (req, res) => {
  const r = req as (typeof req & {session: Session.T});
  const game_id = gs.begin_game({
    renege: 0,
    rank: 0,
    kitty: 0,
  }, r.session.id);
  console.log(`/zpy/${game_id} initiated by ${r.session.id}`);
  res.send(game_id);
});

server.listen(8080, () => {
  console.log("listening on port 8080");
})
