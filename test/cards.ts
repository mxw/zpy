import {
  Suit, Rank, TrumpMeta, BoringCard, Card, CardPile
} from '../src/lib/cards';

import {expect} from 'chai';

describe('Card', () => {
  it('canonicalizes correctly', () => {
    let card;
    let tr = new TrumpMeta(Suit.HEARTS, 7);

    card = new Card(Suit.CLUBS, Rank.K, tr);
    expect(card.suit).to.equal(Suit.CLUBS);
    expect(card.rank).to.equal(Rank.K);

    card = new Card(Suit.HEARTS, Rank.K, tr);
    expect(card.suit).to.equal(Suit.TRUMP);
    expect(card.rank).to.equal(Rank.K);

    card = new Card(Suit.CLUBS, 7, tr);
    expect(card.suit).to.equal(Suit.TRUMP);
    expect(card.rank).to.equal(Rank.N_off);

    card = new Card(Suit.HEARTS, 7, tr);
    expect(card.suit).to.equal(Suit.TRUMP);
    expect(card.rank).to.equal(Rank.N_on);

    card = new Card(Suit.TRUMP, Rank.B, tr);
    expect(card.suit).to.equal(Suit.TRUMP);
    expect(card.rank).to.equal(Rank.B);
  });
});

describe('CardPile', () => {
  it ('works as advertised', () => {
    let tr = new TrumpMeta(Suit.SPADES, 7);

    let pile = new CardPile([
      new BoringCard(Suit.CLUBS, Rank.K),
      new BoringCard(Suit.CLUBS, Rank.K),
      new BoringCard(Suit.CLUBS, 3),
      new BoringCard(Suit.CLUBS, 7),
      new BoringCard(Suit.CLUBS, 7),
      new BoringCard(Suit.DIAMONDS, Rank.J),
      new BoringCard(Suit.DIAMONDS, Rank.A),
      new BoringCard(Suit.DIAMONDS, 2),
      new BoringCard(Suit.SPADES, 2),
      new BoringCard(Suit.SPADES, 2),
      new BoringCard(Suit.SPADES, Rank.A),
      new BoringCard(Suit.DIAMONDS, 7),
      new BoringCard(Suit.DIAMONDS, 7),
      new BoringCard(Suit.DIAMONDS, 7),
      new BoringCard(Suit.HEARTS, 2),
      new BoringCard(Suit.HEARTS, 10),
      new BoringCard(Suit.HEARTS, 9),
      new BoringCard(Suit.HEARTS, Rank.A),
      new BoringCard(Suit.SPADES, 7),
      new BoringCard(Suit.HEARTS, 8),
      new BoringCard(Suit.TRUMP, Rank.B),
      new BoringCard(Suit.TRUMP, Rank.S),
      new BoringCard(Suit.TRUMP, Rank.B),
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
