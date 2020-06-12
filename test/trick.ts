import {
  Suit, Rank, TrumpMeta, CardBase, Card, CardPile
} from 'lib/zpy/cards.ts'
import {
  CardTuple, Tractor, Flight, Play, Hand
} from 'lib/zpy/trick.ts'

import * as c from 'test/common.ts'

import {expect} from 'chai'

const cvt = (cs: CardBase[], tr: TrumpMeta) => cs.map(c => Card.from(c, tr));

describe('new Hand', () => {
  it('doesn\'t crash or whatever', () => {
    let tr = new TrumpMeta(Suit.CLUBS, 2);

    let pile = new CardPile([
      c.D_4, c.D_7, c.D_7, c.D_10, c.D_J, c.D_K, c.D_A,
      c.S_3, c.S_4, c.S_4, c.S_6, c.S_7, c.S_9,
      c.H_5, c.H_K,
      c.C_10, c.C_J,

      c.S_2, c.S_2, c.H_2, c.C_2, c.C_2,
      c.J_S, c.J_B,
    ], tr);
    let hand = new Hand(pile);

    tr = new TrumpMeta(Suit.TRUMP, Rank.B);

    pile = new CardPile([
      c.C_5, c.C_6, c.C_7, c.C_8, c.C_8, c.C_9, c.C_10, c.C_J,
      c.D_A,
      c.S_7, c.S_7, c.S_8, c.S_9, c.S_10, c.S_J, c.S_K,
      c.H_5, c.H_6, c.H_6, c.H_10, c.H_Q, c.H_2,
      c.J_S, c.J_B, c.J_B,
    ], tr);
    hand = new Hand(pile);

    console.log(hand.toString());
  });
});

describe('Play#extract', () => {
  it('extracts structure from a tiny pile of cards', () => {
    let tr = new TrumpMeta(Suit.CLUBS, Rank.Q);
    let cards = [c.S_K, c.S_K];
    let play = Play.extract(cards, tr);

    expect(play.toString(tr)).to.equal(
      'K♠K♠'
    );
    expect(play.count).to.equal(cards.length);
  });

  it('extracts structure from a pile of cards', () => {
    let tr = new TrumpMeta(Suit.DIAMONDS, Rank.Q);
    let cards = [
      c.C_2, c.C_2,
      c.C_3, c.C_3, c.C_3, c.C_3,
      c.C_4, c.C_4,
      c.C_A,
    ];
    let play = Play.extract(cards, tr);

    expect(play.toString(tr)).to.equal(
      '[2♣2♣3♣3♣4♣4♣][3♣3♣][A♣]'
    );
    expect(play.count).to.equal(cards.length);
  });

  it('extracts structure from a more complicated pile of cards', () => {
    let tr = new TrumpMeta(Suit.SPADES, Rank.Q);
    let cards = [
      c.D_5, c.D_5,
      c.D_6, c.D_6, c.D_6, c.D_6,
      c.D_7, c.D_7, c.D_7, c.D_7,
      c.D_8, c.D_8,
      c.D_9, c.D_9,
    ];
    let play = Play.extract(cards, tr);

    expect(play.toString(tr)).to.equal(
      '[6♦6♦6♦6♦7♦7♦7♦7♦][8♦8♦9♦9♦][5♦5♦]'
    );
    expect(play.count).to.equal(cards.length);
  });

  it('extracts structure from discontiguous chunks with thicc tail', () => {
    let tr = new TrumpMeta(Suit.TRUMP, Rank.B);
    let cards = [
      c.S_3, c.S_3,
      c.S_4, c.S_4,
      c.S_6,
      c.S_9, c.S_9, c.S_9,
      c.S_10, c.S_10, c.S_10,
      c.S_J, c.S_J, c.S_J, c.S_J,
      c.S_Q, c.S_Q, c.S_Q, c.S_Q,
    ];
    let play = Play.extract(cards, tr);

    expect(play.toString(tr)).to.equal(
      '[J♠J♠J♠J♠Q♠Q♠Q♠Q♠][9♠9♠9♠10♠10♠10♠][3♠3♠4♠4♠][6♠]'
    );
    expect(play.count).to.equal(cards.length);
  });

  it('extracts structure from natural trump tractors', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let cards = [
      c.H_Q,
      c.H_A, c.H_A,
      c.C_J, c.C_J,
      c.H_J, c.H_J,
      c.J_B, c.J_B,
    ];
    let play = Play.extract(cards, tr);

    expect(play.toString(tr)).to.equal(
      '[A♥A♥J♣J♣J♥J♥][W☉W☉][Q♥]'
    );
    expect(play.count).to.equal(cards.length);
  });

  it('extracts structure from ambiguous natural trump tractors', () => {
    // XXX: this behavior is currently pretty shitty
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let cards = [
      c.H_A, c.H_A, c.H_A,
      c.C_J, c.C_J, c.C_J,
      c.D_J,
      c.S_J, c.S_J,
      c.H_J, c.H_J, c.H_J,
      c.J_S, c.J_S, c.J_S,
      c.J_B, c.J_B, c.J_B,
    ];
    let play = Play.extract(cards, tr);

    expect(play.toString(tr)).to.equal(
      '[w☉w☉w☉W☉W☉W☉][A♥A♥A♥J♣J♣J♣][J♠J♠J♥J♥][J♥][J♦]'
    );
    expect(play.count).to.equal(cards.length);
  });
});

