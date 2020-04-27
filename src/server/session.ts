import * as Uuid from 'uuid'
import * as Crypto from 'crypto'

export type Id = string;

export interface T {
  id: Id;
  token: string;
}

let activeSessions: Record<Id, T> = {};

export const regex =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export function make(): T {
  let id = Uuid.v4();
  let token = Crypto.randomBytes(64).toString("hex");
  return activeSessions[id] = {id, token};
}

export function get(id: Id): T | null {
  return (id in activeSessions) ? activeSessions[id] : null;
}

export function middleware(req: any, res: any, next: any) {
  let bail = () => {
    let session = make();
    res.cookie("id", session.id);
    res.cookie("token", session.token);
    req.session = session;
    next();
  };

  let id = req.cookies.id;
  let token = req.cookies.token;
  if (id === undefined) return bail();
  if (token === undefined) return bail();

  let session = get(id);
  if (session === null) return bail();

  if (session.token !== token) return bail();

  req.session = session;
  next();
}
