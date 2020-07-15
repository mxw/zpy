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

import { array_fill, o_map } from 'utils/array.ts'
import { Result, OK, Err } from 'utils/result.ts'
import { nth_suffixed } from 'utils/string.ts'

import * as C from 'io-ts/lib/Codec';
import * as D from 'io-ts/lib/Decoder';

import assert from 'utils/assert.ts'

///////////////////////////////////////////////////////////////////////////////
/*
 * config and error codecs.
 */

const cd_PartialConfig = C.partial({
  renege: P.Enum<ZPY.RenegeRule>(ZPY.RenegeRule),
  rank: P.Enum<ZPY.RankSkipRule>(ZPY.RankSkipRule),
  kitty: P.Enum<ZPY.KittyMultiplierRule>(ZPY.KittyMultiplierRule),
  hook: P.Enum<ZPY.JackHookRule>(ZPY.JackHookRule),
  info: P.Enum<ZPY.HiddenInfoRule>(ZPY.HiddenInfoRule),
  undo: P.Enum<ZPY.UndoPlayRule>(ZPY.UndoPlayRule),
  trash: P.Enum<ZPY.TrashKittyRule>(ZPY.TrashKittyRule),
  team: P.Enum<ZPY.TeamSelectRule>(ZPY.TeamSelectRule),
});
export const Config: C.Codec<ZPY.RuleModifiers> = C.make(
  D.parse(
    cd_PartialConfig,
    partial => P.success({...ZPY.default_rules, ...partial})
  ),
  {encode: (cfg: ZPY.RuleModifiers) => cd_PartialConfig.encode(cfg)}
);

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
    const tractor = new Tractor(shape, card, osnt_suit);
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
    const cd = cd_PL(tr);
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
  cur_idx: C.nullable(C.number),

  host: C.nullable(PlayerID),
  tr: C.nullable(cd_TrumpMeta),
  hands: C.record(cd_Hand(tr)),
  points: C.record(C.array(cd_CardBase)),
  friends: C.array(C.type({
    card: cd_CardBase,
    nth: C.number,
    tally: C.number,
  })),
  joins: C.number,
  host_team: P.set(PlayerID),
  atk_team: P.set(PlayerID),

  leader: C.nullable(PlayerID),
  lead: C.nullable(cd_Flight(tr)),
  plays: C.record(cd_Play(tr)),
  winning: C.nullable(PlayerID),
  joiners: P.set(PlayerID),
});
const cd_ZPY = (tr: TrumpMeta): C.Codec<ZPY<PlayerID>> => C.make(
  D.parse(cd_ZPYData(tr), data => P.success(ZPY.from<PlayerID>(data))),
  {encode: (zpy: ZPY<PlayerID>) => cd_ZPYData(tr).encode(zpy)}
);

export const State: C.Codec<State> = C.make(
  {decode: (u: unknown) => {
    return P.on_decode(
      C.type({tr: C.nullable(cd_TrumpMeta)}),
      u,
      (v: {tr: null | TrumpMeta}) => cd_ZPY(v.tr ?? TrumpMeta.def()).decode(u),
      e => D.failure(e)
    );
  }},
  {encode: (zpy: ZPY<PlayerID>) => cd_ZPY(zpy.tr ?? TrumpMeta.def()).encode(zpy)}
);

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
export const rm_player = trivial('rm_player');

