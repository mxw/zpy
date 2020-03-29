export type Config = undefined;
export type State = number
export type Action = "add";
export type ClientState = State;
export type ClientAction = Action;

export namespace CounterEngine {
  export const init = (): State => {
    return 0;
  }

  export const apply = (state: State, act: Action): State => {
    return state + 1;
  }

  export const applyClient = apply

  export const redact = (s: State): ClientState => s;
  export const redactAction = (a: Action): ClientAction => a;
}
