import {
  Suit, Rank, TrumpMeta, CardBase, Card, CardPile
} from '../src/lib/cards';

import {expect} from 'chai';

describe('Card', () => {
  it('canonicalizes correctly', () => {
    let card;
    let tr = new TrumpMeta(Suit.HEARTS, 7);

    card = new Card(Suit.CLUBS, Rank.K, tr);
    expect(card.v_suit).to.equal(Suit.CLUBS);
    expect(card.v_rank).to.equal(Rank.K);

    card = new Card(Suit.HEARTS, Rank.K, tr);
    expect(card.v_suit).to.equal(Suit.TRUMP);
    expect(card.v_rank).to.equal(Rank.K);

    card = new Card(Suit.CLUBS, 7, tr);
    expect(card.v_suit).to.equal(Suit.TRUMP);
    expect(card.v_rank).to.equal(Rank.N_off);

    card = new Card(Suit.HEARTS, 7, tr);
    expect(card.v_suit).to.equal(Suit.TRUMP);
    expect(card.v_rank).to.equal(Rank.N_on);

    card = new Card(Suit.TRUMP, Rank.B, tr);
    expect(card.v_suit).to.equal(Suit.TRUMP);
    expect(card.v_rank).to.equal(Rank.B);
  });
});

describe('CardPile', () => {
  it ('works as advertised', () => {
    let tr = new TrumpMeta(Suit.SPADES, 7);

    let pile = new CardPile([
      new CardBase(Suit.CLUBS, Rank.K),
      new CardBase(Suit.CLUBS, Rank.K),
      new CardBase(Suit.CLUBS, 3),
      new CardBase(Suit.CLUBS, 7),
      new CardBase(Suit.CLUBS, 7),
      new CardBase(Suit.DIAMONDS, Rank.J),
      new CardBase(Suit.DIAMONDS, Rank.A),
      new CardBase(Suit.DIAMONDS, 2),
      new CardBase(Suit.SPADES, 2),
      new CardBase(Suit.SPADES, 2),
      new CardBase(Suit.SPADES, Rank.A),
      new CardBase(Suit.DIAMONDS, 7),
      new CardBase(Suit.DIAMONDS, 7),
      new CardBase(Suit.DIAMONDS, 7),
      new CardBase(Suit.HEARTS, 2),
      new CardBase(Suit.HEARTS, 10),
      new CardBase(Suit.HEARTS, 9),
      new CardBase(Suit.HEARTS, Rank.A),
      new CardBase(Suit.SPADES, 7),
      new CardBase(Suit.HEARTS, 8),
      new CardBase(Suit.TRUMP, Rank.B),
      new CardBase(Suit.TRUMP, Rank.S),
      new CardBase(Suit.TRUMP, Rank.B),
    ], tr);

    expect('' + pile).to.equal(`
♣: 3♣ K♣ K♣
♦: 2♦ J♦ A♦
♥: 2♥ 8♥ 9♥ 10♥ A♥
☉: 2♠ 2♠ A♠ 7♣ 7♣ 7♦ 7♦ 7♦ 7♠ w☉ W☉ W☉
`.trim()
    );
  });
});
