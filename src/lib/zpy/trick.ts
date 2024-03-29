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
  Suit, Rank, TrumpMeta, CardBase, Card, CardPile, gen_cards
} from 'lib/zpy/cards';

import { array_fill } from 'utils/array';
import { ansi } from 'utils/string';

import assert from 'utils/assert'

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
    assert(arity > 0, 'CardTuple');
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
  constructor(
    readonly shape: Tractor.Shape, // len & arity
    readonly card: Card,      // starting card
    readonly osnt_suit?: Suit // participating osnt suit
  ) {}

  /*
   * Check whether this tractor overflows.
   */
  validate(tr: TrumpMeta) {
    if (this.osnt_suit === Suit.TRUMP ||
        this.osnt_suit === tr.suit) {
      return false;
    }
    let i = 0;

    for (let [c, _] of this.gen_counts(tr)) {
      // if we hit big joker, it must be the last card in the tractor
      if (++i < this.length && c.rank === Rank.B) return false;
    }
    return true;
  }

  /*
   * Property getters.
   */
  get length(): number { return this.shape.len; }
  get arity(): number { return this.shape.arity; }
  get count(): number { return this.length * this.arity; }
  get v_suit(): Suit { return this.card.v_suit; }

  /*
   * Generate (card, count) for every card in the tractor.
   */
  * gen_counts(tr: TrumpMeta): Generator<[Card, number], void> {
    for (let [i, v_rank] = [0, this.card.v_rank];
         i < this.length;
         ++i, v_rank = tr.inc_rank(v_rank)) {
      const [suit, rank] = tr.devirt(this.card.v_suit, v_rank, this.osnt_suit);
      yield [new Card(suit, rank, tr), this.arity];
    }
  }
  * gen_tuples(tr: TrumpMeta): Generator<CardTuple, void> {
    for (let [card, n] of this.gen_counts(tr)) {
      yield new CardTuple(card, n);
    }
  }
  gen_cards(tr: TrumpMeta): Generator<Card, void> {
    return gen_cards(this.gen_counts(tr));
  }

  /*
   * Convenience helper for gen_counts() on an array of Tractors.
   */
  static * gen_all(
    tractors: Tractor[],
    tr: TrumpMeta,
  ): Generator<[Card, number], void> {
    for (let tractor of tractors) {
      for (let count of tractor.gen_counts(tr)) {
        yield count;
      }
    }
  }

  /*
   * Spaceship-style comparator.
   *
   * Return null if `l` and `r` are incomparable (e.g., if they have different
   * length or their tuples have different arity).
   */
  static compare(l: Tractor, r: Tractor): number | null {
    if (l.length !== r.length) return null;
    if (l.arity  !== r.arity)  return null;
    return Card.compare(l.card, r.card);
  }

  toString(tr: TrumpMeta, color: boolean = false): string {
    return Array.from(this.gen_tuples(tr)).map(
      t => t.toString(color)
    ).join('');
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
      const arity_cmp = Math.sign(l.arity - r.arity);
      if (arity_cmp !== 0) return arity_cmp;
      return Math.sign(l.len - r.len);
    }

    toString(): string {
      return `(${this.len},${this.arity})`;
    }
  }
}

/*
 * Interface for a play.
 *
 * Plays are either flights or mixed-suit follows.
 */
export abstract class Play {
  /*
   * Number of cards in the play.
   */
  abstract readonly count: number;

  /*
   * Yield (card, count), or each card individually, for every card in `this`.
   */
  abstract gen_counts(tr: TrumpMeta): Generator<[Card, number], void>;
  abstract gen_cards(tr: TrumpMeta): Generator<Card, void>;

  /*
   * Whether `this` beats `other`, assuming `this` has turn-order precedence.
   */
  abstract beats(other: Play): boolean;

  /*
   * Pretty-printer.
   */
  abstract toString(tr: TrumpMeta, color?: boolean): string;

  /*
   * Dynamic casts.
   */
  fl(): Flight | null { return (this instanceof Flight) ? this : null; }
  ts(): Toss   | null { return (this instanceof Toss)   ? this : null; }

