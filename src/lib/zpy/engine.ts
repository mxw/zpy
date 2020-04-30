/*
 * Engine interface wrapper for ZPY
 */

import * as P from 'protocol/protocol.ts';

import {
  Suit,
  Rank,
  TrumpMeta,
  CardBase,
  Card,
  CardPile,
  suit_to_symbol,
  rank_to_string,
} from 'lib/zpy/cards.ts';
import {
  CardTuple,
  Tractor,
  Flight,
  Toss,
  Play,
  Hand,
} from 'lib/zpy/trick.ts';

import { ZPY, Data as ZPYData } from 'lib/zpy/zpy.ts';

import { Result, OK, Err } from 'utils/result.ts'

import { Either } from 'fp-ts/lib/Either'
import * as C from 'io-ts/lib/Codec';
import * as D from 'io-ts/lib/Decoder';

import {strict as assert} from 'assert';

///////////////////////////////////////////////////////////////////////////////
/*
 * config and error codecs.
 */

export const Config = C.type({
  renege: P.Enum<ZPY.RenegeRule>(ZPY.RenegeRule),
  rank: P.Enum<ZPY.RankSkipRule>(ZPY.RankSkipRule),
  kitty: P.Enum<ZPY.KittyMultiplierRule>(ZPY.KittyMultiplierRule),
});
export type Config = ZPY.RuleModifiers;

export type UpdateError = ZPY.Error;

const cd_UE = C.type({
  classname: C.string,
  msg: C.nullable(C.string),
});
export const UpdateError: C.Codec<ZPY.Error> = C.make(
  D.parse(cd_UE, ({classname, msg}) => {
    const result = (() => {
      switch (classname) {
        case 'bp': return new ZPY.BadPhaseError(msg);
        case 'ia': return new ZPY.InvalidArgError(msg);
        case 'da': return new ZPY.DuplicateActionError(msg);
        case 'wp': return new ZPY.WrongPlayerError(msg);
        case 'ot': return new ZPY.OutOfTurnError(msg);
        case 'ip': return new ZPY.InvalidPlayError(msg);
        case 'e': return new ZPY.Error(msg);
        default: break;
      }
      return null;
    })();
    return result !== null
      ? P.success(result)
      : P.failure(`invalid Error class ${classname}`)
  }),
  {encode: (e: ZPY.Error) => cd_UE.encode({
    classname: ((e) => {
      if (e instanceof ZPY.BadPhaseError) return 'bp';
      if (e instanceof ZPY.InvalidArgError) return 'ia';
      if (e instanceof ZPY.DuplicateActionError) return 'da';
      if (e instanceof ZPY.WrongPlayerError) return 'wp';
      if (e instanceof ZPY.OutOfTurnError) return 'ot';
      if (e instanceof ZPY.InvalidPlayError) return 'ip';
      return 'e';
    })(e),
    msg: e.msg || null
  })}
);

///////////////////////////////////////////////////////////////////////////////
/*
 * card and trick codecs.
 */

const cd_CB = C.type({
  suit: P.Enum<Suit>(Suit),
  rank: P.Enum<Rank>(Rank),
});
const cd_CardBase: C.Codec<CardBase> = C.make(
  D.parse(cd_CB, ({suit, rank}) => CardBase.validate(suit, rank)
    ? P.success(new CardBase(suit, rank))
    : P.failure(
      `invalid card ${suit_to_symbol(suit)}${rank_to_string(rank)}`
    )
  ),
  {encode: (cb: CardBase) => cd_CB.encode(cb)}
);
const cd_TrumpMeta: C.Codec<TrumpMeta> = C.make(
  D.parse(cd_CB, ({suit, rank}) => P.success(new TrumpMeta(suit, rank))),
  {encode: (tr: TrumpMeta) => cd_CB.encode(tr)}
);

const cd_Card = (tr: TrumpMeta): C.Codec<Card> => C.make(
  D.parse(cd_CardBase, (cb) => P.success(new Card(cb.suit, cb.rank, tr))),
  {encode: (c: Card) => cd_CardBase.encode(c)}
);

