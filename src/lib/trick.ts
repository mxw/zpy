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
  constructor(
    readonly card: Card,
    readonly arity: number
  ) {
    assert(arity > 0);
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
  constructor(readonly tuples: CardTuple[]) {
    assert(tuples.length > 0);
    assert(tuples.every(t => t.card.v_suit === this.v_suit));
    assert(tuples.every(t => t.arity === this.arity));

    this.tuples = tuples.sort((l, r) => CardTuple.compare(l, r));
  }

  /*
   * Property getters.
   */
  get shape(): Tractor.Shape {
    return new Tractor.Shape(this.length, this.arity);
  }
  get length(): number { return this.tuples.length; }
  get arity(): number { return this.tuples[0].arity; }
  get count(): number { return this.length * this.arity; }
  get v_suit(): Suit { return this.tuples[0].card.v_suit; }

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

export namespace Tractor {
  /*
   * Dimensions of a tractor.
   */
  export class Shape {
    constructor(
      readonly len: number,
      readonly arity: number
    ) {}

    static compare(l: Tractor.Shape, r: Tractor.Shape): number {
      let arity_cmp = Math.sign(l.arity - r.arity);
      if (arity_cmp !== 0) return arity_cmp;
      return Math.sign(l.len - r.len);
    }
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
  readonly count: number;

  private constructor(
    readonly tractors: Tractor[],
    readonly total: number
  ) {
    assert(tractors.length > 0);
    assert(tractors.every(t => t.v_suit === tractors[0].v_suit));

    this.tractors = tractors.sort((l, r) => {
      let shape_cmp = Tractor.Shape.compare(l.shape, r.shape);
      if (shape_cmp !== 0) return -shape_cmp;
      return -Tractor.compare(l, r);
    });
    this.count = this.tractors.reduce((sum, t) => sum + t.count, 0);
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

      // look for the highest water mark nontrivial subsequence.
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
        // aren't our high water mark subsequence.
        if (end <= begin) end = len;
        if (begin > 0) chunks.push(chunk.slice(0, begin));
        if (end < len) chunks.push(chunk.slice(end, len));

        // make our subsequence the new current chunk.
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

  /*
   * Property getters.
   */
  get v_suit(): Suit { return this.tractors[0].v_suit; }

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

  toString(tr: TrumpMeta, color: boolean = false): string {
    if (this.tractors.length === 1) {
      return this.tractors[0].toString(tr, color);
    }
    return this.tractors.map(t => '[' + t.toString(tr, color) + ']').join('');
  }
}

/*
 * A CardPile with a bunch of tractor-finding metadata.  We convert a CardPile
 * to a Hand once all cards are drawn.
 *
 * Hand is optimized for finding plays, and offers the following capability:
 * For any given (length, arity) pair (m,n), find all the ranks at which a
 * potential (m,n)-tractor begins.  We maintain this capability cheaply across
 * deletion operations (but not insertions).
 *
 * To accomplish this, we create and maintain two data structures:
 *
 *   K(m,n) := all start ranks of potential (m,n)-tractors
 *   I(p) := all tractors that include rank p
 *
 * (naming note: K stands for "known", and I stands for "interference")
 *
 * We only track K(m,n) for n > 1 (but m > 0).
 *
 * To build K and I, suppose at some rank p we know every possible
 * (m,n)-tractor that ends at p (and ergo begins at p - m + 1).  Let us call
 * this set S(p).  When we examine rank p + 1, which supports a tuple of arity
 * r, we set S(p + 1) to be all of the following tractor shapes:
 *
 *  {
 *    (1, r') : r' <= r
 *    (y + 1, r') : (y, r') in S(p) & r' <= r
 *  }
 *
 * This is the initial value of I(p + 1).  Then for every (m,n) in S(p + 1), we
 * add (m,n) to each set I(p - m + 2)...I(p).  (We do this by chaining elements
 * of I together in a linked list, where (m,n) chains into (m + 1,n)).
 *
 * We then add the starting rank of every tractor shape (m,n) in S(p + 1) to
 * K(m,n).
 *
 * (NB: This is a slight simplification; in practice, we need to do this same
 * work for every suit.)
 */
export class Hand {
  #K: Hand.Node[][][][] = []; // v_suit -> arity -> len -> [nodes]
  #I: Hand.Node[][][] = [];   // v_suit -> v_rank -> [nodes]
  #I_osnt: Hand.Node[][][] = [];  // v_suit -> suit -> [nodes]

  constructor(readonly pile: CardPile) {
    let p : {v_suit?: Suit, v_rank?: number};

    for (let [card, n] of this.pile.gen_counts()) {
      if (p.v_suit !== card.v_suit) {
        // we changed suits; reset our position.
        p.v_suit = card.v_suit;
        p.v_rank = 2;
      }

      // 1-tuples are equivalent to void ranks.
      if (n === 1) continue;

      let K = this.#K[p.v_suit];

      let I_p : Hand.Node[];

      while (true) {
        let next = this.pile.tr.inc_rank(p.v_rank);

        if (next === card.v_rank) {
          I_p = this.I(p.v_suit, p.v_rank);
          break;
        }
        if (next > card.v_rank) {
          assert(p.v_rank === 2);
          assert(card.v_rank === 2);
          break;
        }
        p.v_rank = next;
      }
      assert(!I_p || this.pile.tr.inc_rank(p.v_rank) === card.v_rank);

      let osnt_suit = (card.v_rank === Rank.N_off) ? card.suit : undefined;
      let I_cur = this.I(card.v_suit, card.v_rank, osnt_suit);

      let register = (node: Hand.Node) => {
        I_cur.push(node);
        K[node.n][node.m] = K[node.n][node.m] || [];
        K[node.n][node.m].push(node);
      };

      for (let n_ = 2; n_ <= n; ++n_) {
        let node = new Hand.Node(
          new Tractor.Shape(1, n_),
          card.v_rank,
          osnt_suit,
        );
        register(node);
      }

      for (let src of I_p) {
        if (src.n > n) continue;
        let node = Hand.Node.chain_from(src, osnt_suit);
        register(node);
      }
    }
  }

  /*
   * Obtain a Node set from I.
   *
   * The presence of `osnt_suit` serves as a "mutable" flag.  If it's set,
   * mutating the result is a coherent operation that affects the contents of
   * this.#I.  If it's not set, the result may be a temporary, so mutations
   * should not be attempted.
   */
  private I(
    v_suit: Suit,
    v_rank: number,
    osnt_suit?: Suit,
  ): Hand.Node[] {
    if (!osnt_suit) {
      return v_rank === Rank.N_off
        ? [].concat.apply([], this.#I_osnt[v_suit])
        : this.#I[v_suit][v_rank];
    }
    if (v_rank === Rank.N_off) {
      return (this.#I_osnt[v_suit][osnt_suit] =
              this.#I_osnt[v_suit][osnt_suit] || []);
    } else {
      return (this.#I[v_suit][v_rank] =
              this.#I[v_suit][v_rank] || []);
    }
  }
}

export namespace Hand {
  /*
   * A tractor shape starting at a certain rank.
   *
   * We keep at most one Node for every (m,n,start) triple.  This allows us to
   * performance all our differential updates on I and have the changes be
   * reflected in K.
   */
  export class Node {
    #valid: boolean = false;
    // pointers to (m+1,n) Nodes.  there are multiple because of branching
    // paths through osnt's.
    readonly next: Node[] = [];

    constructor(
      readonly shape: Tractor.Shape, // len & arity
      readonly start: number,   // starting rank
      readonly osnt_suit?: Suit // starting osnt suit
    ) {
      this.#valid = true;
    }

    /*
     * Create a Node chained off `src`.
     *
     * `osnt_suit` should be set if this new Node (and future Nodes chained
     * from here) passes through an off-suit natural trump.
     */
    static chain_from(src: Node, osnt_suit?: Suit): Node {
      let next = new Node(
        new Tractor.Shape(src.m + 1, src.n),
        src.start,
        osnt_suit || src.osnt_suit,
      );
      assert(!osnt_suit || src.next.length === 0);
      src.next.push(next);
      return next;
    }

    get valid() { return this.#valid; }
    get m() { return this.shape.len; }
    get n() { return this.shape.arity; }

    invalidate() { this.#valid = false; }
  }
}
