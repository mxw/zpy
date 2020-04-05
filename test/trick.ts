import {
  Suit, Rank, TrumpMeta, CardBase, Card, CardPile
} from '../src/lib/cards';
import {
  CardTuple, Tractor, Flight, Play, Hand
} from '../src/lib/trick';

import {expect} from 'chai';

describe('Play#extract', () => {
  it('extracts structure from a tiny pile of cards', () => {
    let tr = new TrumpMeta(Suit.CLUBS, Rank.Q);
    let cards = [
      new Card(Suit.SPADES, Rank.K, tr),
      new Card(Suit.SPADES, Rank.K, tr),
    ];
    let play = Play.extract(cards, tr);

    expect(play.toString(tr)).to.equal(
      'K♠K♠'
    );
    expect(play.count).to.equal(cards.length);
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
    let play = Play.extract(cards, tr);

    expect(play.toString(tr)).to.equal(
      '[2♣2♣3♣3♣4♣4♣][3♣3♣][A♣]'
    );
    expect(play.count).to.equal(cards.length);
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
    let play = Play.extract(cards, tr);

    expect(play.toString(tr)).to.equal(
      '[6♦6♦6♦6♦7♦7♦7♦7♦][8♦8♦9♦9♦][5♦5♦]'
    );
    expect(play.count).to.equal(cards.length);
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
    let play = Play.extract(cards, tr);

    expect(play.toString(tr)).to.equal(
      '[J♠J♠J♠J♠Q♠Q♠Q♠Q♠][9♠9♠9♠10♠10♠10♠][3♠3♠4♠4♠][6♠]'
    );
    expect(play.count).to.equal(cards.length);
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
    let me = Play.extract([
      new Card(Suit.CLUBS, 10, tr),
    ], tr).fl();
    let you = Play.extract([
      new Card(Suit.CLUBS, Rank.Q, tr),
    ], tr);
    expect(me.beats(you)).to.be.false;
    expect(you.beats(me)).to.be.true;
  });

  it('handles suit mismatches', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([
      new Card(Suit.CLUBS, Rank.K, tr),
    ], tr).fl();
    let you = Play.extract([
      new Card(Suit.DIAMONDS, Rank.Q, tr),
    ], tr);
    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });

  it('handles trumping', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([
      new Card(Suit.HEARTS, 4, tr),
    ], tr).fl();
    let you = Play.extract([
      new Card(Suit.SPADES, Rank.A, tr),
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.false;
  });

  it('handles tuple vs. tuple', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
    ], tr).fl();
    let you = Play.extract([
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ], tr);

    expect(me.beats(you)).to.be.false;
    expect(you.beats(me)).to.be.true;
  });

  it('handles tuple vs. non-tuple', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
    ], tr).fl();
    let you = Play.extract([
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, Rank.A, tr),
    ], tr);

    expect(me.beats(you)).to.be.true;
    expect(you.beats(me)).to.be.true;
  });

  it('handles tractor vs. tractor', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.J);
    let me = Play.extract([
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
    ], tr).fl();
    let you = Play.extract([
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
    let me = Play.extract([
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 7, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 8, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ], tr).fl();
    let you = Play.extract([
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
    let me = Play.extract([
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
    ], tr).fl();
    let you = Play.extract([
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
    let me = Play.extract([
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
    ], tr).fl();
    let you = Play.extract([
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
    let me = Play.extract([
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
    ], tr).fl();
    let you = Play.extract([
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
    let me = Play.extract([
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
    ], tr).fl();
    let you = Play.extract([
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

    let lead: Flight;
    let play: CardPile;

    // invalid play: missing card
    lead = Play.extract([
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr).fl();
    play = new CardPile([
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr);
    expect(() => hand.follow_with(lead, play)[0]).to.throw();

    // on-suit follow
    play = new CardPile([
      new Card(Suit.DIAMONDS, 4, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦: 4♦
♠: 8♠ 9♠
☉: J♣ J♥
`.trim()
    );

    // basic renege
    play = new CardPile([
      new Card(Suit.SPADES, 9, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.false;
    expect(hand.pile.toString()).to.equal(`
♦: 4♦
♠: 8♠
☉: J♣ J♥
`.trim()
    );

    // void-of-suit follow
    lead = Play.extract([
      new Card(Suit.CLUBS, Rank.K, tr),
    ], tr).fl();
    play = new CardPile([
      new Card(Suit.SPADES, 8, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦: 4♦
☉: J♣ J♥
`.trim()
    );

    // natural trump follow
    lead = Play.extract([
      new Card(Suit.HEARTS, 4, tr),
    ], tr).fl();
    play = new CardPile([
      new Card(Suit.CLUBS, Rank.J, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦: 4♦
☉: J♥
`.trim()
    );
  });

  it('handles tuples', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.Q);
    let hand = new Hand(new CardPile([
      new CardBase(Suit.DIAMONDS, 3),
      new CardBase(Suit.DIAMONDS, 3),
      new CardBase(Suit.DIAMONDS, 4),
      new CardBase(Suit.DIAMONDS, 4),
      new CardBase(Suit.DIAMONDS, 4),
      new CardBase(Suit.DIAMONDS, 6),
      new CardBase(Suit.DIAMONDS, 6),
      new CardBase(Suit.DIAMONDS, 6),
      new CardBase(Suit.DIAMONDS, 9),
      new CardBase(Suit.DIAMONDS, 9),
      new CardBase(Suit.DIAMONDS, 9),
      new CardBase(Suit.DIAMONDS, 10),
      new CardBase(Suit.DIAMONDS, 10),
      new CardBase(Suit.SPADES, 2),
      new CardBase(Suit.SPADES, 2),
      new CardBase(Suit.SPADES, 3),
      new CardBase(Suit.SPADES, 3),
      new CardBase(Suit.SPADES, 3),
      new CardBase(Suit.SPADES, 4),
      new CardBase(Suit.SPADES, 4),
      new CardBase(Suit.SPADES, 4),
      new CardBase(Suit.SPADES, 5),
      new CardBase(Suit.SPADES, 5),
      new CardBase(Suit.CLUBS, 7),
      new CardBase(Suit.CLUBS, Rank.J),
      new CardBase(Suit.HEARTS, 2),
      new CardBase(Suit.HEARTS, 2),
      new CardBase(Suit.HEARTS, Rank.K),
      new CardBase(Suit.HEARTS, Rank.K),
      new CardBase(Suit.HEARTS, Rank.A),
      new CardBase(Suit.HEARTS, Rank.A),
      new CardBase(Suit.HEARTS, Rank.A),
      new CardBase(Suit.HEARTS, Rank.Q),
      new CardBase(Suit.HEARTS, Rank.Q),
    ], tr));

    let lead: Flight;
    let play: CardPile;

    // invalid play: count too low
    lead = Play.extract([
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr).fl();
    play = new CardPile([
      new Card(Suit.DIAMONDS, 3, tr),
    ], tr);
    expect(() => hand.follow_with(lead, play)[0]).to.throw();

    // invalid play: count too high
    play = new CardPile([
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 4, tr),
    ], tr);
    expect(() => hand.follow_with(lead, play)[0]).to.throw();

    // correct matching follow
    play = new CardPile([
      new Card(Suit.DIAMONDS, 3, tr),
      new Card(Suit.DIAMONDS, 3, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♣: 7♣ J♣
♦: 4♦ 4♦ 4♦ 6♦ 6♦ 6♦ 9♦ 9♦ 9♦ 10♦ 10♦
♠: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉: 2♥ 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // correct failure to follow (no match)
    lead = Play.extract([
      new Card(Suit.CLUBS, Rank.J, tr),
      new Card(Suit.CLUBS, Rank.J, tr),
    ], tr).fl();
    play = new CardPile([
      new Card(Suit.CLUBS, 7, tr),
      new Card(Suit.CLUBS, Rank.J, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦: 4♦ 4♦ 4♦ 6♦ 6♦ 6♦ 9♦ 9♦ 9♦ 10♦ 10♦
♠: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉: 2♥ 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // failure to match triple
    lead = Play.extract([
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr).fl();
    play = new CardPile([
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 9, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.false;
    expect(hand.pile.toString()).to.equal(`
♦: 4♦ 6♦ 6♦ 6♦ 9♦ 9♦ 10♦ 10♦
♠: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉: 2♥ 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // failure to match double
    lead = Play.extract([
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr).fl();
    play = new CardPile([
      new Card(Suit.DIAMONDS, 4, tr),
      new Card(Suit.DIAMONDS, 10, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.false;
    expect(hand.pile.toString()).to.equal(`
♦: 6♦ 6♦ 6♦ 9♦ 9♦ 10♦
♠: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉: 2♥ 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // correct best-effort follow
    lead = Play.extract([
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr).fl();
    play = new CardPile([
      new Card(Suit.DIAMONDS, 6, tr),
      new Card(Suit.DIAMONDS, 6, tr),
      new Card(Suit.DIAMONDS, 6, tr),
      new Card(Suit.DIAMONDS, 10, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♦: 9♦ 9♦
♠: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉: 2♥ 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // correct partial void follow
    lead = Play.extract([
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr).fl();
    play = new CardPile([
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.DIAMONDS, 9, tr),
      new Card(Suit.HEARTS, 2, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♠: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉: 2♥ K♥ K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );

    // correct total void follow
    lead = Play.extract([
      new Card(Suit.DIAMONDS, Rank.K, tr),
      new Card(Suit.DIAMONDS, Rank.K, tr),
    ], tr).fl();
    play = new CardPile([
      new Card(Suit.HEARTS, 2, tr),
      new Card(Suit.HEARTS, Rank.K, tr),
    ], tr);
    expect(hand.follow_with(lead, play)[0]).to.be.true;
    expect(hand.pile.toString()).to.equal(`
♠: 2♠ 2♠ 3♠ 3♠ 3♠ 4♠ 4♠ 4♠ 5♠ 5♠
☉: K♥ A♥ A♥ A♥ Q♥ Q♥
`.trim()
    );
  });

  it('deals with impractically complicated cases', () => {
    let tr = new TrumpMeta(Suit.HEARTS, Rank.Q);
    let cards = [
      new CardBase(Suit.CLUBS, 3),
      new CardBase(Suit.CLUBS, 3),
      new CardBase(Suit.CLUBS, 4),
      new CardBase(Suit.CLUBS, 4),
      new CardBase(Suit.CLUBS, 5),
      new CardBase(Suit.CLUBS, 5),

      new CardBase(Suit.CLUBS, 7),
      new CardBase(Suit.CLUBS, 7),
      new CardBase(Suit.CLUBS, 7),
      new CardBase(Suit.CLUBS, 8),
      new CardBase(Suit.CLUBS, 8),
      new CardBase(Suit.CLUBS, 8),

      new CardBase(Suit.CLUBS, 10),
      new CardBase(Suit.CLUBS, 10),
      new CardBase(Suit.CLUBS, Rank.J),
      new CardBase(Suit.CLUBS, Rank.J),
      new CardBase(Suit.CLUBS, Rank.J),
      new CardBase(Suit.CLUBS, Rank.K),
      new CardBase(Suit.CLUBS, Rank.K),
      new CardBase(Suit.CLUBS, Rank.K),
      new CardBase(Suit.CLUBS, Rank.A),
      new CardBase(Suit.CLUBS, Rank.A),
    ];

    let lead: Flight;
    let play: CardPile;

    lead = Play.extract([
      new Card(Suit.CLUBS, 9, tr),
      new Card(Suit.CLUBS, 9, tr),
      new Card(Suit.CLUBS, 9, tr),
      new Card(Suit.CLUBS, 10, tr),
      new Card(Suit.CLUBS, 10, tr),
      new Card(Suit.CLUBS, 10, tr),

      new Card(Suit.CLUBS, 4, tr),
      new Card(Suit.CLUBS, 4, tr),
      new Card(Suit.CLUBS, 5, tr),
      new Card(Suit.CLUBS, 5, tr),
      new Card(Suit.CLUBS, 6, tr),
      new Card(Suit.CLUBS, 6, tr),
      new Card(Suit.CLUBS, 7, tr),
      new Card(Suit.CLUBS, 7, tr),

      new Card(Suit.CLUBS, Rank.A, tr),
      new Card(Suit.CLUBS, Rank.A, tr),

      new Card(Suit.CLUBS, Rank.K, tr),
      new Card(Suit.CLUBS, Rank.J, tr),
    ], tr).fl();

    expect(lead.toString(tr)).to.equal(
      '[9♣9♣9♣10♣10♣10♣][4♣4♣5♣5♣6♣6♣7♣7♣][A♣A♣][K♣][J♣]'
    );

    // ambiguous misplay
    let hand1 = new Hand(new CardPile(cards, tr));
    play = new CardPile([
      new Card(Suit.CLUBS, Rank.J, tr),
      new Card(Suit.CLUBS, Rank.J, tr),
      new Card(Suit.CLUBS, Rank.J, tr),
      new Card(Suit.CLUBS, Rank.K, tr),
      new Card(Suit.CLUBS, Rank.K, tr),
      new Card(Suit.CLUBS, Rank.K, tr),

      new Card(Suit.CLUBS, 3, tr),
      new Card(Suit.CLUBS, 3, tr),
      new Card(Suit.CLUBS, 4, tr),
      new Card(Suit.CLUBS, 4, tr),
      new Card(Suit.CLUBS, 5, tr),
      new Card(Suit.CLUBS, 5, tr),

      new Card(Suit.CLUBS, 10, tr),
      new Card(Suit.CLUBS, 10, tr),

      new Card(Suit.CLUBS, Rank.A, tr),
      new Card(Suit.CLUBS, Rank.A, tr),

      new Card(Suit.CLUBS, 8, tr),
      new Card(Suit.CLUBS, 7, tr),
    ], tr);
    let hand1_str =
      '♣: 3♣ 3♣ 4♣ 4♣ 5♣ 5♣ 7♣ 7♣ 7♣ 8♣ 8♣ 8♣ 10♣ 10♣ J♣ J♣ J♣ K♣ K♣ K♣ A♣ A♣';

    expect(hand1.pile.toString()).to.equal(hand1_str);

    let [result, undo] = hand1.follow_with(lead, play);
    expect(hand1.pile.toString()).to.equal('♣: 7♣ 7♣ 8♣ 8♣');
    expect(result).to.be.false;

    hand1.undo(play, undo);
    expect(hand1.pile.toString()).to.equal(hand1_str);

    // ambiguous follow
    let hand2 = new Hand(new CardPile(cards, tr));
    play = new CardPile([
      new Card(Suit.CLUBS, 7, tr),
      new Card(Suit.CLUBS, 7, tr),
      new Card(Suit.CLUBS, 7, tr),
      new Card(Suit.CLUBS, 8, tr),
      new Card(Suit.CLUBS, 8, tr),
      new Card(Suit.CLUBS, 8, tr),

      new Card(Suit.CLUBS, 10, tr),
      new Card(Suit.CLUBS, 10, tr),
      new Card(Suit.CLUBS, Rank.J, tr),
      new Card(Suit.CLUBS, Rank.J, tr),
      new Card(Suit.CLUBS, Rank.K, tr),
      new Card(Suit.CLUBS, Rank.K, tr),
      new Card(Suit.CLUBS, Rank.A, tr),
      new Card(Suit.CLUBS, Rank.A, tr),

      new Card(Suit.CLUBS, 3, tr),
      new Card(Suit.CLUBS, 3, tr),

      new Card(Suit.CLUBS, Rank.K, tr),
      new Card(Suit.CLUBS, Rank.J, tr),
    ], tr);
    expect(hand2.follow_with(lead, play)[0]).to.be.true;
  });
});
