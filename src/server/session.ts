import * as Uuid from 'uuid'
import * as Crypto from 'crypto'

import {
  SessionID as Id,
  Session as T,
} from 'server/types.ts'
export {
  SessionID as Id,
  Session as T,
  session_regex as regex
} from 'server/types.ts'

import * as db from 'server/db.ts'

import assert from 'utils/assert.ts'
import log from 'utils/logger.ts'


const active: Record<Id, T> = {};

export async function make(): Promise<T> {
  const id = Uuid.v4();
  const token = Crypto.randomBytes(64).toString("hex");

  try {
    await db.pool.query(
      'INSERT INTO sessions (id, token) VALUES ($1, $2)',
      [id, token]
    );
  } catch (err) {
    log.error('session write failed: ', err);
  }

  return active[id] = {id, token};
}

export async function get(id: Id): Promise<T | null> {
  if (id in active) return active[id];

  try {
    const res = await db.pool.query(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    );
    if (res.rows.length !== 1) return null;

    const token = res.rows[0].token;
    return active[id] = {id, token};

  } catch (err) {
    log.error('session lookup failed: ', err);
  }
  return null;
}

export async function middleware(req: any, res: any, next: any) {
  const bail = async () => {
    const session = await make();
    res.cookie("id", session.id, {secure: true});
    res.cookie("token", session.token, {secure: true});
    req.session = session;

    log.info('session issue', {
      session: session.id,
      ip: req.ip,
    });
    next();
  };

  const {id = null, token = null} = req.cookies;
  if (id === null) return bail();
  if (token === null) return bail();

  const session = await get(id);
  if (session === null) return bail();

  if (session.token !== token) return bail();

  req.session = session;
  next();
}
