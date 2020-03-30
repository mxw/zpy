import {
  Suit, Rank, TrumpMeta, CardBase, Card, CardPile
} from '../src/lib/cards';
import {
  CardTuple, Tractor, Flight, Hand
} from '../src/lib/trick';

import {expect} from 'chai';

describe('Flight#extract', () => {
  it('extracts structure from a tiny pile of cards', () => {
    let tr = new TrumpMeta(Suit.CLUBS, Rank.Q);
    let cards = [
      new Card(Suit.SPADES, Rank.K, tr),
      new Card(Suit.SPADES, Rank.K, tr),
    ];
    let flight = Flight.extract(cards, tr);

    expect(flight.toString(tr)).to.equal(
      'K♠K♠'
    );
    expect(flight.total).to.equal(cards.length);
  });

  it('extracts structure from a pile of cards', () => {
    let tr = new TrumpMeta(Suit.DIAMONDS, Rank.Q);
    let cards = [
      new Card(Suit.CLUBS, 2, tr),
      new Card(Suit.CLUBS, 2, tr),
      new Card(Suit.CLUBS, 3, tr),
      new Card(Suit.CLUBS, 3, tr),
      new Card(Suit.CLUBS, 3, tr),
      new Card(Suit.CLUBS, 3, tr),
      new Card(Suit.CLUBS, 4, tr),
      new Card(Suit.CLUBS, 4, tr),
      new Card(Suit.CLUBS, Rank.A, tr),
    ];
    let flight = Flight.extract(cards, tr);

    expect(flight.toString(tr)).to.equal(
      '[2♣2♣3♣3♣4♣4♣][3♣3♣][A♣]'
    );
    expect(flight.total).to.equal(cards.length);
  });

  it('extracts structure from a more complicated pile of cards', () => {
    let tr = new TrumpMeta(Suit.SPADES, Rank.Q);
    let cards = [
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, 6, tr),
      new Card(Suit.DIAMONDS, 6, tr),
      new Card(Suit.DIAMONDS, 6, tr),
      new Card(Suit.DIAMONDS, 6, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ];
    let flight = Flight.extract(cards, tr);

    expect(flight.toString(tr)).to.equal(
      '[6♦6♦6♦6♦7♦7♦7♦7♦][8♦8♦9♦9♦][5♦5♦]'
    );
    expect(flight.total).to.equal(cards.length);
  });

  it('extracts structure from discontiguous chunks with thicc tail', () => {
    let tr = new TrumpMeta(Suit.TRUMP, Rank.B);
    let cards = [
      new Card(Suit.SPADES, 3, tr),
      new Card(Suit.SPADES, 3, tr),
      new Card(Suit.SPADES, 4, tr),
      new Card(Suit.SPADES, 4, tr),
      new Card(Suit.SPADES, 6, tr),
      new Card(Suit.SPADES, 9, tr),
      new Card(Suit.SPADES, 9, tr),
      new Card(Suit.SPADES, 9, tr),
      new Card(Suit.SPADES, 10, tr),
      new Card(Suit.SPADES, 10, tr),
      new Card(Suit.SPADES, 10, tr),
      new Card(Suit.SPADES, Rank.J, tr),
      new Card(Suit.SPADES, Rank.J, tr),
      new Card(Suit.SPADES, Rank.J, tr),
      new Card(Suit.SPADES, Rank.J, tr),
      new Card(Suit.SPADES, Rank.Q, tr),
      new Card(Suit.SPADES, Rank.Q, tr),
      new Card(Suit.SPADES, Rank.Q, tr),
      new Card(Suit.SPADES, Rank.Q, tr),
    ];
    let flight = Flight.extract(cards, tr);

    expect(flight.toString(tr)).to.equal(
      '[J♠J♠J♠J♠Q♠Q♠Q♠Q♠][9♠9♠9♠10♠10♠10♠][3♠3♠4♠4♠][6♠]'
    );
    expect(flight.total).to.equal(cards.length);
  });

  it('extracts structure from natural trump tractors', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let cards = [
      new Card(Suit.HEARTS, Rank.Q, tr),
      new Card(Suit.HEARTS, Rank.A, tr),
      new Card(Suit.HEARTS, Rank.A, tr),
      new Card(Suit.CLUBS,  Rank.J, tr),
      new Card(Suit.CLUBS,  Rank.J, tr),
      new Card(Suit.HEARTS, Rank.J, tr),
      new Card(Suit.HEARTS, Rank.J, tr),
      new Card(Suit.TRUMP,  Rank.B, tr),
      new Card(Suit.TRUMP,  Rank.B, tr),
    ];
    let flight = Flight.extract(cards, tr);

    expect(flight.toString(tr)).to.equal(
      '[A♥A♥J♣J♣J♥J♥][W☉W☉][Q♥]'
    );
    expect(flight.total).to.equal(cards.length);
  });

  it('extracts structure from ambiguous natural trump tractors', () => {
    // XXX: this behavior is currently pretty shitty
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let cards = [
      new Card(Suit.HEARTS, Rank.A, tr),
      new Card(Suit.HEARTS, Rank.A, tr),
      new Card(Suit.HEARTS, Rank.A, tr),
      new Card(Suit.CLUBS,  Rank.J, tr),
      new Card(Suit.CLUBS,  Rank.J, tr),
      new Card(Suit.CLUBS,  Rank.J, tr),
      new Card(Suit.DIAMONDS,  Rank.J, tr),
      new Card(Suit.SPADES,  Rank.J, tr),
      new Card(Suit.SPADES,  Rank.J, tr),
      new Card(Suit.HEARTS, Rank.J, tr),
      new Card(Suit.HEARTS, Rank.J, tr),
      new Card(Suit.HEARTS, Rank.J, tr),
      new Card(Suit.TRUMP,  Rank.S, tr),
      new Card(Suit.TRUMP,  Rank.S, tr),
      new Card(Suit.TRUMP,  Rank.S, tr),
      new Card(Suit.TRUMP,  Rank.B, tr),
      new Card(Suit.TRUMP,  Rank.B, tr),
      new Card(Suit.TRUMP,  Rank.B, tr),
    ];
    let flight = Flight.extract(cards, tr);

    expect(flight.toString(tr)).to.equal(
      '[w☉w☉w☉W☉W☉W☉][A♥A♥A♥J♣J♣J♣][J♠J♠J♥J♥][J♥][J♦]'
    );
    expect(flight.total).to.equal(cards.length);
  });
});

