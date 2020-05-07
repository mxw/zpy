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

import assert from 'utils/assert.ts'
import log from 'utils/logger.ts'


const active: Record<Id, T> = {};

export function make(): T {
  const id = Uuid.v4();
  const token = Crypto.randomBytes(64).toString("hex");
  return active[id] = {id, token};
}

export function get(id: Id): T | null {
  return (id in active) ? active[id] : null;
}

export function middleware(req: any, res: any, next: any) {
  const bail = () => {
    const session = make();
    res.cookie("id", session.id);
    res.cookie("token", session.token);
    req.session = session;

    log.info('issuing session', {
      session: session.id,
      ip: req.ip,
    });
    next();
  };

  const id = req.cookies.id;
  const token = req.cookies.token;
  if (id === undefined) return bail();
  if (token === undefined) return bail();

  const session = get(id);
  if (session === null) return bail();

  if (session.token !== token) return bail();

  req.session = session;
  next();
}
