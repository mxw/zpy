import * as ZPYEngine from 'lib/zpy/engine.ts'

import { GameServer, GameId } from 'server/server.ts'
import * as db from 'server/db.ts'
import * as Session from 'server/session.ts'

import { ZPY } from 'lib/zpy/zpy.ts'

import { escape_backslashes } from 'utils/string.ts';

import CookieParser from 'cookie-parser'
import express from 'express'
import * as HTTP from 'http'
import * as WebSocket from 'ws'
import * as os from 'os'

import * as options from 'options.ts'
import assert from 'utils/assert.ts'
import log from 'utils/logger.ts'


const app = express();

app.use('/', express.static("assets/html"));
app.use(
  `/zpy/:game_id(${escape_backslashes(Session.regex.source)})`,
  express.static("assets/html")
);

app.use('/static/js', express.static("dist/ui"));
app.use('/static/style', express.static("assets/style"));
app.use('/static/svg', express.static("assets/svg"));
app.use('/static/png', express.static("assets/png"));

app.use(CookieParser());
app.use(Session.middleware);
app.use(express.json());

const server = HTTP.createServer(app);
const gs = new GameServer(ZPYEngine, server, "zpy");

///////////////////////////////////////////////////////////////////////////////

/*
 * return the client's session id
 *
 * the existence of a session is ensured by Session.middleware
 */
app.get('/api/session', (req, res) => {
  const r = req as (typeof req & {session: Session.T});
  res.send(r.session.id);
});

/*
 * set the client's nickname
 *
 * currently, we do this just by setting a cookie, which is used by the client
 * whenever they join a game
 */
app.post('/api/set_nick', (req, res) => {
  const r = req as (typeof req & {session: Session.T});

  const nick = r.body.nick;
  if (!nick || nick.length > options.nick_limit) {
    res.send(false);
    return;
  }
  res.cookie("nick", nick, {
    secure: process.env.NODE_ENV === 'production',
    maxAge: options.session_expiry,
  });
  gs.rename(r.session.id, nick);

  res.send(true);
});

/*
 * start a new game
 */
app.post('/api/new_game', (req, res) => {
  const r = req as (typeof req & {session: Session.T});
  const game_id = gs.begin_game(ZPY.default_rules, r.session.id);

  log.info('game creation', {
    game: game_id,
    owner: r.session.id,
  });
  res.send(game_id);
});

server.listen(8080, async () => {
  await db.ensure_init();
  log.info('listening on port 8080');
});

///////////////////////////////////////////////////////////////////////////////

/*
 * graceful shutdown: snapshot all games
 */
async function shutdown() {
  log.info('server going down');

  await Promise.all(Object.values(gs.games).map(
    game => game.snapshot()
  ));
  log.info('server snapshot complete');
}

async function signal_handler(signal: NodeJS.Signals) {
  log.info('signal handled', {signal});
  await shutdown();

  process.exit(0);
}

process.on('SIGINT', signal_handler);
process.on('SIGTERM', signal_handler);
