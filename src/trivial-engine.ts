import * as P from 'protocol/protocol.ts';
import { Result, OK, Err, isErr } from 'utils/result.ts'

import * as C from 'io-ts/lib/Codec'

type TypeOf<T> = T extends C.Codec<infer A> ? A : never;

///////////////////////////////////////////////////////////////////////////////

export const Config = C.literal(null);
export type Config = TypeOf<typeof Config>;

export const CardID = C.number;
export type CardID = number;

export const Card = C.type({
  id: CardID,
  card: C.string,
  x: C.number,
  y: C.number,
  holder: C.nullable(P.UserID),
});
export type Card = TypeOf<typeof Card>;

export const State = C.type({
  cards: C.array(Card)
});
export type State = TypeOf<typeof State>;

export const ClientState = State;
export type ClientState = State;

export const Intent = C.sum('verb')({
  grab: C.type({
    verb: C.literal('grab'),
    target: CardID
  }),
  drop: C.type({
    verb: C.literal('drop'),
    target: CardID
  }),
  move: C.type({
    verb: C.literal('move'),
    target: CardID,
    x: C.number,
    y: C.number,
  }),
});
export type Intent = TypeOf<typeof Intent>;

const Action_ = C.sum('verb')({
  grab: C.type({
    verb: C.literal('grab'),
    actor: P.UserID,
    target: CardID,
  }),
  drop: C.type({
    verb: C.literal('drop'),
    actor: P.UserID,
    target: CardID,
  }),
  move: C.type({
    verb: C.literal('move'),
    actor: P.UserID,
    target: CardID,
    x: C.number,
    y: C.number,
  }),
});
export const Action = (s: State) => Action_;
export type Action = TypeOf<typeof Action_>;

export const Effect = Action;
export type Effect = Action;

export const UpdateError = C.sum('why')({
  'already-held': C.type({
    why: C.literal('already-held'),
    who: P.UserID,
  }),
  'not-held': C.type({
    why: C.literal('not-held'),
    target: CardID,
  }),
  nonsense: C.type({
    why: C.literal('nonsense')
  }),
});
export type UpdateError = TypeOf<typeof UpdateError>;

export const init = (): State => {
  return {cards: [{
    id: 0,
    card: "s3",
    x: 100,
    y: 100,
    holder: null
  },{
    id: 1,
    card: "dq",
    x: 120,
    y: 40,
    holder: null
  }]};
}

const listen = (
  state: State,
  intent: Intent,
  who: P.User
): Action => {
  switch(intent.verb) {
    case 'grab':
    case 'drop': return {
      verb: intent.verb,
      target: intent.target,
      actor: who.id,
    };
    case 'move': return {
      verb: intent.verb,
      actor: who.id,
      target: intent.target,
      x: intent.x,
      y: intent.y,
    };
  }
}

const apply = (
  state: State,
  act: Action | P.ProtocolAction
): Result<State, UpdateError> => {
  switch (act.verb) {
    case 'user:join':
    case 'user:part':
      return OK(state);

    case 'grab': {
      let c = state.cards[act.target];
      if (c === null) {
        return Err({why: 'nonsense'});
      }
      if (c.holder === null) {
        c.holder = act.actor;
        return OK(state);
      }
      return Err({why: 'already-held', who: c.holder});
    } break;

    case 'drop': {
      let c = state.cards[act.target];
      if (c === null) {
        return Err({why: 'nonsense'});
      }
      if (c.holder !== act.actor) {
        return Err({why: 'not-held', target: c.id});
      }
      c.holder = null;
      return OK(state);
    } break;

    case 'move': {
      let c = state.cards[act.target];
      if (c === null) {
        return Err({why: 'nonsense'});
      }
      if (c.holder !== act.actor) {
        return Err({why: 'not-held', target: c.id});
      }
      c.x = act.x;
      c.y = act.y;
      return OK(state);
    }
  }
}

export const larp = (
  state: State,
  intent: Intent,
  who: P.User,
  clients: P.User[],
): Result<
  [State, Record<P.UserID, Effect>],
  UpdateError
> => {
  let action = listen(state, intent, who);
  let result = apply(state, action);
  if (isErr(result)) return result;

  return OK([
    result.ok,
    Object.fromEntries(clients.map(u => [u.id, action]))
  ]);
};

export const predict = (
  state: ClientState,
  intent: Intent,
  me: P.User
): Result<Effect, UpdateError> => {
  return OK(listen(state, intent, me));
}
export const apply_client = (
  state: ClientState,
  eff: Effect,
  me: P.User
): Result<ClientState, UpdateError> => {
  return apply(state, eff);
}

export const redact = (s: State, who: P.User): ClientState => s;
