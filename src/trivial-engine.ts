import * as t from 'io-ts';

export type Config = undefined;
export type State = number
export type Action = "add";
export type Intent = Action;
export type ClientState = State;
export type Effect = Action;

export namespace CounterEngine {

  export const tConfig = t.type({})
  export const tState = t.number
  export const tAction = t.literal("add")
  export const tIntent = tAction
  export const tEffect = tAction
  export const tClientState = tState
  export const tUpdateError = t.type({})

  export const init = (): State => {
    return 0;
  }

  export const listen = (state: State, intent: Intent) => {
    return intent;
  }

  export const apply = (state: State, act: Action) => {
    if (tAction.is(act)) {
      return state + 1;
    }
    return state;
  }

  export const predict = (state: ClientState, intent: Intent): Effect => {
    return redact_action(state, listen(state, intent))
  }
  export const apply_client = (state: ClientState, eff: Effect): ClientState => {
    return apply(state, eff);
  }

  export const redact = (s: State): ClientState => s;
  export const redact_action = (s: State, a: Action): Effect => a;
}
