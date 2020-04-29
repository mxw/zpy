/*
 * Data structures and basic utilities for cards.
 *
 * This module "understands" all the properties of cards in ZPY (order, trump
 * suit, point values) but is completely blind to the mechanics of play (lead
 * suit, combos, etc.).
 */

import { array_fill } from 'utils/array.ts';
import { ansi } from 'utils/string.ts';

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

export function suit_to_symbol(suit: Suit): string {
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
export enum Rank {
  R2 = 2,
  R3 = 3,
  R4 = 4,
  R5 = 5,
  R6 = 6,
  R7 = 7,
  R8 = 8,
  R9 = 9,
  R10 = 10,
  J = 11,  // jack
  Q = 12,  // queen
  K = 13,  // king
  A = 14,  // ace
  N_off = 15,
  N_on  = 16,
  S = 17,  // small joker
  B = 18,  // big joker
}

export function rank_to_string(rank: Rank) {
  if (rank <= 10) return '' + rank;
  switch (rank) {
    case Rank.J: return 'J';
    case Rank.Q: return 'Q';
    case Rank.K: return 'K';
    case Rank.A: return 'A';
    case Rank.N_off: return 'n';
    case Rank.N_on: return 'N';
    case Rank.S: return 'w';
    case Rank.B: return 'W';
  }
}

/*
 * Trump selection for a round.
 *
 * Examples:
 *    (HEARTS, 2): normal round, rank 2, hearts trump
 *    (TRUMP, Rank.Q): joker override round on queens, natural trumps only
 *    (TRUMP, Rank.B): joker round, only joker trumps
 */
export class TrumpMeta {
  constructor(
    readonly suit: Suit,
    readonly rank: Rank,
  ) {}

  /*
   * Default TrumpMeta: jokers only.
   */
  static def(): TrumpMeta {
    return new TrumpMeta(Suit.TRUMP, Rank.B);
  }

  /*
   * Virtualize/devirtualize a (suit, rank) pair.
   */
  virt(suit: Suit, rank: Rank): [Suit, Rank] {
    return suit === this.suit
      ? (rank === this.rank && this.rank <= Rank.A
          ? [Suit.TRUMP, Rank.N_on]
          : [Suit.TRUMP, rank]
        )
      : (rank === this.rank && this.rank <= Rank.A
          ? [Suit.TRUMP, Rank.N_off]
          : [suit, rank]
        )
      ;
  }
  devirt(suit: Suit, rank: Rank, osnt_suit?: Suit): [Suit, Rank] {
    switch (rank) {
      case Rank.N_off:
        assert(typeof osnt_suit === 'number');
        return [osnt_suit, this.rank];
      case Rank.N_on:
        return [this.suit, this.rank];
      default: break;
    }
    return suit === Suit.TRUMP && rank < Rank.S
      ? [this.suit, rank]
      : [suit, rank];
  }

  /*
   * Increment a virtual rank within the domain of this trump selection.
   *
   * This will happily keep incrementing past joker.
   */
  inc_rank(rank: Rank): Rank {
    return rank + 1 === this.rank ? rank + 2 : rank + 1;
  }

  toString(color: boolean = false): string {
    return (new CardBase(this.suit, this.rank)).toString(color);
  }
}

/*
 * A standard ZPY-agnostic playing card.
 */
export class CardBase {
  constructor(
    readonly suit: Suit,
    readonly rank: Rank,
  ) {
    assert(CardBase.validate(suit, rank));
  }

  static readonly SUITS = [
    Suit.CLUBS,
    Suit.DIAMONDS,
    Suit.SPADES,
    Suit.HEARTS,
  ];

  static validate(suit: Suit, rank: Rank) {
    return (true
      // natural trumps are not valid
      && (rank !== Rank.N_off && rank !== Rank.N_on)
      // trump <=> joker
      && (suit !== Suit.TRUMP || rank >= Rank.S)
      && (!(rank >= Rank.S) || suit === Suit.TRUMP)
      // not trump <=> not joker
      && (suit === Suit.TRUMP || rank <= Rank.A)
      && (!(rank <= Rank.A) || suit !== Suit.TRUMP)
    );
  }

  static same(l: CardBase, r: CardBase): boolean {
    return l.suit === r.suit && l.rank === r.rank;
  }

  toString(color: boolean = false): string {
    let out = '';
    if (color) out += suit_to_color(this.suit);
    out += rank_to_string(this.rank) + suit_to_symbol(this.suit);
    if (color) out += ansi.RESET;
    return out;
  }

  /*
   * How many points is the card worth?
   */
  point_value(): number {
    switch (this.rank) {
      case 5:      return 5;
      case 10:     return 10;
      case Rank.K: return 10;
      default: break;
    }
    return 0;
  }
}

export function* gen_deck(): Generator<CardBase, void> {
  for (let suit of CardBase.SUITS) {
    for (let rank = 2; rank <= Rank.A; ++rank) {
      yield new CardBase(suit, rank);
    }
  }
  yield new CardBase(Suit.TRUMP, Rank.S);
  yield new CardBase(Suit.TRUMP, Rank.B);
}

/*
 * A ZPY-context-sensitive card.
 *
 * Essentially a raw playing card with "trumpiness" baked in.
 */
export class Card extends CardBase {
  readonly v_suit: Suit; // virtual (trump-aware) suit
  readonly v_rank: Rank; // virtual (trump-aware) rank

  constructor(suit: Suit, rank: Rank, tr: TrumpMeta) {
    super(suit, rank);
    [this.v_suit, this.v_rank] = tr.virt(suit, rank);
  }

  static from(cb: CardBase, tr: TrumpMeta): Card {
    return (cb instanceof Card) ? cb : new Card(cb.suit, cb.rank, tr);
  }

  /*
   * The underlying suit, only if this is an off-suit natural trump.
   */
  get osnt_suit(): Suit {
    return this.v_rank === Rank.N_off ? this.suit : undefined;
  }

  /*
   * Whether two cards are the literal same card.
   */
  static identical(l: Card, r: Card): boolean {
    return CardBase.same(l, r);
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
    if (l.v_suit === r.v_suit) return Math.sign(l.v_rank - r.v_rank);
    if (l.v_suit === Suit.TRUMP && r.v_suit !== Suit.TRUMP) return 1;
    if (l.v_suit !== Suit.TRUMP && r.v_suit === Suit.TRUMP) return -1;
    return null;
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
  #total: number = 0;     // total number of cards in pile
  #counts: number[];      // (v_suit, v_rank) -> count
  #counts_osnt: number[]; // suit -> count; for off-suit natural trumps
  #suit_counts: number[]; // v_suit -> count; per-suit totals
  #tr: TrumpMeta;

  // 13 slots for each non-trump suit, plus 17 trump rank slots (heh).
  private static readonly IND_MAX = 13 * 4 + Rank.B - 1;

  constructor(cards: Iterable<CardBase>, tr: TrumpMeta) {
    this.#counts = array_fill(CardPile.IND_MAX, 0);
    this.#suit_counts = array_fill(5, 0);
    this.#counts_osnt = array_fill(4, 0);
    this.#tr = tr;
    for (let cb of cards) this.insert(Card.from(cb, tr));
  }

  /*
   * Make and return a copy of `src`.
   */
  static copy(src: CardPile): CardPile {
    let dst = new CardPile([], src.tr);
    dst.#total = src.#total;
    dst.#counts = src.#counts.slice();
    dst.#suit_counts = src.#suit_counts.slice();
    dst.#counts_osnt = src.#counts_osnt.slice();
    dst.#tr = src.#tr;
    return dst;
  }

  /*
   * Generate (card, count) for every card in the pile.
   *
   * Guarantees that suits are contiguous and that no earlier card is greater
   * in value than a later card.  Note that this guarantee is not true in
   * general for methods named gen_counts() across lib/zpy/.
   */
  [Symbol.iterator](): Iterator<[Card, number]> {
    return this.gen_counts();
  }
  * gen_counts(): Generator<[Card, number], void> {
    for (let suit of CardBase.SUITS) {
      for (let rank = 2; rank <= Rank.A; ++rank) {
        let n = this.#counts[CardPile.index_of(suit, rank)];
        if (n > 0) yield [new Card(suit, rank, this.tr), n];
      }
    }
    for (let rank = 2; rank <= Rank.B; ++rank) {
      if (rank === Rank.N_off) {
        for (let suit of CardBase.SUITS) {
          let n = this.#counts_osnt[suit];
          if (n > 0) yield [new Card(suit, this.tr.rank, this.tr), n];
        }
      } else if (rank === Rank.N_on) {
        let n = this.#counts[CardPile.index_of(Suit.TRUMP, rank)];
        if (n > 0) yield [new Card(this.tr.suit, this.tr.rank, this.tr), n];
      } else {
        let n = this.#counts[CardPile.index_of(Suit.TRUMP, rank)];
        if (n > 0) {
          let suit = rank >= Rank.S ? Suit.TRUMP : this.tr.suit;
          yield [new Card(suit, rank, this.tr), n];
        }
      }
    }
  }

  /*
   * Splatty version of gen_counts().
   */
  * gen_cards(): Generator<Card, void> {
    for (let [card, n] of this.gen_counts()) {
      for (let i = 0; i < n; ++i) yield card;
    }
  }

  /*
   * Basic getters.
   */
  get tr(): TrumpMeta { return this.#tr; }
  get size(): number { return this.#total; }

  /*
   * Get, add to, or deduct from the count of `card` in `this`.
   */
  count(cb: CardBase): number {
    let c = Card.from(cb, this.#tr);
    return this.#counts[CardPile.index_of(c.v_suit, c.v_rank)];
  }
  insert(cb: CardBase, n: number = 1): void {
    let c = Card.from(cb, this.#tr);
    this.#total += n;
    this.#suit_counts[c.v_suit] += n;
    if (c.v_rank === Rank.N_off) {
      this.#counts_osnt[c.suit] += n;
    }
    this.#counts[CardPile.index_of(c.v_suit, c.v_rank)] += n;
  }
  remove(cb: CardBase, n: number = 1): void {
    let c = Card.from(cb, this.#tr);
    assert(this.count(c) >= n);
    this.#total -= n;
    this.#suit_counts[c.v_suit] -= n;
    if (c.v_rank === Rank.N_off) {
      this.#counts_osnt[c.suit] -= n;
    }
    this.#counts[CardPile.index_of(c.v_suit, c.v_rank)] -= n;
  }

  /*
   * Count of cards in each v_suit.
   */
  count_suit(v_suit: Suit): number {
    return this.#suit_counts[v_suit];
  }

  /*
   * Whether `this` contains all the cards in `other`.
   */
  contains(counts: Iterable<[Card, number]>): boolean {
    if (counts instanceof CardPile) {
      for (let [card, n] of counts) {
        if (this.count(card) < n) return false;
      }
      return true;
    }

    let gen_cards = function*() {
      for (let [card, n] of counts) {
        for (let i = 0; i < n; ++i) yield card;
      }
    }.bind(this);

    // we can't rely on uniqueness, so turn `counts` into a pile
    let other_pile = new CardPile(gen_cards(), this.tr);
    return this.contains(other_pile);
  }

  /*
   * Select a new trump for the pile.
   */
  rehash(tr: TrumpMeta): void {
    let idx_off = CardPile.index_of(Suit.TRUMP, Rank.N_off);
    let idx_on  = CardPile.index_of(Suit.TRUMP, Rank.N_on);

    if (this.tr.suit !== tr.suit && this.tr.suit !== Suit.TRUMP) {
      // move the old trump suit out of the trump slots
      this.#counts.copyWithin(
        this.tr.suit * 13,
        Suit.TRUMP * 13,
        (Suit.TRUMP + 1) * 13
      );
      this.#suit_counts[this.tr.suit] = this.#suit_counts[Suit.TRUMP];

      // adjust counts for jokers (we handle natural rank trumps below)
      let end = this.#counts.length;
      let bigs = this.#counts[end - 2];
      let smalls = this.#counts[end - 1];
      this.#suit_counts[this.tr.suit] -= (bigs + smalls);
      this.#suit_counts[Suit.TRUMP] = (bigs + smalls);
    }
    if (this.tr.rank <= Rank.A) {
      // move the old natural trumps back into their respective suits
      for (let suit = 0; suit < this.#counts_osnt.length; ++suit) {
        // off-suit natural trumps
        let idx = CardPile.index_of(suit, this.tr.rank);
        let n = this.#counts_osnt[suit];
        this.#counts[idx] = n;
        this.#counts_osnt[suit] = 0;
        this.#suit_counts[suit] += n;
        this.#suit_counts[this.tr.suit] -= n;
      }
      // on-suit natural trumps (and the off-suit slot)
      let idx = CardPile.index_of(this.tr.suit, this.tr.rank);
      this.#counts[idx] = this.#counts[idx_on];
      this.#counts[idx_off] = 0;
      this.#counts[idx_on] = 0;
    }

    if (this.tr.suit !== tr.suit) {
      if (tr.suit !== Suit.TRUMP) {
        // move the new trump suit into the trump slots
        this.#counts.copyWithin(
          Suit.TRUMP * 13,
          tr.suit * 13,
          (tr.suit + 1) * 13
        );
        for (let i = 0; i < 13; ++i) {
          this.#counts[tr.suit * 13 + i] = 0;
        }
        this.#suit_counts[Suit.TRUMP] += this.#suit_counts[tr.suit];
        this.#suit_counts[tr.suit] = 0;
      } else {
        for (let i = 0; i < 13; ++i) {
          this.#counts[Suit.TRUMP * 13 + i] = 0;
        }
      }
    }
    if (tr.rank <= Rank.A) {
      // move the new natural trumps into the trump suit
      for (let suit = 0; suit < this.#counts_osnt.length; ++suit) {
        if (suit === tr.suit) {
          // we already moved this into the trump range above
          let idx_tr = CardPile.index_of(Suit.TRUMP, tr.rank);
          this.#counts[idx_on] = this.#counts[idx_tr];
          this.#counts[idx_tr] = 0;
        } else {
          let idx = CardPile.index_of(suit, tr.rank);
          let n = this.#counts[idx];
          this.#counts_osnt[suit] = n;
          this.#counts[idx_off] += n;
          this.#suit_counts[Suit.TRUMP] += n;

          this.#counts[idx] = 0;
          this.#suit_counts[suit] -= n;
        }
      }
    }

    this.#tr = tr;
  }

  private static index_of(suit: Suit, rank: Rank): number {
    return suit * 13 + rank - 2;  // 1 for ace offset, 1 for 0-index
  }

  toString(color: boolean = false): string {
    let out: string = '';
    let suit: Suit = null;

    for (let card of this.gen_cards()) {
      if (suit !== card.v_suit) {
        if (suit !== null) out += '\n';
        suit = card.v_suit;

        if (color) out += suit_to_color(suit);
        out += suit_to_symbol(suit) + '[' + this.count_suit(suit) + ']:';
      }
      out += ' ' + card.toString(color);
    }
    if (color) out += ansi.RESET;

    return out;
  }
}