  /*
   * Greedily construct a play from a bunch of cards.
   *
   * We build a Flight for all single-suit plays, and a Toss for multi-suit
   * plays.
   *
   * The heuristic for flights here prefers taller tractors to longer ones.
   * That means that a play of 22333444 gets correctly (well, for most
   * situations) parsed as [333444][22].  However, a play like 556666777788
   * gets parsed as [66667777][88][55], which may not be what's intended.
   *
   * That said, the latter situation is very unlikely, and this will probably
   * predict the player's intent in most cases.
   */
  static extract(cards: CardBase[], tr: TrumpMeta): Play {
    assert(cards.length > 0, 'Play.extract');

    const pile = new CardPile(cards, tr);

    const suits = [
      Suit.CLUBS,
      Suit.DIAMONDS,
      Suit.SPADES,
      Suit.HEARTS,
      Suit.TRUMP
    ];
		if (!suits.every(s => pile.count_suit(s) === pile.size ||
                          pile.count_suit(s) === 0)) {
      return new Toss(cards);
    }

    const chunks : CardTuple[][] = [[]];

    for (let [card, arity] of pile) {
      let cur_chunk = chunks[chunks.length - 1];
      const prev = cur_chunk[cur_chunk.length - 1];

      // we're accumulating contiguous card ranges where the min arity of the
      // whole sequence is at least 2.
      //
      // note that, because we don't fork on off-suit natural trumps here, we
      // will not correctly handle piles that are intended as a tractor going
      // through an osnt if there are any nonidentical osnt's thrown in.  such
      // plays seem exceedingly rare, and we'll have to hope players are savvy
      // enough to parse such plays themselves.
      const should_continue = !prev || (
        arity !== 1 &&
        prev.arity !== 1 &&
        tr.inc_rank(prev.card.v_rank) === card.v_rank
      );

      if (!should_continue) {
        cur_chunk = [];
        chunks.push(cur_chunk);
      }
      cur_chunk.push(new CardTuple(card, arity));
    }

    const tractors : Tractor[] = [];

    for (let chunk of chunks) {
      let base = chunk.reduce(
        (base, tuple) => Math.min(base, tuple.arity),
        Number.POSITIVE_INFINITY
      );

      // look for the highest water mark nontrivial subsequence.
      let [begin, end, , ] = chunk.reduce(
        ([begin, end, i, prev], tuple) => {
          const new_begin = tuple.arity >= prev && prev > base;
          const new_end = end <= begin && tuple.arity < chunk[begin].arity;
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
        const len = chunk.length;

        // partition the chunk up to three ways, and re-queue the parts that
        // aren't our high water mark subsequence.
        if (end <= begin) end = len;
        if (begin > 0) chunks.push(chunk.slice(0, begin));
        if (end < len) chunks.push(chunk.slice(end, len));

        // make our subsequence the new current chunk.
        chunk = chunk.slice(begin, end);
        base = chunk.reduce(
          (base, tuple) => Math.min(base, tuple.arity),
          Number.POSITIVE_INFINITY
        );
      }

      // at this point, `chunk` now contains a (chunk.length,base)-tractor,
      // plus some singleton tuples.  start by registering the tractor...
      tractors.push(new Tractor(
        new Tractor.Shape(chunk.length, base),
        chunk[0].card,
        chunk.find(tuple => tuple.card.v_rank === Rank.N_off)?.card.osnt_suit
      ));

      // ...then register the singletons.
      for (let tuple of chunk) {
        if (tuple.arity === base) continue;

        const arity = tuple.arity - base;
        tractors.push(new Tractor(
          new Tractor.Shape(1, arity),
          tuple.card,
          tuple.card.osnt_suit
        ));
      }
    }
    return new Flight(tractors);
  }
}

/*
 * An arbitrary collection of tractors.
 *
 * The tractors in a flight are sorted by precedence order, which is a
 * descending lexicographic sort on (arity, len).  This is the order in which
 * the components of the flight impose constraints on another player's hand.
 *
 * For simplicity, all single-suit (and particularly lead) plays are considered
 * a flight, even if it's often degenerate (i.e., a single (n,m)-tractor).
 */
export class Flight extends Play {
  readonly tractors: Tractor[];
  readonly count: number;

