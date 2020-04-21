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
} from 'lib/cards.ts';
import {
  CardTuple,
  Tractor,
  Flight,
  Toss,
  Play,
  Hand,
} from 'lib/trick.ts';

import { ZPY } from 'lib/zpy.ts';

import { Either } from 'fp-ts/lib/Either'
import * as C from 'io-ts/lib/Codec';
import * as D from 'io-ts/lib/Decoder';

import {strict as assert} from 'assert';

///////////////////////////////////////////////////////////////////////////////
/*
 * config codec.
 */

export const Config = C.type({
  renege: P.Enum<ZPY.RenegeRule>(ZPY.RenegeRule),
  rank: P.Enum<ZPY.RankSkipRule>(ZPY.RankSkipRule),
  kitty: P.Enum<ZPY.KittyMultiplierRule>(ZPY.KittyMultiplierRule),
});
export type Config = ZPY.RuleModifiers;

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
 * intent, action, and effect codecs.
 */

const PlayerID = C.string;

const trivial = <L extends string> (
  literal: L
): C.Codec<{motion: L, args: [string]}> => C.type({
  motion: C.literal(literal),
  args: C.tuple(PlayerID),
});

const card_arr = <L extends string> (
  literal: L
): C.Codec<{motion: L, args: [string, CardBase[]]}> => C.type({
  motion: C.literal(literal),
  args: C.tuple(PlayerID, C.array(cd_CardBase)),
});

namespace A {

export const add_player = trivial('add_player');

export const set_decks = C.type({
  motion: C.literal('set_decks'),
  args: C.tuple(PlayerID, C.number),
});

export const start_game = trivial('start_game');
export const init_game = C.type({
  motion: C.literal('init_game'),
  args: C.tuple(PlayerID, C.array(PlayerID)),
});

export const draw_card = trivial('draw_card');
export const add_to_hand = C.type({
  motion: C.literal('add_to_hand'),
  args: C.tuple(PlayerID, cd_CardBase),
});

export const bid_trump = C.type({
  motion: C.literal('bid_trump'),
  args: C.tuple(PlayerID, cd_CardBase, C.number),
});
export const secure_bid = C.type({
  motion: C.literal('secure_bid'),
  args: C.tuple(PlayerID, cd_CardBase, C.number),
});

export const request_redeal = trivial('request_redeal');
export const redeal = trivial('redeal');
export const ready = trivial('ready');

export const reveal_kitty = card_arr('reveal_kitty');
export const receive_kitty = card_arr('receive_kitty');
export const replace_kitty = card_arr('replace_kitty');

export const seal_hand = trivial('seal_hand');

export const call_friends = C.type({
  motion: C.literal('call_friends'),
  args: C.tuple(PlayerID, C.array(C.tuple(cd_CardBase, C.number))),
});

export const lead_play = (tr: TrumpMeta) => C.type({
  motion: C.literal('lead_play'),
  args: C.tuple(PlayerID, cd_Flight(tr)),
});
export const observe_lead = (tr: TrumpMeta) => C.type({
  motion: C.literal('observe_lead'),
  args: C.tuple(PlayerID, cd_Flight(tr)),
});

export const contest_fly = card_arr('contest_fly');
export const pass_contest = trivial('pass_contest');
export const reject_fly = (tr: TrumpMeta) => C.type({
  motion: C.literal('reject_fly'),
  args: C.tuple(PlayerID, C.array(cd_CardBase), cd_Flight(tr)),
});

export const follow_lead = (tr: TrumpMeta) => C.type({
  motion: C.literal('follow_lead'),
  args: C.tuple(PlayerID, cd_Play(tr)),
});
export const observe_follow = (tr: TrumpMeta) => C.type({
  motion: C.literal('observe_follow'),
  args: C.tuple(PlayerID, cd_Play(tr)),
});

export const end_round = trivial('end_round');
export const finish = card_arr('finish');

export const next_round = trivial('next_round');

}

export const Action = (tr: TrumpMeta) => C.sum('motion')({
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
  'end_round': A.end_round,
  'next_round': A.next_round,
});
const _Act = Action(new TrumpMeta(Suit.TRUMP, Rank.B));
export type Action = P.TypeOf<typeof _Act>;

export const Intent = Action;
export type Intent = Action;

export const Effect = (tr: TrumpMeta) => C.sum('motion')({
  'add_player': A.add_player,
  'set_decks': A.set_decks,
  'init_game': A.init_game,
  'add_to_hand': A.add_to_hand,
  'secure_bid': A.secure_bid,
  'redeal': A.redeal,
  //'pass': A.pass,
  'reveal_kitty': A.reveal_kitty,
  'receive_kitty': A.receive_kitty,
  'replace_kitty': A.replace_kitty,
  'seal_hand': A.seal_hand,
  'call_friends': A.call_friends,
  'lead_play': A.lead_play(tr),
  'observe_lead': A.observe_lead(tr),
  'reject_fly': A.reject_fly(tr),
  //'pass_contest': A.pass_contest,
  'follow_lead': A.follow_lead(tr),
  'observe_follow': A.observe_follow(tr),
  'end_round': A.end_round,
  'finish': A.finish,
  'next_round': A.next_round,
});

///////////////////////////////////////////////////////////////////////////////
/*
 * state codecs.
 */

export type State = ZPY;
export type ClientState = ZPY;

///////////////////////////////////////////////////////////////////////////////

export const init = (options: Config): State => {
  return new ZPY(options);
};
