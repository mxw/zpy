/*
 * Rules engine for tricks.
 *
 * This module deals with all aspects of trick-taking (tuples, tractors,
 * flights, as well as lead-following).  It implements the data structures,
 * validation, and win determination, as well as the constraints that a lead
 * play imposes on other players' hands.
 *
 * It is agnostic to all gameplay outside of a single trick.
 */

import {
  Suit, Rank, TrumpMeta, CardBase, Card, CardPile
} from './cards';

import {ansi, array_fill} from './utils';

import {strict as assert} from 'assert';

/*
 * The most basic unit of play: N copies of one card.
 *
 * The denerate case is the 1-tuple, a single card.
 */
export class CardTuple {
  readonly card: Card;
  readonly arity: number;

  constructor(card: Card, arity: number) {
    assert(arity > 0);
    this.card = card;
    this.arity = arity;
  }

  /*
   * Spaceship-style comparator.
   *
   * Return null if `l` and `r` are incomparable (e.g., if they have different
   * arity).
   */
  static compare(l: CardTuple, r: CardTuple): number | null {
    if (l.arity !== r.arity) return null;
    return Card.compare(l.card, r.card);
  }

  toString(color: boolean = false): string {
    return array_fill(this.arity, this.card.toString(color)).join('');
  }
}

/*
 * A contiguous sequence of tuples.
 *
 * The degenerate case is the (1,n)-tractor, a single n-tuple.
 */
export class Tractor {
  readonly tuples: CardTuple[];

  constructor(tuples: CardTuple[]) {
    assert(tuples.length > 0);
    assert(tuples.every(t => t.card.v_suit === tuples[0].card.v_suit));
    assert(tuples.every(t => t.arity === tuples[0].arity));

    this.tuples = tuples.sort((l, r) => CardTuple.compare(l, r));
  }

  /*
   * Spaceship-style comparator.
   *
   * Return null if `l` and `r` are incomparable (e.g., if they have different
   * length or their tuples have different arity).
   */
  static compare(l: Tractor, r: Tractor): number | null {
    if (l.tuples.length !== r.tuples.length) return null;
    return CardTuple.compare(l.tuples[0], r.tuples[0]);
  }

  toString(tr: TrumpMeta, color: boolean = false): string {
    return this.tuples.map(t => t.toString(color)).join('');
  }
}

/*
 * An arbitrary collection of tractors.
 *
 * The tractors in a flight are sorted by precedence order, which is a
 * descending lexicographic sort on (arity, len).  This is the order in which
 * the components of the flight impose constraints on another player's hand.
 *
 * For simplicity, all plays are considered a flight, even if it's often
 * degenerate (i.e., a single (n,m)-tractor).
 */
export class Flight {
  readonly tractors: Tractor[];
  readonly total: number;

  private constructor(tractors: Tractor[], total: number) {
    assert(tractors.length > 0);

    this.tractors = tractors.sort((l, r) => {
      let arity_cmp = Math.sign(l.tuples[0].arity - r.tuples[0].arity);
      if (arity_cmp !== 0) return -arity_cmp;

      let len_cmp = Math.sign(l.tuples.length - r.tuples.length);
      if (len_cmp !== 0) return -len_cmp;

      return -Tractor.compare(l, r);
    });
    this.total = total;
  }

  /*
   * Whether `this` beats `other`, assuming `this` has turn-order precedence.
   */
  beats(other: Flight): boolean {
    assert(this.total === other.total);

    // A flight must have the same structure...
    if (this.tractors.length !== other.tractors.length) return true;

    // ...and compare stricly greater in every component.
    for (let i = 0; i < this.tractors.length; ++i) {
      let cmp = Tractor.compare(this.tractors[i], other.tractors[i]);
      if (cmp === null || cmp >= 0) return true;
    }
    return false;
  }

  /*
   * Greedily construct a flight from a bunch of cards.
   *
   * The heuristic here prefers taller tractors to longer ones.  That means
   * that a play of 22333444 gets correctly (well, for most situations) parsed
   * as [333444][22].  However, a play like 556666777788 gets parsed as
   * [66667777][88][55], which may not be what's intended.
   *
   * That said, the latter situation is very unlikely, and this will probably
   * predict the player's intent in most cases.
   */
  static extract(cards: Card[], tr: TrumpMeta): Flight {
    assert(cards.length > 0);
    assert(cards.every(c => c.v_suit === cards[0].v_suit));

    let pile = new CardPile(cards, tr);
    let chunks : CardTuple[][] = [[]];

    for (let [card, arity] of pile.gen_counts()) {
      let cur_chunk = chunks[chunks.length - 1];
      let prev = cur_chunk[cur_chunk.length - 1];

      let should_continue = !prev ||
        (arity !== 1 && prev.arity !== 1 &&
         tr.inc_rank(prev.card.v_rank) === card.v_rank);

      if (!should_continue) {
        cur_chunk = [];
        chunks.push(cur_chunk);
      }
      cur_chunk.push(new CardTuple(card, arity));
    }

    let tractors : Tractor[] = [];
    let total : number = 0;

    for (let chunk of chunks) {
      let base = chunk.reduce((base, tuple) => {
        return Math.min(base, tuple.arity);
      }, Number.POSITIVE_INFINITY);

      let [begin, end, , ] = chunk.reduce(
        ([begin, end, i, prev], tuple) => {
          let new_begin = tuple.arity >= prev && prev > base;
          let new_end = end <= begin && tuple.arity < chunk[begin].arity;
          return [
            // start index of the highest-arity subsequence
            new_begin ? i - 1 : begin,
            // end index of the highest-arity subsequence
            new_end ? i : end,
            // accumulator internals
            i + 1, tuple.arity
          ];
        },
        [-1, 0, 0, base]
      );

      if (begin >= 0) {
        let len = chunk.length;

        // partition the chunk up to three ways, and re-queue the parts that
        // aren't our "high water mark" sequence.
        if (end <= begin) end = len;
        if (begin > 0) chunks.push(chunk.slice(0, begin));
        if (end < len) chunks.push(chunk.slice(end, len));

        // set up for our new chunk.
        chunk = chunk.slice(begin, end);
        base = chunk.reduce((base, tuple) => {
          return Math.min(base, tuple.arity);
        }, Number.POSITIVE_INFINITY);
      }

      // at this point, `chunk` now contains a (chunk.length,base)-tractor,
      // plus some singleton tuples.  start by registering the tractor...
      tractors.push(new Tractor(
        chunk.map(t => new CardTuple(t.card, base))
      ));
      total += chunk.length * base;

      // ...then register the singletons.
      for (let tuple of chunk) {
        if (tuple.arity === base) continue;

        let arity = tuple.arity - base;
        tractors.push(new Tractor([new CardTuple(tuple.card, arity)]));
        total += arity;
      }
    }
    return new Flight(tractors, total);
  }

  toString(tr: TrumpMeta, color: boolean = false): string {
    if (this.tractors.length === 1) {
      return this.tractors[0].toString(tr, color);
    }
    return this.tractors.map(t => '[' + t.toString(tr, color) + ']').join('');
  }
}