  constructor(tractors: Tractor[]) {
    super();
    assert(Flight.validate(tractors), 'Flight', tractors);

    this.tractors = tractors.sort((l, r) => {
      const shape_cmp = Tractor.Shape.compare(l.shape, r.shape);
      if (shape_cmp !== 0) return -shape_cmp;
      return -Tractor.compare(l, r);
    });
    this.count = this.tractors.reduce((sum, t) => sum + t.count, 0);
  }

  static validate(tractors: Tractor[]) {
    return tractors.length > 0 &&
           tractors.every(t => t.v_suit === tractors[0].v_suit);
  }

  /*
   * Return the virtual suit of this Flight.
   */
  get v_suit(): Suit { return this.tractors[0].v_suit; }

  /*
   * The "shape" of the Flight.
   */
  blueprint(): Blueprint {
    const shapes = this.tractors
      .map(t => t.shape)
      .filter(sh => sh.arity > 1);

    return {
      design: shapes,
      accessories: this.tractors.length - shapes.length,
    };
  }

  gen_counts(tr: TrumpMeta): Generator<[Card, number], void> {
    return Tractor.gen_all(this.tractors, tr);
  }
  gen_cards(tr: TrumpMeta): Generator<Card, void> {
    return gen_cards(this.gen_counts(tr));
  }

  beats(other: Play): boolean {
    assert(
      this.count === other.count,
      'Flight#beats: incompatible play',
      this, other
    );

    if (other instanceof Toss) return true;

    if (other instanceof Flight) {
      // A flight must have the same structure...
      if (this.tractors.length !== other.tractors.length) return true;

      // ...and compare stricly greater in every component.
      for (let i = 0; i < this.tractors.length; ++i) {
        const cmp = Tractor.compare(this.tractors[i], other.tractors[i]);
        if (cmp === null || cmp >= 0) return true;
      }
      return false;
    }
    assert(false, 'Flight#beats: bad arg', other);
  }

  toString(tr: TrumpMeta, color: boolean = false): string {
    if (this.tractors.length === 1) {
      return this.tractors[0].toString(tr, color);
    }
    return this.tractors.map(t => '[' + t.toString(tr, color) + ']').join('');
  }
}

/*
 * A trivial, off-suit follow.
 */
export class Toss extends Play {
  constructor(readonly cards: CardBase[]) {
    super();
    assert(cards.length > 0, 'Toss');
  }

  get count(): number { return this.cards.length; }

  * gen_counts(tr: TrumpMeta): Generator<[Card, number], void> {
    for (let c of this.cards) yield [new Card(c.suit, c.rank, tr), 1];
  }
  * gen_cards(tr: TrumpMeta): Generator<Card, void> {
    for (let c of this.cards) yield new Card(c.suit, c.rank, tr);
  }

  beats(other: Play): boolean {
    assert(false);
    return false;
  }