describe('Flight#beats', () => {
  it('handles singleton tricks', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([c.C_10], tr).fl();
    let you = Play.extract([c.C_Q], tr);
    expect(me.beats(you)).to.be.false;
    expect(you.beats(me)).to.be.true;
  });

  it('handles suit mismatches', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([c.C_K], tr).fl();
    let you = Play.extract([c.D_Q], tr);
    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });

  it('handles trumping', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([c.H_4], tr).fl();
    let you = Play.extract([c.S_A], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.false;
  });

  it('handles tuple vs. tuple', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([c.D_7, c.D_7], tr).fl();
    let you = Play.extract([c.D_9, c.D_9], tr);

    expect(me.beats(you)).to.be.false;
    expect(you.beats(me)).to.be.true;
  });

  it('handles tuple vs. non-tuple', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([c.D_7, c.D_7, c.D_7], tr).fl();
    let you = Play.extract([c.D_9, c.D_9, c.D_A], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });

  it('handles tractor vs. tractor', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([c.D_7, c.D_7, c.D_8, c.D_8], tr).fl();
    let you = Play.extract([c.D_8, c.D_8, c.D_9, c.D_9], tr);

    expect(me.beats(you)).to.be.false;
    expect(you.beats(me)).to.be.true;
  });

  it('handles tractor vs. different tractor', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([
      c.D_7, c.D_7,
      c.D_8, c.D_8,
      c.D_9, c.D_9
    ], tr).fl();
    let you = Play.extract([
      c.D_8, c.D_8, c.D_8,
      c.D_9, c.D_9, c.D_9
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });

  it('handles flight vs. flight', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([
      c.D_2, c.D_2, c.D_2,
      c.D_3, c.D_3, c.D_3,
      c.D_7, c.D_7,
      c.D_8, c.D_8,
      c.D_9, c.D_9,
    ], tr).fl();
    let you = Play.extract([
      c.D_4, c.D_4, c.D_4,
      c.D_5, c.D_5, c.D_5,
      c.D_10, c.D_10,
      c.D_Q, c.D_Q,
      c.D_K, c.D_K,
    ], tr);

    expect(me.beats(you)).to.be.false;
    expect(you.beats(me)).to.be.true;
  });

  it('handles flight vs. different flight', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([
      c.D_2, c.D_2, c.D_2,
      c.D_3, c.D_3, c.D_3,
      c.D_7, c.D_7,
      c.D_8, c.D_8,
      c.D_9, c.D_9,
    ], tr).fl();
    let you = Play.extract([
      c.D_4, c.D_4, c.D_4,
      c.D_5, c.D_5, c.D_5,
      c.D_Q, c.D_Q, c.D_Q,
      c.D_K, c.D_K, c.D_K,
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });

  it('handles flight vs. trump flight', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([
      c.H_2, c.H_2, c.H_2,
      c.H_3, c.H_3, c.H_3,
      c.H_7, c.H_7,
      c.H_8, c.H_8,
      c.H_9, c.H_9,
    ], tr).fl();
    let you = Play.extract([
      c.D_4, c.D_4, c.D_4,
      c.D_5, c.D_5, c.D_5,
      c.D_10, c.D_10,
      c.D_Q, c.D_Q,
      c.D_K, c.D_K,
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.false;
  });

  it('handles flight vs. failed trump flight', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([
      c.D_2, c.D_2, c.D_2,
      c.D_3, c.D_3, c.D_3,
      c.D_7, c.D_7,
      c.D_8, c.D_8,
      c.D_9, c.D_9,
    ], tr).fl();
    let you = Play.extract([
      c.H_4, c.H_4, c.H_4,
      c.H_5, c.H_5, c.H_5,
      c.H_Q, c.H_Q, c.H_Q,
      c.H_K, c.H_K, c.H_K,
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });
});

describe('Hand#follow_with', () => {
  it('handles singletons', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let hand = new Hand(new CardPile([
      c.D_4, c.D_4,
      c.S_8, c.S_9,
      c.C_J,
      c.H_J,
    ], tr));

    let lead: Flight;
    let play: CardPile;

    // invalid play: missing card
    lead = Play.extract([c.D_K], tr).fl();
    play = new CardPile([c.D_K], tr);
    expect(() => hand.follow_with(lead, play)).to.throw();

    // on-suit follow
    play = new CardPile([c.D_4], tr);
    expect(hand.follow_with(lead, play).follows).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦[1]: 4♦
♠[2]: 8♠ 9♠
☉[2]: J♣ J♥
`.trim()
    );

    // basic renege
    play = new CardPile([c.S_9], tr);
    expect(hand.follow_with(lead, play).follows).to.be.false;
    expect(hand.pile.toString()).to.equal(`
♦[1]: 4♦
♠[1]: 8♠
☉[2]: J♣ J♥
`.trim()
    );

    // void-of-suit follow
    lead = Play.extract([c.C_K], tr).fl();
    play = new CardPile([c.S_8], tr);
    expect(hand.follow_with(lead, play).follows).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦[1]: 4♦
☉[2]: J♣ J♥
`.trim()
    );

    // natural trump follow
    lead = Play.extract([c.H_4], tr).fl();
    play = new CardPile([c.C_J], tr);
    expect(hand.follow_with(lead, play).follows).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦[1]: 4♦
☉[1]: J♥
`.trim()
    );
  });

  it('handles tuples', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.Q);
    let hand = new Hand(new CardPile([
      c.D_3, c.D_3,
      c.D_4, c.D_4, c.D_4,
      c.D_6, c.D_6, c.D_6,
      c.D_9, c.D_9, c.D_9,
      c.D_10, c.D_10,

      c.S_2, c.S_2,
      c.S_3, c.S_3, c.S_3,
      c.S_4, c.S_4, c.S_4,
      c.S_5, c.S_5,

      c.C_7, c.C_J,

      c.H_2, c.H_2,
      c.H_K, c.H_K,
      c.H_A, c.H_A, c.H_A,
      c.H_Q, c.H_Q,
    ], tr));

    let lead: Flight;
    let play: CardPile;

    // invalid play: count too low
    lead = Play.extract([c.D_K, c.D_K], tr).fl();
    play = new CardPile([c.D_3], tr);
    expect(() => hand.follow_with(lead, play)).to.throw();

    // invalid play: count too high
    play = new CardPile([c.D_3, c.D_3, c.D_4], tr);
    expect(() => hand.follow_with(lead, play)).to.throw();

    // correct matching follow
    play = new CardPile([c.D_3, c.D_3], tr);
    expect(hand.follow_with(lead, play).follows).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♣[2]: 7♣ J♣
♦[11]: 4♦ 4♦ 4♦ 6♦ 6♦ 6♦ 9♦ 9♦ 9♦ 10♦ 10♦
♠[10]: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉[9]: 2♥ 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // correct failure to follow (no match)
    lead = Play.extract([c.C_J, c.C_J], tr).fl();
    play = new CardPile([c.C_7, c.C_J], tr);
    expect(hand.follow_with(lead, play).follows).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦[11]: 4♦ 4♦ 4♦ 6♦ 6♦ 6♦ 9♦ 9♦ 9♦ 10♦ 10♦
♠[10]: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉[9]: 2♥ 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // failure to match triple
    lead = Play.extract([c.D_K, c.D_K, c.D_K], tr).fl();
    play = new CardPile([c.D_4, c.D_4, c.D_9], tr);
    expect(hand.follow_with(lead, play).follows).to.be.false;
    expect(hand.pile.toString()).to.equal(`
♦[8]: 4♦ 6♦ 6♦ 6♦ 9♦ 9♦ 10♦ 10♦
♠[10]: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉[9]: 2♥ 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // failure to match double
    lead = Play.extract([c.D_K, c.D_K], tr).fl();
    play = new CardPile([c.D_4, c.D_10], tr);
    expect(hand.follow_with(lead, play).follows).to.be.false;
    expect(hand.pile.toString()).to.equal(`
♦[6]: 6♦ 6♦ 6♦ 9♦ 9♦ 10♦
♠[10]: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉[9]: 2♥ 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // correct best-effort follow
    lead = Play.extract([c.D_K, c.D_K, c.D_K, c.D_K], tr).fl();
    play = new CardPile([c.D_6, c.D_6, c.D_6, c.D_10], tr);
    expect(hand.follow_with(lead, play).follows).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦[2]: 9♦ 9♦
♠[10]: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉[9]: 2♥ 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // correct partial void follow
    lead = Play.extract([c.D_K, c.D_K, c.D_K], tr).fl();
    play = new CardPile([c.D_9, c.D_9, c.H_2], tr);
    expect(hand.follow_with(lead, play).follows).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♠[10]: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉[8]: 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // correct total void follow
    lead = Play.extract([c.D_K, c.D_K], tr).fl();
    play = new CardPile([c.H_2, c.H_K], tr);
    expect(hand.follow_with(lead, play).follows).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♠[10]: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉[6]: K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );
  });

  it('handles tractors', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.Q);
    let hand = new Hand(new CardPile([
      c.D_3, c.D_3,
      c.D_6, c.D_6, c.D_6,
      c.D_9, c.D_9, c.D_9,
      c.D_8, c.D_J,
    ], tr));

    let lead: Flight;
    let play: CardPile;

    // invalid play: only one pair of two played to match tractor
    lead = Play.extract([c.D_K, c.D_K, c.D_A, c.D_A], tr).fl();
    play = new CardPile([c.D_3, c.D_3, c.D_8, c.D_J], tr);
    expect(hand.follow_with(lead, play).follows).to.be.false;
  });

  it('deals with impractically complicated cases', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.Q);
    let cards = [
      c.C_3, c.C_3,
      c.C_4, c.C_4,
      c.C_5, c.C_5,

      c.C_7, c.C_7, c.C_7,
      c.C_8, c.C_8, c.C_8,

      c.C_10, c.C_10,
      c.C_J, c.C_J, c.C_J,
      c.C_K, c.C_K, c.C_K,
      c.C_A, c.C_A,
    ];

    let lead: Flight;
    let play: CardPile;

    lead = Play.extract([
      c.C_9, c.C_9, c.C_9,
      c.C_10, c.C_10, c.C_10,

      c.C_4, c.C_4,
      c.C_5, c.C_5,
      c.C_6, c.C_6,
      c.C_7, c.C_7,

      c.C_A, c.C_A,

      c.C_K, c.C_J,
    ], tr).fl();

    expect(lead.toString(tr)).to.equal(
      '[9♣9♣9♣10♣10♣10♣][4♣4♣5♣5♣6♣6♣7♣7♣][A♣A♣][K♣][J♣]'
    );

    // ambiguous misplay
    let hand1 = new Hand(new CardPile(cards, tr));
    play = new CardPile([
      c.C_J, c.C_J, c.C_J,
      c.C_K, c.C_K, c.C_K,

      c.C_3, c.C_3,
      c.C_4, c.C_4,
      c.C_5, c.C_5,

      c.C_10, c.C_10,
      c.C_A, c.C_A,

      c.C_8, c.C_7,
    ], tr);
    let hand1_str =
      '♣[22]: 3♣ 3♣ 4♣ 4♣ 5♣ 5♣ 7♣ 7♣ 7♣ 8♣ 8♣ 8♣ 10♣ 10♣ J♣ J♣ J♣ K♣ K♣ K♣ A♣ A♣';

    expect(hand1.pile.toString()).to.equal(hand1_str);

    let {follows, undo_chain} = hand1.follow_with(lead, play);
    expect(hand1.pile.toString()).to.equal('♣[4]: 7♣ 7♣ 8♣ 8♣');
    expect(follows).to.be.false;

    hand1.undo(play, undo_chain);
    expect(hand1.pile.toString()).to.equal(hand1_str);

    // ambiguous follow
    let hand2 = new Hand(new CardPile(cards, tr));
    play = new CardPile([
      c.C_7, c.C_7, c.C_7,
      c.C_8, c.C_8, c.C_8,

      c.C_10, c.C_10,
      c.C_J, c.C_J,
      c.C_K, c.C_K,
      c.C_A, c.C_A,

      c.C_3, c.C_3,

      c.C_K, c.C_J,
    ], tr);
    expect(hand2.follow_with(lead, play).follows).to.be.true;
  });

  const fresh_flight = (fl: Flight) => new Flight(
    fl.tractors.map(trc => new Tractor(trc.shape, trc.card))
  );

  it('avoids priority inversion', () => {
    const cards = [
      c.C_4, c.C_4,
      c.C_5, c.C_5,
      c.C_J, c.C_J, c.C_J,
      c.C_A,

      c.H_3, c.H_4,
      c.H_A, c.H_A,
    ];

    { // big pairs lead beats small tractor
      const tr = new TrumpMeta(Suit.HEARTS, Rank.Q);
      const lead = Play.extract([c.C_10, c.C_10, c.C_A, c.C_A], tr).fl();

      expect(lead.toString(tr)).to.equal('[A♣A♣][10♣10♣]');

      const hand = new Hand(new CardPile(cards, tr));
      const play = new CardPile([c.C_4, c.C_4, c.C_5, c.C_5], tr);

      const {follows, undo_chain, parses} = hand.follow_with(lead, play);
      expect(follows).to.be.true;
      expect(parses.length).to.equal(2);

      const sh = new Tractor.Shape(1, 2);
      const pair4 = new Tractor(sh, Card.from(c.C_4, tr));
      const pair5 = new Tractor(sh, Card.from(c.C_5, tr));

      expect(
        parses.map(fresh_flight)
      ).to.have.deep.members([
        new Flight([pair4, pair5]),
        new Flight([pair5, pair4]),
      ]);
      expect(lead.beats(parses[0])).to.be.true;
      expect(lead.beats(parses[1])).to.be.true;
    }

    { // trump fly with pair beats non-trump singleton fly
      const tr = new TrumpMeta(Suit.HEARTS, Rank.Q);
      const lead = Play.extract([c.S_5, c.S_J, c.S_A], tr).fl();

      expect(lead.toString(tr)).to.equal('[A♠][J♠][5♠]');

      const hand = new Hand(new CardPile(cards, tr));
      const play = new CardPile([c.H_3, c.H_A, c.H_A], tr);

      const {follows, undo_chain, parses} = hand.follow_with(lead, play);
      expect(follows).to.be.true;
      expect(parses.length).to.equal(1);

      const sh = new Tractor.Shape(1, 1);

      expect(
        parses.map(fresh_flight)
      ).to.have.deep.members([
        new Flight(
          [...play.gen_cards()].map(card => new Tractor(sh, card))
        )
      ]);
      expect(!lead.beats(parses[0])).to.be.true;
    }

    { // natural trump only fly with pair beats non-trump singleton fly
      const tr = new TrumpMeta(Suit.TRUMP, 4);
      const lead = Play.extract([c.S_5, c.S_J, c.S_A], tr).fl();

      expect(lead.toString(tr)).to.equal('[A♠][J♠][5♠]');

      const hand = new Hand(new CardPile(cards, tr));
      const play = new CardPile([c.C_4, c.C_4, c.H_4], tr);

      const {follows, undo_chain, parses} = hand.follow_with(lead, play);
      expect(follows).to.be.true;
      expect(parses.length).to.equal(1);

      const sh = new Tractor.Shape(1, 1);

      expect(
        parses.map(fresh_flight)
      ).to.have.deep.members([
        new Flight(
          [...play.gen_cards()].map(card => new Tractor(sh, card))
        )
      ]);
      expect(!lead.beats(parses[0])).to.be.true;
    }

    { // two trump pair doesn't beat non-trump tractor
      const tr = new TrumpMeta(Suit.CLUBS, Rank.Q);
      const lead = Play.extract([c.S_3, c.S_3, c.S_4, c.S_4], tr).fl();

      expect(lead.toString(tr)).to.equal('3♠3♠4♠4♠');

      const hand = new Hand(new CardPile(cards, tr));
      const play = new CardPile([c.C_5, c.C_5, c.C_J, c.C_J], tr);

      const {follows, undo_chain, parses} = hand.follow_with(lead, play);
      expect(follows).to.be.true;
      expect(parses.length).to.equal(0);

      expect(lead.beats(Play.extract([...play.gen_cards()], tr))).to.be.true;
    }
  });

  it('handles off-suit natural trumps', () => {
    const cards = [
      c.D_5, c.D_6, c.D_6,
      c.H_3, c.H_3, c.H_Q, c.H_Q,
      c.D_2, c.D_2, c.H_2, c.H_2,
      c.J_B, c.J_B,
    ];

    { // osnt tuples
      const tr = new TrumpMeta(Suit.SPADES, 2);
      const lead = Play.extract([c.S_10, c.S_10], tr).fl();

      expect(lead.toString(tr)).to.equal('10♠10♠');

      const hand = new Hand(new CardPile(cards, tr));
      const play = new CardPile([c.D_2, c.D_2], tr);

      const {follows, undo_chain, parses} = hand.follow_with(lead, play);
      expect(follows).to.be.true;
    }

    { // osnt tractors
      const tr = new TrumpMeta(Suit.HEARTS, 2);
      const lead = Play.extract([c.H_10, c.H_10, c.H_J, c.H_J], tr).fl();

      expect(lead.toString(tr)).to.equal('10♥10♥J♥J♥');

      const hand = new Hand(new CardPile(cards, tr));
      const play = new CardPile([c.D_2, c.D_2, c.H_2, c.H_2], tr);

      const {follows, undo_chain, parses} = hand.follow_with(lead, play);
      expect(follows).to.be.true;
    }
  });

  it('pairs forcing triples', () => {
    const cards = [
      c.S_J, c.S_J, c.S_J,
      c.S_A, c.S_A, c.S_A,
    ];

    {
      const tr = new TrumpMeta(Suit.SPADES, 2);
      const lead = Play.extract([
        c.S_3, c.S_3,
        c.S_4, c.S_4,
        c.S_5, c.S_5,
      ], tr).fl();

      expect(lead.toString(tr)).to.equal('3♠3♠4♠4♠5♠5♠');

      const hand = new Hand(new CardPile(cards, tr));
      const play = new CardPile([
        c.S_J, c.S_J, c.S_J,
        c.S_A, c.S_A, c.S_A,
      ], tr);

      const {follows, undo_chain, parses} = hand.follow_with(lead, play, true);
      expect(follows).to.be.true;
    }
  });
});
