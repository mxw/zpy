/*
 * Data structures and basic utilities for cards.
 *
 * This module "understands" all the properties of cards in ZPY (order, trump
 * suit, point values) but is completely blind to the mechanics of play (lead
 * suit, combos, etc.).
 */

import {ansi, array_fill} from './utils';

import {strict as assert} from 'assert';

/*
 * Card suit enum.
 */
export enum Suit {
  CLUBS = 0,
  DIAMONDS,
  SPADES,
  HEARTS,
  TRUMP,
}

function suit_to_symbol(suit: Suit): string {
  switch (suit) {
    case Suit.CLUBS: return '♣';
    case Suit.DIAMONDS: return '♦';
    case Suit.SPADES: return '♠';
    case Suit.HEARTS: return '♥';
    case Suit.TRUMP: return '☉';
  }
}

function suit_to_color(suit: Suit): string {
  switch (suit) {
    case Suit.CLUBS: return ansi.BLUE;
    case Suit.DIAMONDS: return ansi.RED;
    case Suit.SPADES: return ansi.BLUE;
    case Suit.HEARTS: return ansi.RED;
    case Suit.TRUMP: return ansi.YELLOW;
  }
}

/*
 * Card rank "enum".
 *
 * Face cards and higher only; just use the numbers for regular cards.
 *
 * Ranks corresponding to the off- and on-suit non-joker natural trumps are
 * included here.
 */
export const Rank = {
  J:     11,  // jack
  Q:     12,  // queen
  K:     13,  // king
  A:     14,  // ace
  N_off: 15,
  N_on:  16,
  S:     17,  // small joker
  B:     18,  // big joker
}

function rank_to_string(rank: number) {
  if (rank <= 10) return '' + rank;
  if (rank == Rank.J) return 'J';
  if (rank == Rank.Q) return 'Q';
  if (rank == Rank.K) return 'K';
  if (rank == Rank.A) return 'A';
  if (rank == Rank.N_off) return 'n';
  if (rank == Rank.N_on) return 'N';
  if (rank == Rank.S) return 'w';
  if (rank == Rank.B) return 'W';
}

/*
 * Trump selection for a round.
 *
 * Examples:
 *    (HEARTS, 2): normal round, rank 2, hearts trump
 *    (JOKER, Rank.Q): joker override round on queens, natural trumps only
 *    (JOKER, Rank.B): joker round, only joker trumps
 */
export class TrumpMeta {
  readonly suit: Suit;
  readonly rank: number;

  constructor(suit: Suit, rank: number) {
    this.suit = suit;
    this.rank = rank;
  }
}

/*
 * A standard ZPY-agnostic playing card.
 */
export class BoringCard {
  readonly suit: Suit;
  readonly rank: number;

  static readonly SUITS = [
    Suit.CLUBS,
    Suit.DIAMONDS,
    Suit.SPADES,
    Suit.HEARTS,
  ];

  constructor(suit: Suit, rank: number) {
    // natural trumps are not valid
    assert(rank !== Rank.N_off && rank !== Rank.N_on);
    // trump <=> joker
    assert(suit !== Suit.TRUMP || rank >= Rank.S);
    assert(!(rank >= Rank.S) || suit === Suit.TRUMP);
    // not trump <=> not joker
    assert(suit === Suit.TRUMP || rank <= Rank.A);
    assert(!(rank <= Rank.A) || suit !== Suit.TRUMP);

    this.suit = suit;
    this.rank = rank;
  }

  static same(l: BoringCard, r: BoringCard): boolean {
    return l.suit === r.suit && l.rank === r.rank;
  }

  toString(): string {
    return "" + rank_to_string(this.rank) + suit_to_symbol(this.suit);
  }
}

/*
 * A ZPY-context-sensitive card.
 *
 * Essentially a raw playing card with "trumpiness" baked in.
 */
export class Card {
  readonly card: BoringCard;
  readonly suit: Suit;    // effective (trump-aware) suit
  readonly rank: number;  // effective (trump-aware) rank

  constructor(suit: Suit, rank: number, tr: TrumpMeta) {
    this.card = new BoringCard(suit, rank);

    if (suit === tr.suit) {
      if (rank === tr.rank) {
        this.rank = Rank.N_on;
      } else {
        this.rank = rank;
      }
      this.suit = Suit.TRUMP;
    } else {
      if (rank === tr.rank) {
        this.suit = Suit.TRUMP;
        this.rank = Rank.N_off;
      } else {
        this.suit = suit;
        this.rank = rank;
      }
    }
  }