const cd_CT = (tr: TrumpMeta) => C.type({
  card: cd_Card(tr),
  arity: C.number,
});
const cd_CardTuple = (tr: TrumpMeta): C.Codec<CardTuple> => C.make(
  D.parse(cd_CT(tr), ({card, arity}) => arity > 0
    ? P.success(new CardTuple(card, arity))
    : P.failure(`invalid tuple arity ${arity}`)
  ),
  {encode: (t: CardTuple) => cd_CT(tr).encode(t)}
);

const cd_TS = C.type({len: C.number, arity: C.number});
const cd_Shape: C.Codec<Tractor.Shape> = C.make(
  D.parse(cd_TS, ({len, arity}) => len > 0 && arity > 0
    ? P.success(new Tractor.Shape(len, arity))
    : P.failure(`invalid tractor shape (${len},${arity})`)
  ),
  {encode: (sh: Tractor.Shape) => cd_TS.encode(sh)}
);

const cd_TR = (tr: TrumpMeta) => C.intersection(
  C.type({
    shape: cd_Shape,
    card: cd_Card(tr),
  }),
  C.partial({
    osnt_suit: P.Enum<Suit>(Suit),
  }),
);
const cd_Tractor = (tr: TrumpMeta): C.Codec<Tractor> => C.make(
  D.parse(cd_TR(tr), ({shape, card, osnt_suit}) => {
    let tractor = new Tractor(shape, card, osnt_suit);
    return tractor.validate(tr)
      ? P.success(tractor)
      : P.failure(`invalid ${shape.toString()}-tractor at ${card.toString()}`);
  }),
  {encode: (trc: Tractor) => cd_TR(tr).encode(trc)}
);

const cd_Flight = (tr: TrumpMeta): C.Codec<Flight> => C.make(
  D.parse(
    C.array(cd_Tractor(tr)),
    (tractors: Tractor[]) => Flight.validate(tractors)
      ? P.success(new Flight(tractors))
      : P.failure(`invalid flight`)
  ),
  {encode: (fl: Flight) => C.array(cd_Tractor(tr)).encode(fl.tractors)}
);

const cd_Toss: C.Codec<Toss> = C.make(
  D.parse(
    C.array(cd_CardBase),
    (cards: CardBase[]) => cards.length > 0
      ? P.success(new Toss(cards))
      : P.failure(`invalid empty toss`)
  ),
  {encode: (ts: Toss) => C.array(cd_CardBase).encode(ts.cards)}
);

const cd_PL = (tr: TrumpMeta) => C.sum('proto')({
  'Flight': C.type({
    proto: C.literal('Flight'),
    play: cd_Flight(tr),
  }),
  'Toss': C.type({
    proto: C.literal('Toss'),
    play: cd_Toss,
  }),
});
const cd_Play = (tr: TrumpMeta): C.Codec<Play> => C.make(
  D.parse(
    cd_PL(tr),
    (d: {proto: 'Flight' | 'Toss', play: Flight | Toss}) => P.success(d.play)
  ),
  {encode: (pl: Play) => {
    let cd = cd_PL(tr);
    if (pl.fl()) return cd.encode({proto: 'Flight', play: pl.fl()});
    if (pl.ts()) return cd.encode({proto: 'Toss', play: pl.ts()});
    assert(false);
  }}
);

const cd_CardPile = (tr: TrumpMeta): C.Codec<CardPile> => C.make(
  D.parse(
    C.array(cd_CardBase),
    (cards: CardBase[]) => P.success(new CardPile(cards, tr))
  ),
  {encode: (pile: CardPile) =>
    C.array(cd_CardBase).encode(Array.from(pile.gen_cards()))
  }
);

const cd_Hand = (tr: TrumpMeta): C.Codec<Hand> => C.make(
  D.parse(cd_CardPile(tr), (pile: CardPile) => P.success(new Hand(pile))),
  {encode: (hand: Hand) => cd_CardPile(tr).encode(hand.pile)}
);

