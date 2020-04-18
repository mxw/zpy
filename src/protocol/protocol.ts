/*
 * toplevel protocol for communication between the server and clients.
 */

import { pipe } from 'fp-ts/lib/pipeable'
import { fold } from 'fp-ts/lib/Either'

import * as t from 'io-ts'
import * as C from 'io-ts/lib/Codec'

///////////////////////////////////////////////////////////////////////////////
/*
 * band-aids for io-ts.
 */

type TypeOf<T> = T extends C.Codec<infer A> ? A : never;

function C_union<A extends ReadonlyArray<unknown>>(
  ...members: { [K in keyof A]: C.Codec<A[K]> }
): C.Codec<A[number]> {
  return C.sum('_tag')(Object.fromEntries(
    members.map((codec, i) => ['' + i, C.type({
      _tag: C.literal('' + i),
      val: codec,
    })])
  ));
}

///////////////////////////////////////////////////////////////////////////////

export type Version = number;

export const UserID = C.number;
export type UserID = number;

export const User = C.type({
  id: C.number,
  nick: C.string,
});
export type User = TypeOf<typeof User>;

export const TxID = C.number;
export type TxID = number;

///////////////////////////////////////////////////////////////////////////////

export const RequestHello = C.type({
  verb: C.literal("req:hello"),
  nick: C.string,
});

export const Hello = C.type({
  verb: C.literal("hello"),
  you: User,
});

export const RequestBye = C.type({
  verb: C.literal("req:bye"),
});

export const Bye = C.type({
  verb: C.literal("bye"),
});

export const RequestReset = C.type({
  verb: C.literal("req:reset"),
});

export function Reset<
  ClientState extends C.Codec<any>
> (cs: ClientState) {
  return C.type({
    verb: C.literal("reset"),
    state: cs,
    who: C.array(User),
  });
}

export function RequestUpdate<
  Intent extends C.Codec<any>
> (int: Intent) {
  return C.type({
    verb: C.literal("req:update"),
    tx: TxID,
    intent: int,
  });
}

export function Update<
  Effect extends C.Codec<any>
> (eff: Effect) {
  return C.type({
    verb: C.literal("update"),
    tx: C.nullable(TxID),
    effect: eff,
  });
}

export function UpdateReject<
  UpdateError extends C.Codec<any>
> (ue: UpdateError) {
  return C.type({
    verb: C.literal("reject"),
    tx: TxID,
    reason: ue,
  });
}

///////////////////////////////////////////////////////////////////////////////
/*
 * protocol actions are special actions that interact with the engine but
 * manipulate non-engine data.  for now, just joins and parts.
 */

export const Join = C.type({
  verb: C.literal("user:join"),
  who: User,
});
export type Join = TypeOf<typeof Join>

export const Part = C.type({
  verb: C.literal("user:part"),
  id: C.number,
});
export type Part = TypeOf<typeof Part>

export const ProtocolAction = C.sum('verb')({
  'user:join': Join,
  'user:part': Part,
});
export type ProtocolAction = Join | Part;

///////////////////////////////////////////////////////////////////////////////

export function ServerMessage<
  ClientState extends C.Codec<any>,
  Effect extends C.Codec<any>,
  UpdateError extends C.Codec<any>,
> (cs: ClientState, eff: Effect, ue: UpdateError) {
  return C.sum('verb')({
    hello:  Hello,
    bye:    Bye,
    reset:  Reset(cs),
    update: Update(C_union(eff, ProtocolAction)),
    reject: UpdateReject(ue)
  });
}

export function ClientMessage<
  Intent extends C.Codec<any>
> (int: Intent) {
  return C.sum('verb')({
    'req:hello':  RequestHello,
    'req:bye':    RequestBye,
    'req:reset':  RequestReset,
    'req:update': RequestUpdate(int)
  });
}

///////////////////////////////////////////////////////////////////////////////
/*
 * interface for interacting with decode results.
 *
 * io-ts just leaks its fp-ts representations; this hides them again.
 */

export function on_decode<R1, R2, Codec extends C.Codec<any>>(
  codec: Codec,
  input: unknown,
  onsuccess: (value: TypeOf<Codec>) => R1,
  onfail?: R2 | (() => R2),
): R1 | R2 {
  return pipe(codec.decode(input), fold(
    (_): R1 | R2 => onfail instanceof Function ? onfail() : onfail,
    (v): R1 | R2 => onsuccess(v)
  ));
}
