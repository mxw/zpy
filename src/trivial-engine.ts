export type Config = undefined;
export type State = number
export type Action = "add";
export type Intent = Action;
export type ClientState = State;
export type Effect = Action;

export namespace CounterEngine {
  export const init = (): State => {
    return 0;
  }

  export const listen = (state: State, intent: Intent) => {
    return intent;
  }

  export const apply = (state: State, act: Action) => {
    return state + 1;
  }

  export const predict = (state: ClientState, intent: Intent): Effect => {
    return redactAction(state, listen(state, intent))
  }
  export const applyClient = (state: ClientState, eff: Effect): ClientState => {
    return apply(state, eff);
  }

  export const redact = (s: State): ClientState => s;
  export const redactAction = (s: State, a: Action): Effect => a;
}