export const set_decks = C.type({
  kind: C.literal('set_decks'),
  args: C.tuple(PlayerID, C.number),
});
export const set_rule_mods = C.type({
  kind: C.literal('set_rule_mods'),
  args: C.tuple(PlayerID, cd_PartialConfig),
});
export const set_rank = C.type({
  kind: C.literal('set_rank'),
  args: C.tuple(PlayerID, P.Enum<Rank>(Rank)),
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

export const undo_play = trivial('undo_play');
export const observe_undo = trivial('observe_undo');

export const collect_trick = trivial('collect_trick');

export const end_round = trivial('end_round');
export const finish = card_arr('finish');

export const next_ready = trivial('next_ready');
export const next_round = trivial('next_round');

}

const Intent_ = (tr: TrumpMeta) => C.sum('kind')({
  'add_player': A.add_player,
  'rm_player': A.rm_player,
  'set_decks': A.set_decks,
  'set_rule_mods': A.set_rule_mods,
  'set_rank': A.set_rank,
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
  'undo_play': A.undo_play,
  'collect_trick': A.collect_trick,
  'end_round': A.end_round,
  'next_ready': A.next_ready,
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
  'rm_player': A.rm_player,
  'set_decks': A.set_decks,
  'set_rule_mods': A.set_rule_mods,
  'set_rank': A.set_rank,
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
  'observe_undo': A.observe_undo,
  'collect_trick': A.collect_trick,
  'finish': A.finish,
  'next_ready': A.next_ready,
  'next_round': A.next_round,
});

const _E = Effect_(TrumpMeta.def());
export type Effect = P.TypeOf<typeof _E>;

export const Effect = (
  cs: null | ClientState
): C.Codec<Effect> => Effect_(cs?.tr ?? TrumpMeta.def());

///////////////////////////////////////////////////////////////////////////////
/*
 * stringification
 */

export const describe_effect = (
  eff: Effect,
  state: State | ClientState,
  users: P.User[],
  options?: {nick_only: boolean}
): string => {
  const name = (player: PlayerID) => {
    const user = users[player];
    return options?.nick_only ? user.nick : `${user.id} (${user.nick})`;
  };
  const agent = name(eff.args[0]);
  const tr = state.tr;

  switch (eff.kind) {
    case 'add_player':
      return `${agent} joined`;
    case 'rm_player':
      return `${agent} left`;
    case 'set_decks':
      return `${agent} set number of decks to ${eff.args[1]}`;
    case 'set_rule_mods':
      return `${agent} modified rules: ${o_map(
        eff.args[1],
        (k, v) => {
          switch (k) {
            case 'renege': return `${k} = ${ZPY.RenegeRule[v]}`;
            case 'rank': return `${k} = ${ZPY.RankSkipRule[v]}`;
            case 'kitty': return `${k} = ${ZPY.KittyMultiplierRule[v]}`;
            case 'hook': return `${k} = ${ZPY.JackHookRule[v]}`;
            case 'info': return `${k} = ${ZPY.HiddenInfoRule[v]}`;
            case 'undo': return `${k} = ${ZPY.UndoPlayRule[v]}`;
            case 'trash': return `${k} = ${ZPY.TrashKittyRule[v]}`;
            case 'team': return `${k} = ${ZPY.TeamSelectRule[v]}`;
          }
          return '';
        }
      ).map(s => s.toLowerCase().replace('_', '-')).join(',')}`;
    case 'set_rank':
      return `${agent} changed their rank to ${rank_to_string(eff.args[1])}`;
    case 'init_game':
      return 'game started';
    case 'add_to_hand':
      return `${agent} drew ${eff.args[1]?.toString() ?? ''}`.trim();
    case 'secure_bid':
      return `${agent} bid ${
        array_fill(eff.args[2], eff.args[1].toString()).join('')
      }`;
    case 'redeal':
      return `${agent} triggered a redeal`;
    case 'ready':
      return `${agent} is ready`;
    case 'install_host':
      return `${agent} begins their host`;
    case 'replace_kitty':
      return `${agent} discarded ${
        eff.args[1].map(cb => cb.toString()).join('')
      }`;
    case 'seal_hand':
      return `${agent} discarded their kitty`;
    case 'call_friends':
      return `${agent} called their friends: ${eff.args[1].map(
        ([cb, n]) => `${nth_suffixed(n)} ${cb.toString()}`
      ).join(', ')}`;
    case 'lead_play':
    case 'observe_lead':
      return `${agent} led with ${eff.args[1].toString(tr)}`;
    case 'reject_fly':
      return `${agent} countered with ${
        Play.extract(eff.args[1], tr).toString(tr)
      }`;
    case 'pass_contest':
      return `${agent} passed`;
    case 'follow_lead':
    case 'observe_follow':
      return `${agent} played ${eff.args[1].toString(tr)}`;
    case 'observe_undo':
      return `${agent} took back their play`;
    case 'collect_trick':
      return `${agent} collected their trick`;
    case 'finish':
      return `${agent} ended the game`;
    case 'next_ready':
      return `${agent} is ready for the next round`;
    case 'next_round':
      return 'round started';
  }
};

///////////////////////////////////////////////////////////////////////////////
/*
 * engine API
 */

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
      const result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'rm_player': {
      const result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'set_decks': {
      const result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'set_rule_mods': {
      const result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'set_rank': {
      const result = state[intent.kind](...intent.args);
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
      const result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'call_friends': {
      const result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'lead_play': {
      const result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'contest_fly': break;
    case 'pass_contest': break;
    case 'follow_lead': {
      const result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'undo_play': break;
    case 'collect_trick': {
      const result = state[intent.kind](...intent.args);
      return (result instanceof ZPY.Error)
        ? Err(result)
        : OK({effect: intent, state});
    }
    case 'end_round': break;
    case 'next_ready': break;
    case 'next_round': break;
  }
  return null;
};

export const translate = (
  state: State,
  pa: P.ProtocolAction,
  who: P.User,
): null | Intent => {
  switch (pa.verb) {
    case 'user:join': break;
    case 'user:rejoin': break;
    case 'user:nick': break;
    case 'user:part':
      if (state.phase !== ZPY.Phase.INIT &&
          state.phase !== ZPY.Phase.WAIT) {
        return null;
      }
      return {kind: 'rm_player', args: [who.id]};
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
  const effect = <L extends string, T extends readonly any[]>(
    literal: L,
    ...args: T
  ): {kind: L, args: {[K in keyof T]: T[K]}} => ({
    kind: literal,
    args: args
  });

  // send the same effect to everyone
  const everyone = (effect: Effect): Record<P.UserID, Effect> =>
    Object.fromEntries(clients.map(u => [u.id, effect]));

  // send a customized effect to each player
  const each = (effect: (p: P.UserID) => Effect): Record<P.UserID, Effect> =>
    Object.fromEntries(clients.map(u => [u.id, effect(u.id)]));

  // send `you` back to `who` and send `others` to everyone else
  const you_and_them = (you: Effect, them: Effect): Record<P.UserID, Effect> =>
    Object.assign(everyone(them), {[who.id]: you});

  const p = intent.args[0];

  switch (intent.kind) {
    case 'add_player': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'rm_player': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'set_decks': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'set_rule_mods': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'set_rank': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'start_game': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('init_game', p, ...result))]);
    }
    case 'draw_card': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, you_and_them(
        effect('add_to_hand', p, ...result),
        effect('add_to_hand', p, null)
      )]);
    }
    case 'bid_trump': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('secure_bid', p, ...result))]);
    }
    case 'request_redeal': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('redeal', p, ...result))]);
    }
    case 'ready': {
      const result = state[intent.kind](...intent.args);
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
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, you_and_them(
        intent, effect('seal_hand', p, ...result))]);
    }
    case 'call_friends': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'lead_play': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, you_and_them(
        intent, effect('observe_lead', p, ...result))]);
    }
    case 'contest_fly': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('reject_fly', p, ...result))]);
    }
    case 'pass_contest': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'follow_lead': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, you_and_them(
        intent, effect('observe_follow', p, ...result))]);
    }
    case 'undo_play': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('observe_undo', p, ...result))]);
    }
    case 'collect_trick': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'end_round': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(effect('finish', p, ...result))]);
    }
    case 'next_ready': {
      const result = state[intent.kind](...intent.args);
      if (result instanceof ZPY.Error) return Err(result);
      return OK([state, everyone(intent)]);
    }
    case 'next_round': {
      const result = state[intent.kind](...intent.args);
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
        case 'user:rejoin': return OK(state);
        case 'user:part': return OK(state);
        case 'user:nick': return OK(state);
      }
      break;
    }

    case 'engine': {
      const effect: Effect = command.effect;

      switch (effect.kind) {
        case 'add_player': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'rm_player': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'set_decks': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'set_rule_mods': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'set_rank': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'init_game': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'add_to_hand': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'secure_bid': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'redeal': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'ready': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'install_host': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'replace_kitty': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'seal_hand': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'call_friends': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'lead_play': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'observe_lead': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'reject_fly': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'pass_contest': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'follow_lead': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'observe_follow': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'observe_undo': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'collect_trick': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'finish': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'next_ready': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
        case 'next_round': {
          const result = state[effect.kind](...effect.args);
          return (result instanceof ZPY.Error) ? Err(result) : OK(state);
        }
      }
      break;
    }
  }
  assert(false);
};

export const redact = (state: State, who: P.User): ClientState => {
  return state.redact_for(who.id);
};
