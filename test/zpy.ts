import {
  Suit, Rank, TrumpMeta, CardBase, Card, CardPile
} from 'lib/zpy/cards';
import {
  CardTuple, Tractor, Flight, Play, Hand
} from 'lib/zpy/trick';
import { ZPY } from 'lib/zpy/zpy';

import {expect} from 'chai';

describe('ZPY', () => {
  let expect_ok = <T>(result: ZPY.Result<T>) => {
    expect(result).not.to.be.an.instanceof(ZPY.Error);
  };
  let expect_err = <T>(result: ZPY.Result<T>, ty: Function, msg?: string) => {
    expect(result).to.be.an.instanceof(ty);
    if (result instanceof ZPY.Error && !!msg) {
      expect(result.msg).to.equal(msg);
    }
  };

  type PlayerID = string;

  it('plays a whole game', () => {
    let zpy = new ZPY<PlayerID>();
    zpy.set_debug();

    let a = 'aberdeen';
    let b = 'budapest';
    let c = 'chicago';
    let d = 'damascus';
    let e = 'edinburgh';

    /////////////////////////////////////////////////////////////////

    expect_ok(zpy.add_player(a));
    expect_ok(zpy.add_player(b));
    expect_ok(zpy.add_player(c));
    expect_ok(zpy.add_player(d));
    expect_ok(zpy.add_player(e));

    expect_err(zpy.add_player(a), ZPY.DuplicateActionError);
    expect_err(zpy.set_decks(b, 6), ZPY.WrongPlayerError);
    expect_err(zpy.start_game(c), ZPY.WrongPlayerError);

    expect_err(
      zpy.set_decks(a, 1),
      ZPY.InvalidArgError,
      'cannot have fewer than 2 decks'
    );
    expect_err(
      zpy.set_decks(a, 5),
      ZPY.InvalidArgError,
      'cannot have more than 4 decks'
    );
    expect_ok(zpy.set_decks(a, 2));
    expect_ok(zpy.start_game(a));

    zpy.stack_deck(6, 9); // nice
    zpy.stack_deck(9, 10);
    zpy.stack_deck(12, 15);
    zpy.stack_deck(35, 38);
    zpy.stack_deck(39, 48);
    zpy.stack_deck(54, 57);
    zpy.stack_deck(5, 19);

    /////////////////////////////////////////////////////////////////

    for (let i = 0; i < 10; ++i) {
      for (let p of [a, b, c, d, e]) {
        expect_ok(zpy.draw_card(p));
      }
      expect_err(zpy.draw_card(d), ZPY.OutOfTurnError);
    }

    expect_err(
      zpy.bid_trump(a, new CardBase(Suit.CLUBS, 2), 0),
      ZPY.InvalidArgError
    );
    expect_err(
      zpy.bid_trump(a, new CardBase(Suit.CLUBS, 2), 1),
      ZPY.InvalidArgError, 'bid not part of hand'
    );
    expect_err(
      zpy.bid_trump(a, new CardBase(Suit.DIAMONDS, 4), 1),
      ZPY.InvalidPlayError, 'invalid trump bid for rank 2'
    );
    expect_ok(
      zpy.bid_trump(c, new CardBase(Suit.CLUBS, 2), 1)
    );

    expect_err(
      zpy.bid_trump(c, new CardBase(Suit.DIAMONDS, 2), 1),
      ZPY.InvalidPlayError, 'cannot overturn own bid'
    );
    expect_err(
      zpy.bid_trump(b, new CardBase(Suit.HEARTS, 2), 1),
      ZPY.InvalidPlayError, 'bid too low'
    );

    for (let i = 0; i < 10; ++i) {
      for (let p of [a, b, c, d, e]) {
        expect_ok(zpy.draw_card(p));
      }
    }

    expect_ok(
      zpy.bid_trump(b, new CardBase(Suit.HEARTS, 2), 2)
    );

    for (let p of [b, e, c, d, a]) {
      expect_ok(zpy.ready(p));
    }

    /////////////////////////////////////////////////////////////////

    expect_err(
      zpy.replace_kitty(a, [
        new CardBase(Suit.DIAMONDS, Rank.Q),
        new CardBase(Suit.SPADES, 4),
      ]),
      ZPY.WrongPlayerError
    );

    expect_err(
      zpy.replace_kitty(b, [
        new CardBase(Suit.CLUBS, 5),
      ]),
      ZPY.InvalidPlayError, 'must discard exactly 8 cards for kitty'
    );

    expect_err(
      zpy.replace_kitty(b, [
        new CardBase(Suit.DIAMONDS, 5),
        new CardBase(Suit.DIAMONDS, 6),
        new CardBase(Suit.DIAMONDS, Rank.J),
        new CardBase(Suit.CLUBS, 3),
        new CardBase(Suit.CLUBS, 7),
        new CardBase(Suit.CLUBS, 8),
        new CardBase(Suit.CLUBS, Rank.Q),
        new CardBase(Suit.SPADES, 4),
      ]),
      ZPY.InvalidArgError, 'kitty not part of hand'
    );

    expect_ok(zpy.replace_kitty(b, [
      new CardBase(Suit.CLUBS, 5),
      new CardBase(Suit.CLUBS, 6),
      new CardBase(Suit.CLUBS, Rank.J),
      new CardBase(Suit.DIAMONDS, 3),
      new CardBase(Suit.DIAMONDS, 7),
      new CardBase(Suit.DIAMONDS, 8),
      new CardBase(Suit.DIAMONDS, Rank.Q),
      new CardBase(Suit.SPADES, 4),
    ]));

    expect_err(
      zpy.call_friends(a, [
        [new CardBase(Suit.DIAMONDS, Rank.A), 1]
      ]),
      ZPY.WrongPlayerError
    );
    expect_err(
      zpy.call_friends(b, [
        [new CardBase(Suit.DIAMONDS, Rank.A), 1],
        [new CardBase(Suit.CLUBS, Rank.A), 1]
      ]),
      ZPY.InvalidPlayError, 'must call exactly 1 friend'
    );
    expect_err(
      zpy.call_friends(b, [
        [new CardBase(Suit.DIAMONDS, Rank.A), 3]
      ]),
      ZPY.InvalidArgError, 'friend index 3 out of bounds'
    );
    expect_err(
      zpy.call_friends(b, [
        [new CardBase(Suit.TRUMP, Rank.B), 1]
      ]),
      ZPY.InvalidPlayError, 'no natural trump friend calls allowed'
    );

    expect_ok(zpy.call_friends(b, [
      [new CardBase(Suit.DIAMONDS, Rank.A), 1]
    ]));

    /////////////////////////////////////////////////////////////////

    let lead_impl = (p: PlayerID, ...cards: [Suit, Rank][]) => {
      return zpy.lead_play(p, Play.extract(
        cards.map(([suit, rank]) => new Card(suit, rank, zpy.tr)),
        zpy.tr
      ).fl());
    };
    let lead = (p: PlayerID, ...cards: [Suit, Rank][]) => {
      expect_ok(lead_impl(p, ...cards));
    };

    let follow_impl = (p: PlayerID, ...cards: [Suit, Rank][]) => {
      return zpy.follow_lead(p, Play.extract(
        cards.map(([suit, rank]) => new Card(suit, rank, zpy.tr)),
        zpy.tr
      ));
    };
    let follow = (p: PlayerID, ...cards: [Suit, Rank][]) => {
      expect(follow_impl(p, ...cards));
    };

    lead(b, [Suit.DIAMONDS, Rank.K]);

    expect_err(
      follow_impl(d, [Suit.DIAMONDS, 6]),
      ZPY.OutOfTurnError
    );
    expect_err(
      follow_impl(a, [Suit.DIAMONDS, 3]),
      ZPY.OutOfTurnError
    );
    expect_err(
      follow_impl(c, [Suit.DIAMONDS, 5]),
      ZPY.InvalidArgError, 'play not part of hand'
    );
    expect_err(
      follow_impl(c, [Suit.DIAMONDS, 6], [Suit.DIAMONDS, 7]),
      ZPY.InvalidPlayError, 'must follow with exactly 1 card'
    );

    follow(c, [Suit.DIAMONDS, 4]);
    follow(d, [Suit.DIAMONDS, 6]);
    expect_err(zpy.collect_trick(b), ZPY.OutOfTurnError);
    follow(e, [Suit.DIAMONDS, 9]);
    follow(a, [Suit.DIAMONDS, 3]);
    expect_err(zpy.collect_trick(e), ZPY.WrongPlayerError);
    expect_ok(zpy.collect_trick(b));

    lead(b, [Suit.SPADES, 9]);
    follow(c, [Suit.SPADES, Rank.A]);
    follow(d, [Suit.SPADES, 3]);
    follow(e, [Suit.SPADES, 6]);
    follow(a, [Suit.SPADES, 6]);
    expect_ok(zpy.collect_trick(c));

    lead(c, [Suit.CLUBS, 4]);
    follow(d, [Suit.CLUBS, Rank.A]);
    follow(e, [Suit.CLUBS, 3]);
    follow(a, [Suit.CLUBS, 6]);
    follow(b, [Suit.CLUBS, 10]);
    expect_ok(zpy.collect_trick(d));

    lead(d, [Suit.DIAMONDS, Rank.J]);
    follow(e, [Suit.DIAMONDS, Rank.A]);
    expect_err(
      zpy.undo_play(e),
      ZPY.InvalidPlayError, 'cannot undo a play that joined the host team'
    );
    follow(a, [Suit.DIAMONDS, 4]);
    follow(b, [Suit.SPADES, 10]);
    follow(c, [Suit.DIAMONDS, 6]);
    expect_ok(zpy.collect_trick(e));

    /////////////////////////////////////////////////////////////////

    lead(e, [Suit.CLUBS, 8], [Suit.CLUBS, 8], [Suit.CLUBS, Rank.K]);

    expect_err(
      zpy.contest_fly(e, [new CardBase(Suit.CLUBS, Rank.A)]),
      ZPY.WrongPlayerError
    );
    expect_err(
      zpy.contest_fly(a, [
        new CardBase(Suit.CLUBS, Rank.J),
        new CardBase(Suit.CLUBS, Rank.J),
      ]),
      ZPY.InvalidArgError, 'reveal not part of hand'
    );
    expect_err(
      zpy.contest_fly(a, [
        new CardBase(Suit.CLUBS, Rank.Q),
        new CardBase(Suit.DIAMONDS, Rank.A),
      ]),
      ZPY.InvalidPlayError, 'reveal is multiple suits'
    );
    expect_err(
      zpy.contest_fly(a, [
        new CardBase(Suit.DIAMONDS, Rank.A),
      ]),
      ZPY.InvalidPlayError, 'reveal is the wrong suit'
    );
    expect_err(
      zpy.contest_fly(a, [
        new CardBase(Suit.CLUBS, Rank.Q),
        new CardBase(Suit.CLUBS, 7),
      ]),
      ZPY.InvalidPlayError, 'reveal must be a singleton, tuple, or tractor'
    );
    expect_err(
      zpy.contest_fly(a, [
        new CardBase(Suit.CLUBS, Rank.Q),
      ]),
      ZPY.InvalidPlayError, 'reveal fails to counter fly'
    );
    expect_err(
      zpy.contest_fly(a, [
        new CardBase(Suit.CLUBS, 7),
        new CardBase(Suit.CLUBS, 7),
      ]),
      ZPY.InvalidPlayError, 'reveal fails to counter fly'
    );
    expect_err(
      zpy.contest_fly(d, [
        new CardBase(Suit.CLUBS, Rank.K),
      ]),
      ZPY.InvalidPlayError, 'reveal fails to counter fly'
    );

    expect_ok(zpy.contest_fly(a, [
      new CardBase(Suit.CLUBS, Rank.Q),
      new CardBase(Suit.CLUBS, Rank.Q),
    ]));

    follow(a, [Suit.CLUBS, Rank.Q], [Suit.CLUBS, Rank.Q]);
    follow(b, [Suit.HEARTS, 2], [Suit.HEARTS, 2]);
    follow(c, [Suit.CLUBS, 9], [Suit.CLUBS, 10]);
    follow(d, [Suit.CLUBS, 3], [Suit.CLUBS, 4]);
    expect_ok(zpy.collect_trick(b));

    /////////////////////////////////////////////////////////////////

    lead(b, [Suit.SPADES, 5]);
    follow(c, [Suit.SPADES, 9]);
    follow(d, [Suit.SPADES, Rank.Q]);
    follow(e, [Suit.SPADES, Rank.A]);
    follow(a, [Suit.SPADES, Rank.J]);
    expect_ok(zpy.collect_trick(e));

    lead(e, [Suit.CLUBS, Rank.A], [Suit.CLUBS, Rank.K]);

    for (let p of [a, d, b, c]) {
      expect_ok(zpy.pass_contest(p));
    }
    follow(a, [Suit.CLUBS, 7], [Suit.CLUBS, 7]);
    follow(b, [Suit.SPADES, Rank.J], [Suit.HEARTS, 10]);
    follow(c, [Suit.DIAMONDS, 7], [Suit.DIAMONDS, Rank.J]);
    follow(d, [Suit.CLUBS, 9], [Suit.CLUBS, Rank.J]);
    expect_ok(zpy.collect_trick(e));

    lead(e, [Suit.DIAMONDS, 10]);
    follow(a, [Suit.DIAMONDS, Rank.A]);
    follow(b, [Suit.HEARTS, Rank.A]);
    follow(c, [Suit.DIAMONDS, Rank.Q]);
    follow(d, [Suit.DIAMONDS, 5]);
    expect_ok(zpy.collect_trick(b));

    lead(b, [Suit.HEARTS, 6]);
    follow(c, [Suit.CLUBS, 2]);
    follow(d, [Suit.HEARTS, 5]);
    follow(e, [Suit.HEARTS, 3]);
    follow(a, [Suit.HEARTS, 3]);
    expect_ok(zpy.collect_trick(c));

    lead(c, [Suit.HEARTS, 5]);
    expect_err(
      zpy.undo_play(c),
      ZPY.WrongPlayerError, 'cannot undo a lead'
    );
    follow(d, [Suit.HEARTS, 4]);
    expect_err(
      zpy.undo_play(e),
      ZPY.OutOfTurnError
    );
    expect_ok(zpy.undo_play(d));
    follow(d, [Suit.SPADES, 2]);
    follow(e, [Suit.HEARTS, 4]);
    expect_err(
      zpy.undo_play(d),
      ZPY.WrongPlayerError, 'only the most recent play can be undone'
    );
    follow(a, [Suit.HEARTS, 7]);
    follow(b, [Suit.HEARTS, 7]);
    expect_ok(zpy.collect_trick(d));

    lead(d, [Suit.SPADES, 7]);
    follow(e, [Suit.SPADES, Rank.Q]);
    follow(a, [Suit.SPADES, 5]);
    follow(b, [Suit.HEARTS, Rank.K]);
    follow(c, [Suit.SPADES, 3]);
    expect_ok(zpy.collect_trick(b));

    lead(b, [Suit.HEARTS, 9]);
    follow(c, [Suit.DIAMONDS, 2]);
    follow(d, [Suit.HEARTS, 4]);
    follow(e, [Suit.HEARTS, 8]);
    follow(a, [Suit.HEARTS, 8]);
    expect_ok(zpy.collect_trick(c));

    lead(c, [Suit.SPADES, 4]);
    follow(d, [Suit.SPADES, 8]);
    follow(e, [Suit.SPADES, 7]);
    follow(a, [Suit.SPADES, 10]);
    follow(b, [Suit.HEARTS, Rank.J]);
    expect_ok(zpy.collect_trick(b));

    lead(b, [Suit.TRUMP, Rank.S], [Suit.TRUMP, Rank.B], [Suit.TRUMP, Rank.B]);

    for (let p of [a, c, d, e]) {
      expect_ok(zpy.pass_contest(p));
    }
    follow(c, [Suit.HEARTS, 6], [Suit.HEARTS, 10], [Suit.TRUMP, Rank.S]);
    follow(d, [Suit.HEARTS, 9], [Suit.HEARTS, Rank.A], [Suit.DIAMONDS, 10]);
    follow(e, [Suit.HEARTS, Rank.K], [Suit.CLUBS, 2], [Suit.SPADES, 2]);
    follow(a, [Suit.HEARTS, Rank.J], [Suit.HEARTS, Rank.Q], [Suit.DIAMONDS, 9]);
    expect_ok(zpy.collect_trick(b));

    lead(b, [Suit.HEARTS, Rank.Q], [Suit.DIAMONDS, 2]);

    for (let p of [a, c, d, e]) {
      expect_ok(zpy.pass_contest(p));
    }
    follow(c, [Suit.SPADES, 8], [Suit.SPADES, Rank.K]);
    follow(d, [Suit.CLUBS, Rank.K], [Suit.SPADES, Rank.K]);
    follow(e, [Suit.DIAMONDS, 5], [Suit.DIAMONDS, 8]);
    follow(a, [Suit.CLUBS, 5], [Suit.DIAMONDS, Rank.K]);
    expect_ok(zpy.collect_trick(b));

    expect_err(zpy.end_round(e), ZPY.WrongPlayerError);
    expect_ok(zpy.end_round(b));
  });
});
