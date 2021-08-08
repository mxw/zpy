import * as Uuid from 'uuid'
import * as Crypto from 'crypto'

import {
  SessionID as Id,
  Session as T,
} from 'server/types'
export {
  SessionID as Id,
  Session as T,
  session_regex as regex
} from 'server/types'

import * as db from 'server/db'

import * as options from 'options'
import assert from 'utils/assert'
import log from 'utils/logger'


const active: Record<Id, T> = {};

export async function make(): Promise<T> {
  const id = Uuid.v4();
  const token = Crypto.randomBytes(64).toString("hex");

  // must register the session before awaiting the DB insert
  active[id] = {id, token};

  try {
    await db.pool.query(
      'INSERT INTO sessions (id, token, ts) VALUES ($1, $2, NOW())',
      [id, token]
    );
  } catch (err) {
    log.error('session write failed: ', err);
  }

  return active[id];
}

export async function get(id: Id): Promise<T | null> {
  if (id in active) return active[id];

  try {
    const res = await db.pool.query(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    );
    if (res.rows.length !== 1) return null;

    // bump access time w/o awaiting
    db.pool.query(
      'UPDATE sessions SET ts = NOW() WHERE id = $1',
      [id]
    );

    const token = res.rows[0].token;
    return active[id] = {id, token};

  } catch (err) {
    log.error('session lookup failed: ', err);
  }
  return null;
}

export async function middleware(req: any, res: any, next: any) {
  const commit = (session: T) => {
    const opts = {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: options.session_expiry,
    };
    res.cookie("id", session.id, opts);
    res.cookie("token", session.token, opts);
    req.session = session;
  };

  const bail = async () => {
    const session = await make();
    commit(session);

    log.info('session issue', {
      session: session.id,
      ip: req.ip,
    });
    next();
  };

  const {id = null, token = null} = req.cookies;
  if (id === null) return await bail();
  if (token === null) return await bail();

  const session = await get(id);
  if (session === null) return await bail();

  if (session.token !== token) return await bail();

  commit(session);
  next();
}
