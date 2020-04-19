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
): C.Codec<{action: L, args: [string]}> => C.type({
  action: C.literal(literal),
  args: C.tuple(PlayerID),
});

const card_arr = <L extends string> (
  literal: L
): C.Codec<{action: L, args: [string, CardBase[]]}> => C.type({
  action: C.literal(literal),
  args: C.tuple(PlayerID, C.array(cd_CardBase)),
});

export const Action = (tr: TrumpMeta) => C.sum('action')({
  'add_player': trivial('add_player'),
  'set_decks': C.type({
    action: C.literal('set_decks'),
    args: C.tuple(PlayerID, C.number),
  }),
  'start_game': trivial('start_game'),
  'draw_card': trivial('draw_card'),
  'bid_trump': C.type({
    action: C.literal('bid_trump'),
    args: C.tuple(PlayerID, cd_CardBase, C.number),
  }),
  'request_redeal': trivial('request_redeal'),
  'ready': trivial('ready'),
  'replace_kitty': card_arr('replace_kitty'),
  'call_friends': C.type({
    action: C.literal('call_friends'),
    args: C.tuple(PlayerID, C.array(C.tuple(cd_CardBase, C.number))),
  }),
  'lead_play': C.type({
    action: C.literal('lead_play'),
    args: C.tuple(PlayerID, cd_Flight(tr)),
  }),
  'contest_fly': card_arr('contest_fly'),
  'pass_contest': trivial('pass_contest'),
  'follow_lead': C.type({
    action: C.literal('follow_lead'),
    args: C.tuple(PlayerID, cd_Play(tr)),
  }),
  'start_round': trivial('start_round'),
});
export type Action = P.TypeOf<typeof Action>;

export const Intent = Action;
export type Intent = Action;

///////////////////////////////////////////////////////////////////////////////
/*
 * state codecs.
 */

export type State = ZPY;

///////////////////////////////////////////////////////////////////////////////

export const init = (options: Config): State => {
  return new ZPY(options);
};
