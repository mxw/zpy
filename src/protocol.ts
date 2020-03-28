// this file defines the protocol for communication between the clients and
// server and also the interface between the protocol-focused code and the
// game-focused code (see Engine below)

export type Version = number;
export type UserId = number;

export interface User {
  id: UserId;
  nick?: string;
};

////////////////////////////////////////////////////////////////////////////////

export interface RequestHello {
  verb: "req:hello";
  nick: string;
};

export interface Hello {
  verb: "hello";
  you: User;
};

export interface RequestBye {
  verb: "req:bye";
};

export interface Bye {
  verb: "bye";
};

////////////////////////////////////////////////////////////////////////////////

export interface RequestReset {
  verb: "req:reset";
};

export interface Reset<State> {
  verb: "reset";
  version: Version;
  state: State;
  who: User[];
};

////////////////////////////////////////////////////////////////////////////////

export interface RequestUpdate<Action> {
  verb: "req:update";
  base: Version;
  action: Action;
};

export interface Update<Action> {
  verb: "update";
  base: Version;
  action: Action;
};

export interface UpdateRejectReason {
  why: "invalid" | "outdated";
  remark?: string;
}

export interface UpdateReject {
  verb: "update-reject";
  base: Version;
  reason: UpdateRejectReason;
};

////////////////////////////////////////////////////////////////////////////////

// protocol actions are special actions that interact with the engine but
// manipulate non-engine data. for now, just joins and parts

export interface Join {
  verb: "user:join";
  who: User;
};

export interface Part {
  verb: "user:part";
  id: UserId;
};

export type ProtocolAction = Join | Part;

////////////////////////////////////////////////////////////////////////////////

export type ServerMessage<State, Action> =
  Hello |
  Bye |
  Reset<State> |
  Update<Action | ProtocolAction> |
  UpdateReject;

export type ClientMessage<State, Action> =
  RequestHello |
  RequestReset |
  RequestUpdate<Action> |
  RequestBye;

// the engine interface defines how the application being managed by the server
// deals with state transitions as users join, leave, and otherwise interact.
// it also encodes the way the game requieres information to be hidden.
//
// the types State and Action define the game state and possible transitions,
// respectively; while ClientState and ClientAction define the state and
// possible transitions as they are visible by a particular user.
//
// the functions redact and redactAction define the mapping from the
// globally-knowledgeable State and Action to their client-side counterparts.
// protocol actions should be viewed as if they redact to themselves.
//
// the functions apply and applyClient define the way that actions affect a
// given game state.
//
// in particular, this diagram commutes:
//
//  Action  --redactAction-->  ClientAction
//     |                            |
//     |                            |
//   apply                      clientApply
//     |                            |
//     v                            v
//  State  ------redact----->  ClientState
//
// that is, it should not matter if you redact and use clientApply or use apply
// and then redact--the results should be the same (though see below for a caveat)

export interface Engine<Config, State, Action, ClientState, ClientAction> {
  // generate the initial engine state
  init: (options: Config) => State;

  // compute the effect of an action on a given state or describe the reason why
  // the update is invalid, inapplicable, or otherwise problematic(TM)
  apply: (state: State, act: Action | ProtocolAction) => State | UpdateRejectReason;

  // same as apply, on the client side, except:
  //
  // returns null iff the resulting state is indeterminate based on information
  // available on the client--e.g. if the action is "draw card" and we need to
  // wait on the response of the server to discover that the result is "draw 4
  // of spades"
  applyClient: (state: ClientState, act: ClientAction | ProtocolAction) =>
    (ClientState | UpdateRejectReason | null);

  // redact a server-side state/action into a client-side state/action for the
  // given recipient
  redact: (state: State, who: User) => ClientState;
  redactAction: (state: Action, who: User) => ClientAction;
};

export type EngineConfig<E> =
  E extends Engine<infer CF, infer S, infer A, infer CS, infer CA> ? CF : any;
export type EngineState<E> =
  E extends Engine<infer CF, infer S, infer A, infer CS, infer CA> ? S : any;
export type EngineAction<E> =
  E extends Engine<infer CF, infer S, infer A, infer CS, infer CA> ? A : any;
export type EngineClientState<E> =
  E extends Engine<infer CF, infer S, infer A, infer CS, infer CA> ? CS : any;
export type EngineClientAction<E> =
  E extends Engine<infer CF, infer S, infer A, infer CS, infer CA> ? CA : any;