///////////////////////////////////////////////////////////////////////////////
/*
 * state codecs.
 */

const PlayerID = P.UserID;
type PlayerID = P.UserID;

export type State = ZPY<PlayerID>;
export type ClientState = ZPY<PlayerID>;

const cd_ZPYData = (
  tr: TrumpMeta
): C.Codec<ZPYData.Type<PlayerID>> => C.type({
  phase: P.Enum<ZPY.Phase>(ZPY.Phase),
  rules: Config,
  identity: C.nullable(PlayerID),

  owner: C.nullable(PlayerID),
  players: C.array(PlayerID),
  ranks: C.record(C.type({
    rank: P.Enum<Rank>(Rank),
    start: P.Enum<Rank>(Rank),
    last_host: C.nullable(P.Enum<Rank>(Rank)),
  })),
  ndecks: C.number,

  round: C.number,
  order: C.record(C.number),
  consensus: P.set(PlayerID),

  deck: C.array(cd_CardBase),
  deck_sz: C.number,
  kitty: C.array(cd_CardBase),
  bids: C.array(C.type({
    player: PlayerID,
    card: cd_CardBase,
    n: C.number,
  })),
  draws: C.record(cd_CardPile(tr)),
  current: C.nullable(C.number),

  host: C.nullable(PlayerID),
  tr: C.nullable(cd_TrumpMeta),
  hands: C.record(cd_Hand(tr)),
  points: C.record(C.array(cd_CardBase)),
  friends: C.array(C.type({
    card: cd_CardBase,
    nth: C.number,
  })),
  joins: C.number,
  host_team: P.set(PlayerID),
  atk_team: P.set(PlayerID),

  leader: C.nullable(PlayerID),
  lead: C.nullable(cd_Flight(tr)),
  plays: C.record(cd_Play(tr)),
  winning: C.nullable(PlayerID),
});
const cd_ZPY = (tr: TrumpMeta): C.Codec<ZPY<PlayerID>> => C.make(
  D.parse(cd_ZPYData(tr), data => P.success(ZPY.from<PlayerID>(data))),
  {encode: (zpy: ZPY<PlayerID>) => cd_ZPYData(tr).encode(zpy)}
);

export const State = (
  s: null | State
): C.Codec<State> => cd_ZPY(s?.tr ?? TrumpMeta.def());

export const ClientState = State;

///////////////////////////////////////////////////////////////////////////////
/*
 * intent and effect codecs.
 */

const trivial = <L extends string> (
  literal: L
): C.Codec<{kind: L, args: [PlayerID]}> => C.type({
  kind: C.literal(literal),
  args: C.tuple(PlayerID),
});

const card_arr = <L extends string> (
  literal: L
): C.Codec<{kind: L, args: [PlayerID, CardBase[]]}> => C.type({
  kind: C.literal(literal),
  args: C.tuple(PlayerID, C.array(cd_CardBase)),
});