  toString(tr: TrumpMeta, color: boolean = false): string {
    return this.cards.map(c => `[${c.toString(color)}]`).join('');
  }
}

/*
 * The "shape" of a Flight.
 */
export type Blueprint = {
  // nontrivial tractor shapes in lexicographic order
  design: Tractor.Shape[];
  // number of singles
  accessories: number;
};

export namespace Blueprint {

export function compare_with(l: Tractor.Shape[], r: Tractor[]): number {
  for (let i = 0; i < l.length; ++i) {
    // if `l` is longer than `r` and has `r` as a prefix, `l` wins.
    if (i >= r.length) return 1;

    const cmp = Tractor.Shape.compare(l[i], r[i].shape);
    if (cmp !== 0) return cmp;
  }
  // either l == r or `l` is a prefix of `r`; return accordingly.
  return Math.sign(l.length - r.length);
};

}

///////////////////////////////////////////////////////////////////////////////

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
 * of I together in a linked list, where (m,n) chains into (m + 1, n)).
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
    const p : {v_suit?: Suit, v_rank?: Rank} = {};

    for (let [card, n] of this.pile) {
      if (p.v_suit !== card.v_suit) {
        // we changed suits; reset our position.
        p.v_suit = card.v_suit;
        p.v_rank = 2;
      }

      // 1-tuples are equivalent to void ranks.
      if (n === 1) continue;

      const K = (this.#K[p.v_suit] = this.#K[p.v_suit] ?? []);

      // get I(p) for the rank preceding that of `card`
      let I_p : Hand.Node[];

      while (true) {
        const next = this.tr.inc_rank(p.v_rank);

        if (next === card.v_rank) {
          I_p = this.I(p.v_suit, p.v_rank);
          break;
        }
        if (next > card.v_rank) {
          assert(
            p.v_rank === 2 && card.v_rank === 2,
            'Hand: inc_rank',
            next, p, card
          );
          break;
        }
        p.v_rank = next;
      }
      assert(!I_p || this.tr.inc_rank(p.v_rank) === card.v_rank);

      const I_cur = this.I(card.v_suit, card.v_rank, card.suit);

      const register = (node: Hand.Node) => {
        I_cur.push(node);
        const K_n = (K[node.n] = K[node.n] ?? []);
        K_n[node.m] = K_n[node.m] ?? [];
        K_n[node.m].push(node);
      };

      for (let n_ = 2; n_ <= n; ++n_) {
        const node = new Hand.Node(
          new Tractor.Shape(1, n_),
          card,
          card.osnt_suit
        );
        register(node);
      }

      for (let src of I_p ?? []) {
        if (src.n > n) continue;
        const node = Hand.Node.chain_from(src, card.osnt_suit);
        register(node);
      }
    }
  }

  /*
   * Property getters.
   */
  get tr(): TrumpMeta { return this.pile.tr; }
  get size(): number { return this.pile.size; }

  /*
   * Remove `n` copies of `c`, updating internal data structures.
   *
   * This is a fairly simple process.  We look at I(p) where p is the (virtual)
   * rank of `c`, and invalidate every Node with shape (m',n') where we have
   * n' > count(c) - n.  (Note that we have to follow all Node chains.)
   * Because of Node sharing, this also invalidates the relevant Nodes in K, as
   * well as in I for higher ranks.
   *
   * The private version of this function additionally returns a Node which is
   * the head of the Node#sidechain linked list, which includes (and only
   * includes) every Node invalidated by this operation.  The optional `prev`
   * argument allows us to build a single list out of multiple remove() calls.
   */
  remove(c: Card, n: number): void {
    this.remove_(c, n);
  }
  private remove_(c: Card, n: number, prev: Hand.Node = null): Hand.Node {
    const remaining = this.pile.count(c) - n;
    assert(remaining >= 0);

    const I = this.I(c.v_suit, c.v_rank, c.suit);

    const invalidate = function invalidate(node: Hand.Node) {
      if (!node.valid) return;

      for (let next of node.next) invalidate(next);

      node.sidechain = prev;
      prev = node;
      node.invalidate();
    };

    for (let node of I) {
      if (node.n > remaining) invalidate(node);
    }
    this.pile.remove(c, n);

    return prev;
  }

  /*
   * Register `play_pile`, and determine whether it correctly follows `lead`.
   *
   * To find out, we walk the tractor shapes of `lead` in lexicographic order.
   * For each (m,n)-tractor, we iteratively try K(m -> 1, n -> 2) (with the
   * tuple arity n treated as the "higher-order" position, lexicographically)
   * looking for a match (m',n')---i.e., an (m',n') such that K(m',n') is
   * nonempty.  We then ensure that `play` contains one of the tractors
   * identified in K(m',n').  If it does not, we will return false.
   *
   * If it does, we re-sort (m - m', n - n') into the lexicographic ordering of
   * all the tractor shapes in `lead` (only if m - m' > 0 and n - n' > 1).
   *
   * However, we cannot yet remove the cards in the tractor we found from our
   * Hand (unless it was the only option).  This is because, had we matched (or
   * had the follower played) one of the other tractors, it's possible they
   * could have satisfied a better "prefix" of constraints.
   *
   * So, we need to branch whenever K(m',n') contains more than one tractor and
   * try each path.  Then, `play` satisfies `lead` iff it includes all the
   * cards from any of the best paths walked (which we can determine using a
   * lexicographic comparison of the shapes that were matched).
   *
   * A path ends when we run out of non-singleton components of `lead`.
   *
   * Finally, we also need to check that `play` follows suit for the remaining
   * singletons.
   *
   * We always succeed at making `play`, even if it would result in a renege
   * (unless `play` is invalid for the Hand, in which case we assert).
   *
   * Hand#follow_with() returns two values:
   *    - `follows` indicates whether or not a successful follow was made.  if
   *      it's false, it means the following player reneged.
   *    - `undo_chain` is the handle for unwinding this play via Hand#undo()
   *    - `parses` is a list of all interpretations of the play whose structure
   *      matches `lead`.  it can be used to authoritatively determine whether
   *      the play can beat the lead.
   */
  follow_with(
    lead: Flight,
    play_pile: CardPile,
    trace: boolean = false
  ): {
    follows: boolean,
    undo_chain: Hand.Node,
    parses: Flight[],
  } {
    assert(lead.count === play_pile.size);
    assert(
      TrumpMeta.same(this.tr, play_pile.tr),
      'Hand#follow_with: lead and play have incompatible trump',
      lead, play_pile
    );

    // ensure `play` is a subset of `this`.
    assert(
      this.pile.contains(play_pile),
      'Hand#follow_with: hand must contain play',
      this.pile, play_pile
    );

    // check for suit-following.
    const on_suit_left = this.pile.count_suit(lead.v_suit);
    const on_suit_played = play_pile.count_suit(lead.v_suit);

    const full_follow = on_suit_played === play_pile.size;

    // if we neither played entirely on suit nor played all our remaining
    // cards in the lead suit, we're bad.
    if (!full_follow && on_suit_played !== on_suit_left) {
      let undo_chain: Hand.Node = null;

      for (let [card, n] of play_pile) {
        undo_chain = this.remove_(card, n, undo_chain);
      }
      return {follows: false, parses: [], undo_chain};
    }

    // we also check to see if `play_pile` may represent an attempt to trump
    // the lead.  if so, we know the follow was valid, but we hijack the rest
    // of this function to instead parse the trump play to see if it can beat
    // the lead in some configuration.
    const full_trump = play_pile.count_suit(Suit.TRUMP) === play_pile.size;
    const target_suit = full_trump ? Suit.TRUMP : lead.v_suit;

    play_pile = CardPile.copy(play_pile); // don't mutate inputs

    // get the shapes that "remain" after `smol` is accounted for as part of a
    // match for `big`.
    //
    // basically performs the following operations:
    //
    //  (4, 4)     (3, 2)   (1, 4)  (3, 2)
    //
    //  3 4 5 6               3     4 5 6
    //  3 4 5 6  -         =  3  +  4 5 6
    //  3 4 5 6     7 8 9     3
    //  3 4 5 6     7 8 9     3
    const diff_shapes = (
      big: Tractor.Shape,
      smol: Tractor.Shape,
    ): Tractor.Shape[] => {
      const m = big.len - smol.len;
      const n = big.arity - smol.arity;
      assert(m >= 0 && n >= 0);

      const result: Tractor.Shape[] = [];
      if (m > 0) result.push(new Tractor.Shape(m, big.arity));
      if (n > 1) result.push(new Tractor.Shape(big.len, n));
      return result;
    };

    // consume the remainder of the play and patch up the result.
    const finish = (
      follows: boolean,
      undo_chain: Hand.Node,
      parses: Flight[] = [],
    ) => {
      // if we were doing a trump check, follow still succeeds
      follows = follows || target_suit !== lead.v_suit;

      // remove all cards we haven't already removed.
      for (let [card, n] of play_pile) {
        undo_chain = this.remove_(card, n, undo_chain);
      }
      return {follows, undo_chain, parses};
    };

    const blueprint = lead.blueprint();

    // `shapes` is kept ordered with the "strongest" shape at the end (so it's
    // basically a poor man's prioqueue).
    let shapes = [...blueprint.design].reverse();

    enum Code {
      DONE, // success condition; used by step() clients
      FAIL, // failure condition; used by step() clients
      TERM, // we exhausted either the input or hand
      MISS, // the next shape in the stack failed to match
    };

    // callback for generic match loop step function.
    type StepFn<T extends Array<any>> =
      (sh: Tractor.Shape, K: Hand.Node[], ...args: T) => Code;

    // generic step function.
    //
    // check for stop conditions (and potentially returning Code.TERM), pop the
    // biggest shape off `shapes`, and try to find a match in this.#K.  if we
    // find such a match, call `fn` and return its result.  if we don't, return
    // Code.DONE.
    const step = function<T extends Array<any>>(
      fn: StepFn<T>,
      ...args: T
    ): Code {
      if (shapes.length === 0) return Code.TERM;
      if (play_pile.size <= 1) return Code.TERM;

      const sh = shapes.pop();
      assert(sh.arity > 1);

      for (let n = sh.arity; n >= 2; --n) {
        for (let m = sh.len; m >= 1; --m) {
          let K = this.#K[target_suit]?.[n]?.[m];
          if (K) K = K.filter((n: Hand.Node) => n.valid);

          if (!K || K.length === 0) continue;

          assert(
            n === K[0].n && m === K[0].m,
            'Hand#follow_with: malformed K'
          );
          return fn(sh, K, ...args);
        }
      }
      return Code.MISS;
    }.bind(this);

    let undo_chain: Hand.Node = null;
    let prefix: Tractor[] = [];

    while (true) {
      const code = step((shape: Tractor.Shape, K: Hand.Node[]): Code => {
        if (K.length > 1 &&
            play_pile.size - K[0].count > 1) {
          // if there's only one match or we have no more non-singletons left
          // in `play`, we can avoid backtracking.  otherwise, we're shit outta
          // luck.
          shapes.push(shape);
          return Code.TERM;
        }

        for (let node of K) {
          if (!play_pile.contains(node.gen_counts(this.tr))) continue;

          prefix.push(node);

          for (let [card, n] of node.gen_counts(this.tr)) {
            play_pile.remove(card, n);
            undo_chain = this.remove_(card, n, undo_chain);
          }
          // `node` may not be invalidated if its position still admits the
          // component tractor's shape

          const remainder = diff_shapes(shape, node.shape);
          if (remainder.length > 0) {
            shapes = shapes.concat(remainder).sort(Tractor.Shape.compare);
          }
          return Code.DONE;
        }
        return Code.FAIL;
      });
      switch (code) {
        case Code.DONE: continue;
        case Code.FAIL: return finish(false, undo_chain);
        case Code.TERM: break;
        case Code.MISS: continue;
      }
      break;
    }

    if (shapes.length === 0) {
      if ((full_follow || full_trump) &&
          Blueprint.compare_with(blueprint.design, prefix) === 0) {
        // everything that's left should be considered a singleton
        const trivial = new Tractor.Shape(1, 1);

        for (let card of play_pile.gen_cards()) {
          prefix.push(new Tractor(trivial, card, card.osnt_suit));
        }
        return finish(true, undo_chain, [new Flight(prefix)]);
      }
      return finish(true, undo_chain);
    }

    // oof... we have to switch to a painful recursive approach with
    // backtracking.  our goal here is to perform the same algorithm as above,
    // but do it for each "branch" we can take at a K(m,n) with multiple valid
    // entries.  we then take all the paths that have the highest "value"---
    // determined by a Blueprint comparison---and see if `play` actually
    // satisfies any of them.  if so, `play` successfully followed; and if not,
    // it's a renege.
    //
    // note that we may have already processed some of the `shapes` and part of
    // the `play_pile` in the non-backtracking work above; that path prefix is
    // stored in `prefix`.

    // the best path sequence we've encountered so far.  since the comparison
    // is lexicographic, we can greedily prune suboptimal paths.
    let best_seq : Tractor.Shape[] = [];

    // all paths we've seen whose shape-sequence matches `best_seq`.
    let paths : Hand.Node[][] = [];

    // debug trace helpers
    const seq_to_str = (seq: Tractor.Shape[]): string => {
      return seq.map(sh => sh.toString()).join('-');
    };
    const path_to_str = (path: Tractor[]): string => {
      return path.map(n => n.shape.toString()).join('-') +
        ` [${path.map(n => n.toString(this.tr, true)).join('-')}]`;
    };

    if (trace && prefix.length > 0) {
      console.log('initial path');
      console.log(path_to_str(prefix));
    }

    // current path that we're descending.  note that since JS and TS arrays
    // are always passed "by reference" and hence mutable, we avoid threading
    // arguments to make the statefulness overt.
    const cur_path : Hand.Node[] = [];

    const explore = function<T>(
      shape: Tractor.Shape,
      K: Hand.Node[],
      explore_: T,
      depth: number,
    ): Code {
      const finish_path = () => {
        if (trace) console.log(' '.repeat((depth + 1) * 3) + 'terminated');

        const cmp = Blueprint.compare_with(best_seq, cur_path);
        if (cmp < 0) {
          // replace `best_seq`, and nuke and re-fill `paths`.
          best_seq = cur_path.map(n => n.shape);
          paths.length = 0;
          paths.push([...cur_path]); // must make a copy
        } else if (cmp === 0) {
          // register `cur_path` as an equally-valid option.
          paths.push([...cur_path]); // must make a copy
        }
        // if `cur_path` is worse than `best_seq`, just quietly drop it.
      };

      for (let node of K) {
        if (!this.pile.contains(node.gen_counts(this.tr))) {
          // path ends if it no longer matches the hand.
          finish_path();
          continue;
        }

        // if the new node would result in a worse path than the best we've
        // seen so far, we don't need to explore this branch.
        const cmp = Blueprint.compare_with(
          best_seq.slice(0, cur_path.length + 1),
          [...cur_path, node]
        );
        if (cmp > 0) continue;

        let chain: Hand.Node = null;

        // "commit" this node to the chain.  this mirrors the logic in the non-
        // backtracking version, except that we don't need to track `play`
        // because we can't decide one way or another until we have all "best
        // paths".
        for (let [card, n] of node.gen_counts(this.tr)) {
          chain = this.remove_(card, n, chain);
        }
        cur_path.push(node);

        if (trace) {
          const prefix = ' '.repeat(depth * 3);
          console.log(prefix + 'recursing');
          console.log(prefix + '├--shapes remaining:', seq_to_str(shapes));
          console.log(prefix + '└--cur_path:', path_to_str(cur_path));
        }

        const orig_shapes = (() => {
          const remainder = diff_shapes(shape, node.shape);
          if (remainder.length > 0) {
            const copy = shapes;
            shapes = shapes.concat(remainder).sort(Tractor.Shape.compare);
            return copy;
          }
          return shapes;
        })();

        const code = step(explore_, explore_, depth + 1);
        // if we got TERM, it means the mutual recursion finished before
        // invoking explore again, so we need to do the bookkeeping.
        if (code === Code.TERM ||
            code === Code.MISS) {
          finish_path();
        }

        const out = cur_path.pop();
        assert(
          node === out, // should be the exact same object
          'Hand#follow_with: stack error'
        );

        this.undo(node.gen_counts(this.tr), chain);
        assert(node.valid, 'Hand#follow_with: undo error');
        shapes = orig_shapes;
        // don't return; continue and try the next branch.
      }
      shapes.push(shape);

      return Code.DONE;
    }.bind(this);

    const code = step(explore, explore, 0);
    assert(code === Code.DONE);

    if (trace) {
      console.log('strongest constraint:', seq_to_str(best_seq));
      for (let path of paths) {
        console.log('  ' + path_to_str(path));
      }
    }

    // all paths that can actually match the play.
    //
    // note that there can indeed be multiple; say the lead is a (2,2)-tractor,
    // and two pairs, and our play is two (2,2)-tractors.
    const paths_and_piles = paths.map(path => ({
      path: path,
      pile: new CardPile(gen_cards(Tractor.gen_all(path, this.tr)), this.tr),
    }));
    const matches = paths_and_piles.filter(
      ({pile}) => play_pile.contains(pile)
    );
    if (matches.length === 0) return finish(false, undo_chain);

    const a_full_path: Tractor[] = [...prefix, ...matches[0].path];

    if ((full_follow || full_trump) &&
        Blueprint.compare_with(blueprint.design, a_full_path) === 0) {
      // generate all the parses.
      const trivial = new Tractor.Shape(1, 1);

      const parses = matches.map(({path, pile}) => {
        const suffix = gen_cards(play_pile.without(pile));

        // we need to prepend the prefix computed by the non-backtracing
        // portion of the algorithm, then attach everything else as a
        // singleton.
        return new Flight([
          ...prefix,
          ...path,
          ...[...suffix].map(c => new Tractor(trivial, c, c.osnt_suit))
        ]);
      });

      return finish(true, undo_chain, parses);
    }
    return finish(true, undo_chain);
  }

  /*
   * Undo a follow.
   *
   * This is a somewhat modularity-breaking aspect of the Hand interface, since
   * undos require exposing the Node data that lives in I and K.  On the bright
   * side, it's very simple.
   *
   * `counts` must be the most recent play, and `chain` must be the undo chain
   * returned by `follow_with`.  Any number of plays may be unwound in this
   * manner, but they have to each be popped of the "play stack", so to speak.
   */
  undo(counts: Iterable<[Card, number]>, chain: Hand.Node) {
    while (chain !== null) {
      chain.revive();
      chain = chain.sidechain;
    }
    for (let [card, n] of counts) {
      this.pile.insert(card, n);
    }
  }

  /*
   * Obtain a Node set from I.
   *
   * The presence of `suit` serves as a "mutable" flag.  If it's set,
   * mutating the result is a coherent operation that affects the contents of
   * this.#I.  If it's not set, the result may be a temporary, so mutations
   * should not be attempted.
   */
  private I(v_suit: Suit, v_rank: Rank, suit?: Suit): Hand.Node[] {
    if (suit === null || suit === undefined) {
      return v_rank === Rank.N_off
        // NB: I_osnt[v_suit] may not be fully populated, so we need to filter
        // out the undefined entries that show up in our flattened array (this is
        // just the behavior of Array.prototype.concat; any undefined arguments
        // show up as undefined entries in the concatenation)
        ? [].concat.apply([], this.#I_osnt[v_suit]).filter((n: any) => !!n)
        : (this.#I[v_suit]?.[v_rank] ?? []);
    }
    if (v_rank === Rank.N_off) {
      const I_s = (this.#I_osnt[v_suit] = this.#I_osnt[v_suit] ?? []);
      return (I_s[suit] = I_s[suit] ?? []);
    } else {
      const I_s = (this.#I[v_suit] = this.#I[v_suit] ?? []);
      return (I_s[v_rank] = I_s[v_rank] ?? []);
    }
  }
}

export namespace Hand {
  /*
   * A possible tractor in a Hand.
   *
   * We keep at most one Node for every (m,n,start) triple.  This allows us to
   * performance all our differential updates on I and have the changes be
   * reflected in K.
   */
  export class Node extends Tractor {
    private _valid: boolean = false;
    // pointers to (m+1,n) Nodes.  there are multiple because of branching
    // paths through osnt's.
    readonly next: Node[] = [];
    // a linear side chain used for fun activities (like undoing a remove
    // operation when backtracking in Hand#follow_with).
    sidechain: Node = null;

    constructor(
      shape: Tractor.Shape, // len & arity
      card: Card,      // starting card
      osnt_suit?: Suit // participating osnt suit
    ) {
      super(shape, card, osnt_suit);
      this._valid = true;
    }

    /*
     * Create a Node chained off `src`.
     *
     * `osnt_suit` should be set if this new Node (and future Nodes chained
     * from here) passes through an off-suit natural trump.
     */
    static chain_from(src: Node, osnt_suit?: Suit): Node {
      const next = new Node(
        new Tractor.Shape(src.m + 1, src.n),
        src.card,
        osnt_suit ?? src.osnt_suit,
      );
      assert(!osnt_suit || src.next.length === 0);
      src.next.push(next);
      return next;
    }

    get valid() { return this._valid; }
    get m() { return this.shape.len; }
    get n() { return this.shape.arity; }

    revive() { this._valid = true; }
    invalidate() { this._valid = false; }
  }
}