  /*
   * Whether two cards are the literal same card.
   */
  static identical(l: Card, r: Card): boolean {
    return BoringCard.same(l.card, r.card);
  }

  /*
   * Return negative if l < r, zero if l == r, positive if l > r.
   *
   * This function finds the winner in a two-card matchup.  If the cards are
   * incomparable in this sense (i.e., if they belong to two nonidentical
   * non-trump suits), null is returned instead.
   *
   * Note that cards that compare equal may not be identical (e.g., off-suit
   * natural trumps).
   */
  static compare(l: Card, r: Card): number | null {
    if (l.suit === r.suit) return Math.sign(l.rank - r.rank);
    if (l.suit === Suit.TRUMP && r.suit !== Suit.TRUMP) return 100;
    if (l.suit !== Suit.TRUMP && r.suit === Suit.TRUMP) return -100;
    return null;
  }

  /*
   * How many points is the card worth?
   */
  point_value(): number {
    switch (this.card.rank) {
      case 5:      return 5;
      case 10:     return 10;
      case Rank.K: return 10;
      default: break;
    }
    return 0;
  }
}

/*
 * Structured collection of cards.
 *
 * A pile of cards is represented as an array of counts.  Each valid Card has a
 * statically known position in this array.  This makes insertion and deletion
 * simple, but more importantly makes it very easy to find and validate combos.
 */
export class CardPile {
  #counts: number[];
  #osnt_counts: number[];  // counts for off-suit natural trumps
  #tr: TrumpMeta;

  // 13 slots for each non-trump suit, plus 17 trump rank slots (heh).
  private static readonly IND_MAX = 13 * 4 + Rank.B - 1;

  constructor(cards: BoringCard[], tr: TrumpMeta) {
    this.#counts = array_fill(CardPile.IND_MAX, 0);
    this.#osnt_counts = array_fill(4, 0);
    this.#tr = tr;

    for (let card of cards) {
      let c = new Card(card.suit, card.rank, tr);
      ++this.#counts[CardPile.index_of(c.suit, c.rank)];
      if (c.rank === Rank.N_off) ++this.#osnt_counts[c.card.suit];
    }
  }

  private * gen_cards(filter_fn?: Function): Generator<Card, void> {
    for (let suit of BoringCard.SUITS) {
      for (let rank = 2; rank <= Rank.A; ++rank) {
        let n = this.#counts[CardPile.index_of(suit, rank)];
        for (let i = 0; i < n; ++i) {
          yield new Card(suit, rank, this.#tr);
        }
      }
    }
    for (let rank = 2; rank <= Rank.B; ++rank) {
      if (rank === Rank.N_off) {
        for (let suit of BoringCard.SUITS) {
          let n = this.#osnt_counts[suit];
          for (let i = 0; i < n; ++i) {
            yield new Card(suit, this.#tr.rank, this.#tr);
          }
        }
      } else if (rank === Rank.N_on) {
        let n = this.#counts[CardPile.index_of(Suit.TRUMP, rank)];
        for (let i = 0; i < n; ++i) {
          yield new Card(this.#tr.suit, this.#tr.rank, this.#tr);
        }
      } else {
        let n = this.#counts[CardPile.index_of(Suit.TRUMP, rank)];
        for (let i = 0; i < n; ++i) {
          yield new Card(
            rank >= Rank.S ? Suit.TRUMP : this.#tr.suit,
            rank, this.#tr
          );
        }
      }
    }
  }

  private static index_of(suit: Suit, rank: number): number {
    return suit * 13 + rank - 2;  // 1 for ace offset, 1 for 0-index
  }

  toString(color: boolean = false): string {
    let out: string = '';
    let suit: Suit | null = null;

    for (let card of this.gen_cards()) {
      if (suit !== card.suit) {
        if (suit !== null) out += '\n';
        suit = card.suit;

        if (color) out += suit_to_color(suit);
        out += suit_to_symbol(suit) + ':';
      }
      if (suit === Suit.TRUMP) {
        if (color) out += suit_to_color(card.card.suit);
      }
      out += ' ' + card.card;
    }
    if (color) out += ansi.RESET;

    return out;
  }
}