namespace A {

export const add_player = trivial('add_player');

export const set_decks = C.type({
  kind: C.literal('set_decks'),
  args: C.tuple(PlayerID, C.number),
});

export const start_game = trivial('start_game');
export const init_game = C.type({
  kind: C.literal('init_game'),
  args: C.tuple(PlayerID, C.array(PlayerID)),
});

export const draw_card = trivial('draw_card');
export const add_to_hand = C.type({
  kind: C.literal('add_to_hand'),
  args: C.tuple(PlayerID, C.nullable(cd_CardBase)),
});

export const bid_trump = C.type({
  kind: C.literal('bid_trump'),
  args: C.tuple(PlayerID, cd_CardBase, C.number),
});
export const secure_bid = C.type({
  kind: C.literal('secure_bid'),
  args: C.tuple(PlayerID, cd_CardBase, C.number),
});

export const request_redeal = trivial('request_redeal');
export const redeal = trivial('redeal');

export const ready = trivial('ready');
export const install_host = card_arr('install_host');

export const replace_kitty = card_arr('replace_kitty');
export const seal_hand = trivial('seal_hand');

export const call_friends = C.type({
  kind: C.literal('call_friends'),
  args: C.tuple(PlayerID, C.array(C.tuple(cd_CardBase, C.number))),
});

export const lead_play = (tr: TrumpMeta) => C.type({
  kind: C.literal('lead_play'),
  args: C.tuple(PlayerID, cd_Flight(tr)),
});
export const observe_lead = (tr: TrumpMeta) => C.type({
  kind: C.literal('observe_lead'),
  args: C.tuple(PlayerID, cd_Flight(tr)),
});

export const contest_fly = card_arr('contest_fly');
export const pass_contest = trivial('pass_contest');
export const reject_fly = (tr: TrumpMeta) => C.type({
  kind: C.literal('reject_fly'),
  args: C.tuple(PlayerID, C.array(cd_CardBase), cd_Tractor(tr)),
});

export const follow_lead = (tr: TrumpMeta) => C.type({
  kind: C.literal('follow_lead'),
  args: C.tuple(PlayerID, cd_Play(tr)),
});
export const observe_follow = (tr: TrumpMeta) => C.type({
  kind: C.literal('observe_follow'),
  args: C.tuple(PlayerID, cd_Play(tr)),
});

export const collect_trick = trivial('collect_trick');

export const end_round = trivial('end_round');
export const finish = card_arr('finish');

export const next_round = trivial('next_round');

}

const Intent_ = (tr: TrumpMeta) => C.sum('kind')({
  'add_player': A.add_player,
  'set_decks': A.set_decks,
  'start_game': A.start_game,
  'draw_card': A.draw_card,
  'bid_trump': A.bid_trump,
  'request_redeal': A.request_redeal,
  'ready': A.ready,
  'replace_kitty': A.replace_kitty,
  'call_friends': A.call_friends,
  'lead_play': A.lead_play(tr),
  'contest_fly': A.contest_fly,
  'pass_contest': A.pass_contest,
  'follow_lead': A.follow_lead(tr),
  'collect_trick': A.collect_trick,
  'end_round': A.end_round,
  'next_round': A.next_round,
});

const _I = Intent_(TrumpMeta.def());
export type Intent = P.TypeOf<typeof _I>;

export const Intent = (
  s: null | State
): C.Codec<Intent> => Intent_(s?.tr ?? TrumpMeta.def());

export const Action = Intent;
export type Action = Intent;

const Effect_ = (tr: TrumpMeta) => C.sum('kind')({
  'add_player': A.add_player,
  'set_decks': A.set_decks,
  'init_game': A.init_game,
  'add_to_hand': A.add_to_hand,
  'secure_bid': A.secure_bid,
  'redeal': A.redeal,
  'ready': A.ready,
  'install_host': A.install_host,
  'replace_kitty': A.replace_kitty,
  'seal_hand': A.seal_hand,
  'call_friends': A.call_friends,
  'lead_play': A.lead_play(tr),
  'observe_lead': A.observe_lead(tr),
  'reject_fly': A.reject_fly(tr),
  'pass_contest': A.pass_contest,
  'follow_lead': A.follow_lead(tr),
  'observe_follow': A.observe_follow(tr),
  'collect_trick': A.collect_trick,
  'finish': A.finish,
  'next_round': A.next_round,
});

const _E = Effect_(TrumpMeta.def());
export type Effect = P.TypeOf<typeof _E>;

export const Effect = (
  cs: null | ClientState
): C.Codec<Effect> => Effect_(cs?.tr ?? TrumpMeta.def());

///////////////////////////////////////////////////////////////////////////////

export const init = (options: Config): State => {
  return new ZPY<PlayerID>(options);
};

