/*
 * Engine interface wrapper for ZPY
 */

import * as P from 'protocol/protocol.ts';

import {
  Suit, Rank, TrumpMeta, CardBase, Card, CardPile
} from 'lib/cards.ts';
import {
  CardTuple, Tractor, Flight, Play, Hand
} from 'lib/trick.ts';
import { ZPY } from 'lib/zpy.ts';

import * as C from 'io-ts/lib/Codec';

import {strict as assert} from 'assert';

///////////////////////////////////////////////////////////////////////////////

export const Config = C.type({
  renege: P.Enum(ZPY.RenegeRule),
  rank: P.Enum(ZPY.RankSkipRule),
  kitty: P.Enum(ZPY.KittyMultiplierRule),
});
export type Config = ZPY.RuleModifiers;


const PlayerID = C.string;

const trivial = <L extends string> (literal: L) => C.type({
  action: C.literal(literal),
  args: C.tuple(PlayerID),
});

export const Action = C.sum('action')({
  'add_player': trivial('add_player' as const),
  'set_decks': C.type({
    action: C.literal('set_decks'),
    args: C.tuple(PlayerID, C.number),
  }),
  'start_game': trivial('start_game' as const),
});

export type State = ZPY;

///////////////////////////////////////////////////////////////////////////////

export const init = (options: Config): State => {
  return new ZPY(options);
};
