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

export const RequestHello = C.type({
  verb: C.literal("req:hello"),
  nick: C.string,
});
type RequestHello = TypeOf<typeof RequestHello>;

export const Hello = C.type({
  verb: C.literal("hello"),
  you: User,
});
type Hello = TypeOf<typeof Hello>;

export const RequestBye = C.type({
  verb: C.literal("req:bye"),
});
type RequestBye = TypeOf<typeof RequestBye>;

export const Bye = C.type({
  verb: C.literal("bye"),
});
type Bye = TypeOf<typeof Bye>;

export const RequestReset = C.type({
  verb: C.literal("req:reset"),
});
type RequestReset = TypeOf<typeof RequestReset>;

export function Reset<
  ClientState extends C.Codec<any>
> (cs: ClientState) {
  return C.type({
    verb: C.literal("reset"),
    state: cs,
    who: C.array(User),
  });
}
type Reset<CS> = {
  verb: "reset",
  state: CS,
  who: User[],
};

export function RequestUpdate<
  Intent extends C.Codec<any>
> (int: Intent) {
  return C.type({
    verb: C.literal("req:update"),
    tx: TxID,
    intent: int,
  });
};
type RequestUpdate<Int> = {
  verb: "req:update",
  tx: TxID,
  intent: Int
};

export function Update<
  Effect extends C.Codec<any>
> (eff: Effect) {
  return C.type({
    verb: C.literal("update"),
    tx: C.nullable(TxID),
    effect: C.sum("kind")({
      protocol: C.type({kind: C.literal("protocol"), eff: ProtocolAction}),
      engine: C.type({kind: C.literal("engine"), eff: eff}),
    }),
  });
}
type Update<Eff> = {
  verb: "update",
  tx: null | TxID,
  effect: {kind: "protocol", eff: ProtocolAction} | {kind: "engine", eff: Eff},
};

export function UpdateReject<
  UpdateError extends C.Codec<any>
> (ue: UpdateError) {
  return C.type({
    verb: C.literal("reject"),
    tx: TxID,
    reason: ue,
  });
}
type UpdateReject<UE> = {
  verb: "reject",
  tx: TxID,
  reason: UE
};

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
    update: Update(eff),
    reject: UpdateReject(ue)
  });
}
export type ServerMessage<CS, Eff, UE> =
  | Hello | Bye | Reset<CS>
  | Update<Eff>
  | UpdateReject<UE>;

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
export type ClientMessage<Int> =
  RequestHello | RequestBye | RequestReset | RequestUpdate<Int>;

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