describe('Flight#beats', () => {
  it('handles singleton tricks', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.CLUBS, 10, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.CLUBS, Rank.Q, tr),
    ], tr);
    expect(me.beats(you)).to.be.false;
    expect(you.beats(me)).to.be.true;
  });

  it('handles suit mismatches', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.CLUBS, Rank.K, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.DIAMONDS, Rank.Q, tr),
    ], tr);
    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });

  it('handles trumping', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.HEARTS, 4, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.SPADES, Rank.A, tr),
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.false;
  });

  it('handles tuple vs. tuple', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ], tr);

    expect(me.beats(you)).to.be.false;
    expect(you.beats(me)).to.be.true;
  });

  it('handles tuple vs. non-tuple', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, Rank.A, tr),
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });

  it('handles tractor vs. tractor', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ], tr);

    expect(me.beats(you)).to.be.false;
    expect(you.beats(me)).to.be.true;
  });

  it('handles tractor vs. different tractor', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });

  it('handles flight vs. flight', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.DIAMONDS, 2, tr),
      new Card(Suit.DIAMONDS, 2, tr),
      new Card(Suit.DIAMONDS, 2, tr),
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, 10, tr),
      new Card(Suit.DIAMONDS, 10, tr),
      new Card(Suit.DIAMONDS, Rank.Q, tr),
      new Card(Suit.DIAMONDS, Rank.Q, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr);

    expect(me.beats(you)).to.be.false;
    expect(you.beats(me)).to.be.true;
  });

  it('handles flight vs. different flight', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.DIAMONDS, 2, tr),
      new Card(Suit.DIAMONDS, 2, tr),
      new Card(Suit.DIAMONDS, 2, tr),
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, Rank.Q, tr),
      new Card(Suit.DIAMONDS, Rank.Q, tr),
      new Card(Suit.DIAMONDS, Rank.Q, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });

  it('handles flight vs. trump flight', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.HEARTS, 2, tr),
      new Card(Suit.HEARTS, 2, tr),
      new Card(Suit.HEARTS, 2, tr),
      new Card(Suit.HEARTS, 3, tr),
      new Card(Suit.HEARTS, 3, tr),
      new Card(Suit.HEARTS, 3, tr),
      new Card(Suit.HEARTS, 7, tr),
      new Card(Suit.HEARTS, 7, tr),
      new Card(Suit.HEARTS, 8, tr),
      new Card(Suit.HEARTS, 8, tr),
      new Card(Suit.HEARTS, 9, tr),
      new Card(Suit.HEARTS, 9, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, 5, tr),
      new Card(Suit.DIAMONDS, 10, tr),
      new Card(Suit.DIAMONDS, 10, tr),
      new Card(Suit.DIAMONDS, Rank.Q, tr),
      new Card(Suit.DIAMONDS, Rank.Q, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.false;
  });

  it('handles flight vs. failed trump flight', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Flight.extract([
      new Card(Suit.DIAMONDS, 2, tr),
      new Card(Suit.DIAMONDS, 2, tr),
      new Card(Suit.DIAMONDS, 2, tr),
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ], tr);
    let you = Flight.extract([
      new Card(Suit.HEARTS, 4, tr),
      new Card(Suit.HEARTS, 4, tr),
      new Card(Suit.HEARTS, 4, tr),
      new Card(Suit.HEARTS, 5, tr),
      new Card(Suit.HEARTS, 5, tr),
      new Card(Suit.HEARTS, 5, tr),
      new Card(Suit.HEARTS, Rank.Q, tr),
      new Card(Suit.HEARTS, Rank.Q, tr),
      new Card(Suit.HEARTS, Rank.Q, tr),
      new Card(Suit.HEARTS, Rank.K, tr),
      new Card(Suit.HEARTS, Rank.K, tr),
      new Card(Suit.HEARTS, Rank.K, tr),
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });
});