export const predict = (
  state: ClientState,
  intent: Intent,
  me: P.User,
): null | Result<{effect: Effect, state: ClientState}, UpdateError> => {
  switch (intent.kind) {
    case 'add_player': {
      let result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'set_decks': {
      let result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'start_game': break;
    case 'draw_card': break;
    case 'bid_trump': break;
    case 'request_redeal': break;
    case 'ready': break;
    case 'replace_kitty': {
      let result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'call_friends': {
      let result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'lead_play': {
      let result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'contest_fly': break;
    case 'pass_contest': break;
    case 'follow_lead': {
      let result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'collect_trick': {
      let result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'end_round': break;
    case 'next_round': break;
  }
  return null;
};

export const larp = (
  state: State,
  intent: Intent,
  who: P.User,
  clients: P.User[]
): Result<
  [State, Record<P.UserID, Effect>],
  UpdateError
> => {
  // convenience helper for making an effect
  let effect = <L extends string, T extends readonly any[]>(
    literal: L,
    ...args: T
  ): {kind: L, args: {[K in keyof T]: T[K]}} => ({
    kind: literal,
    args: args
  });

  // send the same effect to everyone
  let everyone = (effect: Effect): Record<P.UserID, Effect> =>
    Object.fromEntries(clients.map(u => [u.id, effect]));

  // send a customized effect to each player
  let each = (effect: (p: P.UserID) => Effect): Record<P.UserID, Effect> =>
    Object.fromEntries(clients.map(u => [u.id, effect(u.id)]));

  // send `you` back to `who` and send `others` to everyone else
  let you_and_them = (you: Effect, them: Effect): Record<P.UserID, Effect> =>
    Object.assign(everyone(them), {[who.id]: you});

  let p = intent.args[0];

  switch (intent.kind) {
    case 'add_player': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'set_decks': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'start_game': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('init_game', p, ...result))]);
    }
    case 'draw_card': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, you_and_them(
        effect('add_to_hand', p, ...result),
        effect('add_to_hand', p, null)
      )]);
    }
    case 'bid_trump': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('secure_bid', p, ...result))]);
    }
    case 'request_redeal': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('redeal', p, ...result))]);
    }
    case 'ready': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, result === null
        ? everyone(effect('ready', p))
        : each((p: P.UserID) => effect(
            'install_host',
            ...state.redact_kitty_for(p, ...(result as [PlayerID, CardBase[]]))
          ))
      ]);
    }
    case 'replace_kitty': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, you_and_them(
        intent, effect('seal_hand', p, ...result))]);
    }
    case 'call_friends': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'lead_play': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, you_and_them(
        intent, effect('observe_lead', p, ...result))]);
    }
    case 'contest_fly': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('reject_fly', p, ...result))]);
    }
    case 'pass_contest': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'follow_lead': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, you_and_them(
        intent, effect('observe_follow', p, ...result))]);
    }
    case 'collect_trick': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'end_round': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('finish', p, ...result))]);
    }
    case 'next_round': {
      let result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
  }
};

export const apply_client = (
  state: ClientState,
  command: P.Command<Effect>,
  me: P.User,
): Result<ClientState, UpdateError> => {
  switch (command.kind) {
    case 'protocol': {
      const pa: P.ProtocolAction = command.effect;

      switch (pa.verb) {
        case 'user:join': return OK(state);
        case 'user:part': return OK(state);
      }
      return Err(new ZPY.Error('protocol actions not implemented'));
    }

    case 'engine': {
      const effect: Effect = command.effect;

      switch (effect.kind) {
        case 'add_player': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'set_decks': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'init_game': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'add_to_hand': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'secure_bid': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'redeal': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'ready': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'install_host': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'replace_kitty': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'seal_hand': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'call_friends': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'lead_play': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'observe_lead': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'reject_fly': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'pass_contest': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'follow_lead': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'observe_follow': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'collect_trick': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'finish': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'next_round': {
          let result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
      }
    }
  }
};

export const redact = (state: State, who: P.User): ClientState => {
  return state.redact_for(who.id);
};
