import * as t from 'io-ts';
import * as P from 'protocol/protocol.ts';

export const tConfig = t.nullType;
export type Config = t.TypeOf<typeof tConfig>;

export const tCardId = t.number;
export type CardId = number;

export const tCard = t.type({
  id: tCardId,
  card: t.string,
  x: t.number,
  y: t.number,
  holder: t.union([t.null, P.tUserId])
});
export type Card = t.TypeOf<typeof tCard>;

export const tState = t.type({
  cards: t.array(tCard)
});
export type State = t.TypeOf<typeof tState>;

export const tAction = t.union([
  t.type({
    verb: t.literal('grab'),
    actor: P.tUserId,
    target: tCardId,
  }),
  t.type({
    verb: t.literal('drop'),
    actor: P.tUserId,
    target: tCardId,
  }),
  t.type({
    verb: t.literal('move'),
    actor: P.tUserId,
    target: tCardId,
    x: t.number,
    y: t.number
  })
]);
export type Action = t.TypeOf<typeof tAction>;

export const tIntent = t.union([
  t.type({
    verb: t.literal('grab'),
    target: tCardId
  }),
  t.type({
    verb: t.literal('drop'),
    target: tCardId
  }),
  t.type({
    verb: t.literal('move'),
    target: tCardId,
    x: t.number,
    y: t.number
  }),
])
export type Intent = t.TypeOf<typeof tIntent>;

export const tEffect = tAction
export type Effect = Action

export const tClientState = tState
export type ClientState = State

export const tUpdateError = t.union([
  t.type({
    why: t.literal('already-held'),
    who: P.tUserId,
  }),
  t.type({
    why: t.literal('not-held'),
    target: tCardId,
  }),
  t.type({
    why: t.literal('nonsense')
  }),
])
export type UpdateError = t.TypeOf<typeof tUpdateError>;

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

export const listen = (state: State, intent: Intent, who: P.User) => {
  switch(intent.verb) {
    case 'grab':
    case 'drop':
      return {
        verb: intent.verb,
        target: intent.target,
        actor: who.id
      };
    case 'move':
      return {
        verb: intent.verb,
        actor: who.id,
        target: intent.target,
        x: intent.x,
        y: intent.y
      }
  }
}

export const apply = (state: State, act: Action | P.ProtocolAction): State | UpdateError => {
  switch (act.verb) {
    case 'user:join':
    case 'user:part':
      return state
    case 'grab': {
      let c = state.cards[act.target];
      if (c === null) {
        return {why: 'nonsense'};
      }
      if (c.holder === null) {
        c.holder = act.actor;
        return state;
      }
      return {why: 'already-held', who: c.holder};
    } break;
    case 'drop': {
      let c = state.cards[act.target];
      if (c === null) {
        return {why: 'nonsense'};
      }
      if (c.holder !== act.actor) {
        return {why: 'not-held', target: c.id};
      }
      c.holder = null;
      return state;
    } break;
    case 'move': {
      let c = state.cards[act.target];
      if (c === null) {
        return {why: 'nonsense'};
      }
      if (c.holder !== act.actor) {
        return {why: 'not-held', target: c.id};
      }
      c.x = act.x;
      c.y = act.y;
      return state;
    }
  }
}

export const predict = (state: ClientState, intent: Intent, me: P.User): Effect => {
  return redact_action(state, listen(state, intent, me), me)
}
export const apply_client = (state: ClientState, eff: Effect, me: P.User): ClientState | UpdateError => {
  return apply(state, eff);
}

export const redact = (s: State, who: P.User): ClientState => s;
export const redact_action = (s: State, a: Action, who: P.User): Effect => a;
