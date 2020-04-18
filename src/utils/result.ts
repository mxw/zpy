import * as assert from 'assert'

export type Result<T, Err> = {ok: T} | {err: Err};

export function Ok<T, E>(x: T) {
  return {ok: x};
}

export function Err<T, E>(x: E) {
  return {err: x};
}

export function assertOk<T, E>(r: Result<T, E>): T {
  if ('ok' in r) {
    return r.ok;
  } else {
    assert.fail("expected no error here");
  }
}

export function assertErr<T, E>(r: Result<T, E>): E {
  if ('err' in r) {
    return r.err;
  } else {
    assert.fail("expected an error here");
  }
}

export function fold<T, E, R>(r: Result<T, E>, ifOk: ((val: T) => R), ifErr: ((err: E) => R)) {
  if ('ok' in r) {
    return ifOk(r.ok)
  } else {
    return ifErr(r.err);
  }
}

export function isOk<T, E>(r: Result<T, E>): r is {ok: T} {
  return fold(r, () => true, () => false);
}

export function isErr<T, E>(r: Result<T, E>): r is {err: E} {
  return fold(r, () => false, () => true);
}
