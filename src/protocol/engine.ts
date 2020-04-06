import * as t from 'io-ts'

import {ProtocolAction, User} from 'protocol/protocol.ts'

// the engine interface defines how the application being managed by the server
// deals with state transitions as users join, leave, and otherwise interact.
// it also encodes the way the game requires information to be hidden.
//
// the types State and Action define the game state and possible transitions,
// respectively; while ClientState and ClientAction define the state and
// possible transitions as they are visible by a particular user.
//
// the functions redact and redact_action define the mapping from the
// globally-knowledgeable State and Action to their client-side counterparts.
// protocol actions should be viewed as if they redact to themselves.
//
// the functions apply and apply_client define the way that actions affect a
// given game state.
//
// in particular, this diagram commutes:
//
//  Intent
//     |    \
//     |     \
//  listen     predict
//     |               \____________
//     |                            |
//     v                            v
//  Action ----redact_action----> Effect
//     |                            |
//     |                            |
//   apply                     apply_client
//     |                            |
//     v                            v
//   State ------redact------> ClientState
//
// that is, it should not matter if you redact and use apply_client or use
// apply and then redact---the results should be the same (though see below for
// a caveat).

export interface Engine<
  Config,
  Intent,
  State,
  Action,
  ClientState,
  Effect,
  UpdateError
> {
  // reified nonsense for the type parameters:
  tConfig: t.Type<Config, Config, unknown>;
  tIntent: t.Type<Intent, Intent, unknown>;
  tState: t.Type<State, State, unknown>;
  tAction: t.Type<Action, Action, unknown>;
  tClientState: t.Type<ClientState, ClientState, unknown>;
  tEffect: t.Type<Effect, Effect, unknown>;
  tUpdateError: t.Type<UpdateError, UpdateError, unknown>;

  // generate the initial engine state
  init: (options: Config) => State;

  // lift a client-generated intent into an action that will be applied
  listen: (state: State, int: Intent) => Action | UpdateError;

  // compute the effect of an action on a given state or describe the reason why
  // the update is invalid, inapplicable, or otherwise problematic(TM)
  apply: (state: State, act: Action | ProtocolAction) => State | UpdateError;

  // predict the outcome of an intent based on the client state -- return null
  // if the outcome is unknown
  predict: (state: ClientState, int: Intent) => Effect | UpdateError | null;

  // same as apply, on the client side, except:
  //
  // returns null iff the resulting state is indeterminate based on information
  // available on the client--e.g. if the action is "draw card" and we need to
  // wait on the response of the server to discover that the result is "draw 4
  // of spades"
  apply_client: (state: ClientState, eff: Effect | ProtocolAction) =>
    ClientState | UpdateError | null;

  // redact a server-side state/action into a client-side state/action for the
  // given recipient
  redact: (state: State, who: User) => ClientState;
  redact_action: (state: State, act: Action, who: User) => Effect;
};