describe('Hand#follow_with', () => {
  it('handles singletons', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let hand = new Hand(new CardPile([
      new CardBase(Suit.DIAMONDS, 4),
      new CardBase(Suit.DIAMONDS, 4),
      new CardBase(Suit.SPADES, 8),
      new CardBase(Suit.SPADES, 9),
      new CardBase(Suit.CLUBS, Rank.J),
      new CardBase(Suit.HEARTS, Rank.J),
    ], tr));

    let lead1 = Flight.extract([
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr);
    let play1 = [
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ];
    expect(() => hand.follow_with(lead1, play1)).to.throw();

    let lead2 = lead1;
    let play2 = [
      new Card(Suit.DIAMONDS, 4, tr),
    ];
    expect(hand.follow_with(lead2, play2)).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦: 4♦
♠: 8♠ 9♠
☉: J♣ J♥
`.trim()
    );

    let lead3 = lead1;
    let play3 = [
      new Card(Suit.SPADES, 9, tr),
    ];
    expect(hand.follow_with(lead2, play3)).to.be.false;
    expect(hand.pile.toString()).to.equal(`
♦: 4♦
♠: 8♠
☉: J♣ J♥
`.trim()
    );

    let lead4 = Flight.extract([
      new Card(Suit.CLUBS, Rank.K, tr),
    ], tr);
    let play4 = [
      new Card(Suit.SPADES, 8, tr),
    ];
    expect(hand.follow_with(lead4, play4)).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦: 4♦
☉: J♣ J♥
`.trim()
    );

    let lead5 = Flight.extract([
      new Card(Suit.HEARTS, 4, tr),
    ], tr);
    let play5 = [
      new Card(Suit.CLUBS, Rank.J, tr),
    ];
    expect(hand.follow_with(lead5, play5)).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦: 4♦
☉: J♥
`.trim()
    );
  });
});
