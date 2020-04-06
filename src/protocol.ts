import * as WebSocket from 'ws'
import * as t from 'io-ts'

// this file defines the protocol for communication between the clients and
// server and also the interface between the protocol-focused code and the
// game-focused code (see Engine below)

export type Version = number;
export type UserId = number;

export const tUser = t.type({
  id: t.number,
  nick: t.string,
});
export type User = t.TypeOf<typeof tUser>;

export const tTxId = t.number;
export type TxId = number;

////////////////////////////////////////////////////////////////////////////////

export const tRequestHello = t.type({
  verb: t.literal("req:hello"),
  nick: t.string,
});

export const tHello = t.type({
  verb: t.literal("hello"),
  you: tUser,
});

export const tRequestBye = t.type({
  verb: t.literal("req:bye"),
});

export const tBye = t.type({
  verb: t.literal("bye"),
});

////////////////////////////////////////////////////////////////////////////////

export const tRequestReset = t.type({
  verb: t.literal("req:reset"),
});

export const tReset = <ClientState extends t.Mixed>(cs: ClientState) => t.type({
  verb: t.literal("reset"),
  state: cs,
  who: t.array(tUser),
});

////////////////////////////////////////////////////////////////////////////////

export const tRequestUpdate = <Intent extends t.Mixed>(int: Intent) => t.type({
  verb: t.literal("req:update"),
  tx: tTxId,
  intent: int,
});

export const tUpdate = <Effect extends t.Mixed>(eff: Effect) => t.type({
  verb: t.literal("update"),
  tx: t.union([t.null, tTxId]),
  effect: eff,
});

export const tUpdateReject = <UpdateError extends t.Mixed>(ue: UpdateError) => t.type({
  verb: t.literal("update-reject"),
  tx: tTxId,
  reason: ue,
});

////////////////////////////////////////////////////////////////////////////////

// protocol actions are special actions that interact with the engine but
// manipulate non-engine data. for now, just joins and parts

export const tJoin = t.type({
  verb: t.literal("user:join"),
  who: tUser,
});
export type Join = t.TypeOf<typeof tJoin>

export const tPart = t.type({
  verb: t.literal("user:part"),
  id: t.number,
});
export type Part = t.TypeOf<typeof tPart>

export const tProtocolAction = t.union([tJoin, tPart]);
export type ProtocolAction = Join | Part;

////////////////////////////////////////////////////////////////////////////////

export function tServerMessage<
  ClientState extends t.Mixed,
  Effect extends t.Mixed,
  UpdateError extends t.Mixed
> (cs: ClientState, eff: Effect, ue: UpdateError) {
  return t.union([
    tHello,
    tBye,
    tReset(cs),
    tUpdate(t.union([eff, tProtocolAction])),
    tUpdateReject(ue)
  ]);
}

export function tClientMessage<
  Intent extends t.Mixed
> (int: Intent) {
  return t.union([
    tRequestHello,
    tRequestBye,
    tRequestReset,
    tRequestUpdate(int)
  ]);
}

////////////////////////////////////////////////////////////////////////////////


