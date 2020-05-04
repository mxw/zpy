/*
 * ZPY game state machine.
 */

import {
  Suit, Rank, TrumpMeta, CardBase, Card, CardPile, rank_to_string, gen_deck
} from 'lib/zpy/cards.ts';
import {
  CardTuple, Tractor, Flight, Play, Hand
} from 'lib/zpy/trick.ts';
import {
  array_fill, array_shuffle, o_map
} from 'utils/array.ts';
import { plural } from 'utils/string.ts';

import { UserID } from 'protocol/protocol.ts'

import assert from 'utils/assert.ts'

///////////////////////////////////////////////////////////////////////////////

export class Data<PlayerID extends keyof any> {
  phase: ZPY.Phase = ZPY.Phase.INIT;
  // rule modifiers
  rules: ZPY.RuleModifiers;
  // the player whose state this represents; null for global view
  identity: PlayerID | null = null;

  // owner of the game
  owner: PlayerID = null;
  // all players; in turn order if phase > INIT
  players: PlayerID[] = [];
  // rank information of each player; always valid
  ranks: Record<PlayerID, {
    rank: Rank,  // current rank
    start: Rank, // most recent starting rank
    last_host: null | Rank, // last hosted rank
  }> = {} as any;
  // number of decks
  ndecks: number = 0;

  // round counter; > 0 iff phase > INIT
  round: number = 0;
  // player to order index mapping; valid iff phase > INIT
  order: Record<PlayerID, number> = {} as any;
  // general-purpose player set for reaching consensus
  consensus: Set<PlayerID> = new Set();

  // contents of the deck; null iff phase !== DRAW
  deck: CardBase[] = [];
  // size of the deck; maintained because contents are hidden
  deck_sz: number = 0;
  // kitty; set before DRAW, replaced by KITTY, consumed by FINISH
  kitty: CardBase[] = [];
  // list of successful trump bids made during DRAW; last one is the winner
  bids: {player: PlayerID, card: CardBase, n: number}[] = [];
  // players' hands as they are being drawn
  draws: Record<PlayerID, CardPile> = {} as any;
  // current index into players for draws, play, etc.
  cur_idx: number = null;

  // host of the current round; valid iff phase > INIT
  host: PlayerID | null = null;
  // trump selection for the current round; valid iff phase > DRAW
  tr: TrumpMeta = null;
  // hands; valid iff phase > KITTY
  hands: Record<PlayerID, Hand> = {} as any;
  // each player's point cards; valid if phase > FRIEND
  points: Record<PlayerID, CardBase[]> = {} as any;
  // friends declarations; valid iff phase > FRIEND
  friends: {card: CardBase, nth: number, tally: number}[] = [];
  // number of times a friend has joined; valid iff phase > FRIEND
  joins: number = 0;
  // attacking and host teams; valid if phase > FRIEND
  host_team: Set<PlayerID> = new Set();
  atk_team: Set<PlayerID> = new Set();

  // leader of the current trick; valid iff phase >= LEAD
  leader: PlayerID | null = null;
  // lead play for the current trick; valid iff phase > LEAD
  lead: Flight | null = null;
  // all plays for the current trick; valid iff phase > LEAD
  plays: Record<PlayerID, Play> = {} as any;
  // current winning player
  winning: PlayerID | null = null;

  constructor() {}
}

export namespace Data {

export type Type<PlayerID extends keyof any> = Exclude<
  Data<PlayerID>,
  keyof typeof Data
>;

}

export class ZPY<PlayerID extends keyof any> extends Data<PlayerID> {
  // debugging determinism flag
  debug: boolean = false;

  constructor(rules: ZPY.RuleModifiers) {
    super();
    this.rules = rules;
  }

  /////////////////////////////////////////////////////////////////////////////
  /*
   * Config getters.
   */

  /*
   * Player counts.
   */
  get nplayers(): number { return this.players.length; }
  static get min_players(): number { return 4; }

  /*
   * Size of the host team given the number of players.
   */
  get nfriends(): number {
    return Math.floor(0.35 * this.nplayers);
  }

  /*
   * Size of the kitty based on `this.ndecks`.
   */
  kitty_sz(): number {
    let kitty_sz = (this.ndecks * 54) % this.nplayers;
    if (kitty_sz === 0) kitty_sz = this.nplayers;
    while (kitty_sz > 10) kitty_sz -= this.nplayers;
    while (kitty_sz <= 4) kitty_sz += this.nplayers;
    return kitty_sz;
  }

  /////////////////////////////////////////////////////////////////////////////
  /*
   * Convenience getters.
   */

  /*
   * The current player (NOT the current player's order index).
   */
  current(): null | PlayerID {
    return this.cur_idx !== null ? this.players[this.cur_idx] : null;
  }
  is_current(player: PlayerID): boolean {
    return this.cur_idx !== null &&
           player === this.players[this.cur_idx];
  }

  /*
   * Get a player's hand as a list of cards (regardless of how it's being
   * represented at the moment).
   */
  hand(p: PlayerID): Card[] {
    return p in this.hands ? [...this.hands[p].pile.gen_cards()] :
           p in this.draws ? [...this.draws[p].gen_cards()] : [];
  }

  /*
   * Whether every player is in this.consensus.
   */
  has_consensus(): boolean {
    return this.consensus.size === this.players.length;
  }

  /*
   * Team from string literal.
   */
  team(which: 'host' | 'attacking') {
    return which === 'host' ? this.host_team : this.atk_team;
  }

  /////////////////////////////////////////////////////////////////////////////

  /*
   * Currently winning trump bidder.
   */
  winning_bid(): ZPY<PlayerID>['bids'][number] {
    return this.bids.length > 0
      ? this.bids[this.bids.length - 1]
      : null;
  }

  /*
   * Perform the logic of revealed kitty trump selection.
   *
   * This is basically a max() over virtual ranks where the index in the
   * ordered kitty is used as a tiebreaker.
   */
  reveal_highest(kitty: CardBase[]): [Card, Rank] {
    const rank = this.ranks[this.host].rank;

    // the natural-trump-only TrumpMeta works for comparisons here
    const ctx_tr = new TrumpMeta(Suit.TRUMP, rank);

    const card = kitty.reduce<Card>((highest: Card, cb: CardBase) => {
      const card = new Card(cb.suit, cb.rank, ctx_tr);
      if (highest === null) return card;
      return card.v_rank > highest.v_rank ? card : highest;
    }, null);

    return [card, rank];
  }

  /*
   * Whether everyone has played for a trick.
   */
  trick_over(): boolean {
    return Object.keys(this.plays).length === this.players.length;
  }

  /*
   * How many points does the given team have?
   */
  team_point_total(which: 'host' | 'attacking') {
    const team = this.team(which);

    return this.players.reduce((total, p) => total + (
      team.has(p) ? this.points[p].reduce((n, c) => n + c.point_value(), 0) : 0
    ), 0);
  }

  /////////////////////////////////////////////////////////////////////////////

  /*
   * Debugging helpers.
   */
  set_debug() { this.debug = true; }
  stack_deck(i: number, j: number) {
    assert(this.debug);
    [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
  }

  /*
   * Whether we are authorized to see private data for `player`.
   *
   * Clients won't even have this data available; this just makes things
   * nullsafe and the like.
   */
  private can_see(player: PlayerID): boolean {
    return this.identity === null || this.identity === player;
  }

  /*
   * Get the index of the next player in play order.
   */
  private next_player_idx(idx: number): number {
    return ++idx < this.players.length ? idx : 0;
  }

  /////////////////////////////////////////////////////////////////////////////

  /*
   * Phase.INIT : {Action,Effect}.add_player
   *
   * Add a player to the game.  The first player added is the game owner.
   */
  add_player(player: PlayerID): ZPY.Result {
    if (this.phase !== ZPY.Phase.INIT) {
      return ZPY.BadPhaseError.from('add_player', this.phase);
    }
    if (this.players.find(p => p === player)) {
      return new ZPY.DuplicateActionError('already joined game');
    }
    if (this.nplayers === 0) {
      this.owner = player;
    }
    this.players.push(player);
    this.ranks[player] = {
      rank: 2,
      start: 2,
      last_host: null,
    }
  }

  /*
   * Phase.INIT : {Action,Effect}.set_decks
   *
   * Set the number of decks.  Game owner only.
   */
  set_decks(player: PlayerID, ndecks: number): ZPY.Result {
    if (this.phase !== ZPY.Phase.INIT) {
      return ZPY.BadPhaseError.from('set_decks', this.phase);
    }
    if (player !== this.owner) {
      return new ZPY.WrongPlayerError('game owner only');
    }
    if (ndecks <= 0) {
      return new ZPY.InvalidArgError('non-positive number of decks');
    }
    this.ndecks = ndecks;
  }

  /*
   * Shuffle `n` standard decks together.
   */
  private shuffled_deck(n: number): CardBase[] {
    let deck: CardBase[] = [];

    for (let i = 0; i < n; ++i) {
      deck = [...deck, ...gen_deck()];
    }
    assert(deck.length === n * 54);

    return !this.debug ? array_shuffle(deck) : deck;
  }

  /*
   * Draw a card from deck.
   */
  private draw(): CardBase {
    assert(this.deck.length > 0, 'ZPY: draw from empty deck');
    return this.deck.pop();
  }

  /*
   * Helper for resetting round state; used by multiple phases/actions.
   *
   * This includes: incrementing the round counter, shuffling the deck, setting
   * aside a kitty, and resetting all other per-round internal state.
   */
  private reset_round(starting: PlayerID, is_host: boolean): void {
    ++this.round;
    this.consensus.clear();

    const kitty_sz = this.kitty_sz();

    if (this.identity === null) {
      this.deck = this.shuffled_deck(this.ndecks);

      this.kitty = [];
      for (let i = 0; i < kitty_sz; ++i) {
        this.kitty.push(this.draw());
      }
    }
    this.deck_sz = this.ndecks * 54 - kitty_sz;

    this.bids = [];
    this.draws = {} as any;
    this.cur_idx = this.order[starting];

    this.host = is_host ? starting : null;
    this.tr = is_host
      ? new TrumpMeta(Suit.TRUMP, this.ranks[starting].rank)
      : new TrumpMeta(Suit.TRUMP, Rank.B);  // big joker is the sentinel tr
    this.hands = {} as any;
    this.points = {} as any;
    this.friends = [];
    this.joins = 0;
    this.host_team.clear();
    this.atk_team.clear();

    this.leader = null;
    this.lead = null;
    this.plays = {} as any;
    this.winning = null;

    for (let p of this.players) {
      if (this.can_see(p)) {
        this.draws[p] = new CardPile([], this.tr);
      }
      this.points[p] = [];
    }
  }

  /*
   * Phase.INIT : Action.start_game
   * Phase.INIT : Effect.init_game
   *
   * Start the game and transition to Phase.DRAW.  Game owner only.
   */
  start_game(player: PlayerID): ZPY.Result<[PlayerID[]]> {
    if (this.phase !== ZPY.Phase.INIT) {
      return ZPY.BadPhaseError.from('start_game', this.phase);
    }
    if (player !== this.owner) {
      return new ZPY.WrongPlayerError('game owner only');
    }
    if (this.nplayers < ZPY.min_players) {
      return new ZPY.InvalidArgError(
        `must have at least ${ZPY.min_players} players`
      );
    }

    let players = !this.debug
      ? array_shuffle(this.players)
      : this.players;

    this.init_game(player, players);
    return [players];
  }
  init_game(player: PlayerID, players: PlayerID[]): ZPY.Result {
    this.players = players;
    for (let i = 0; i < this.nplayers; ++i) {
      this.order[this.players[i]] = i;
    }
    if (this.ndecks === 0) {
      this.ndecks = Math.ceil(this.nplayers / 2);
    }
    this.reset_round(this.owner, false);
    this.phase = ZPY.Phase.DRAW;
  }

  /*
   * Phase.DRAW : Action.draw_card
   * Phase.DRAW : Effect.add_to_hand
   *
   * Draw a card for the player in question.  Transition to Phase.PREPARE if
   * the deck empties.
   */
  draw_card(player: PlayerID): ZPY.Result<[CardBase]> {
    if (this.phase !== ZPY.Phase.DRAW) {
      return ZPY.BadPhaseError.from('draw_card', this.phase);
    }
    if (!this.is_current(player)) {
      return new ZPY.OutOfTurnError();
    }
    let cb = this.draw();
    this.add_to_hand(player, cb);
    return [cb];
  }
  add_to_hand(player: PlayerID, cb: null | CardBase): ZPY.Result {
    if (cb !== null) {
      assert(
        this.can_see(player),
        'ZPY: exposed add_to_hand',
        player, this.identity
      );
      this.draws[player].insert(cb);
    }
    if (--this.deck_sz === 0) {
      const bid = this.winning_bid();
      if (bid !== null) {
        // the winning bidder is ready by default
        this.consensus = (new Set<PlayerID>()).add(bid.player);
      }
      this.phase = ZPY.Phase.PREPARE;
    }
    this.cur_idx = this.next_player_idx(this.cur_idx);
  }

  /*
   * Phase.{DRAW,PREPARE} : Action.bid_trump
   * Phase.{DRAW,PREPARE} : Effect.secure_bid
   *
   * Place a bid for a trump.  This also reindexes each player's current draw
   * pile and changes the current trump selection.
   */
  bid_trump(
    player: PlayerID,
    card: CardBase,
    n: number
  ): ZPY.Result<[CardBase, number]> {
    if (this.phase !== ZPY.Phase.DRAW &&
        this.phase !== ZPY.Phase.PREPARE) {
      return ZPY.BadPhaseError.from('bid_trump', this.phase);
    }
    if (n < 1) {
      return new ZPY.InvalidArgError('bid is empty');
    }

    if (!this.draws[player].contains(
      [[new Card(card.suit, card.rank, this.tr), n]]
    )) {
      return new ZPY.InvalidArgError('bid not part of hand');;
    }

    const tr_rank = this.ranks[this.host ?? player].rank;

    if (card.rank <= Rank.A && card.rank !== tr_rank) {
      // we bid either the host's rank or our own (in a bid-to-host draw), so
      // valid bids against the appropriate value.
      return new ZPY.InvalidPlayError(`invalid trump bid for rank ${tr_rank}`);
    }

    let commit_bid = () => {
      this.secure_bid(player, card, n);
      return [card, n]
    };

    if (this.bids.length === 0) {
      return commit_bid();
    }

    let prev = this.bids[this.bids.length - 1];

    if (player === prev.player) {
      if (card.suit === prev.card.suit && n > prev.n) {
        return commit_bid();
      }
      return new ZPY.InvalidPlayError('cannot overturn own bid');
    }

    if (n > prev.n) return commit_bid();
    if (n === prev.n &&
        prev.card.rank <= Rank.A &&
        card.rank >= Rank.S) {
      return commit_bid();
    }
    return new ZPY.InvalidPlayError('bid too low');
  }
  secure_bid(player: PlayerID, card: CardBase, n: number): ZPY.Result {
    if (this.phase === ZPY.Phase.PREPARE) {
      // un-ready everyone else
      this.consensus = (new Set<PlayerID>()).add(player);
    }
    this.bids.push({player, card, n});

    const tr_rank = this.ranks[this.host ?? player].rank;
    this.tr = new TrumpMeta(card.suit, tr_rank);

    for (let p in this.draws) this.draws[p].rehash(this.tr);
  }

  /*
   * Phase.PREPARE : Action.request_redeal
   * Phase.PREPARE : Effect.redeal
   *
   * Request a redeal.  Only valid if the player has fewer than ndecks * 5
   * points in hand.
   */
  request_redeal(player: PlayerID): ZPY.Result<[]> {
    if (this.phase !== ZPY.Phase.PREPARE) {
      return ZPY.BadPhaseError.from('request_redeal', this.phase);
    }

    let points = 0;
    for (let [card, n] of this.draws[player]) {
      points += card.point_value() * n;
    }
    if (points > this.ndecks * 5) {
      return new ZPY.InvalidPlayError('too many points for redeal');
    }
    this.redeal(player);
    return [];
  }
  redeal(player: PlayerID): ZPY.Result {
    this.reset_round(player, false);
    this.phase = ZPY.Phase.DRAW;
  }

  /*
   * Phase.PREPARE : Action.ready
   * Phase.PREPARE : Effect.install_host
   *
   * The player has no more bids or redeals to make.  Once everyone is ready,
   * the round can begin, and we transition to Phase.KITTY.
   *
   * Normally, this just entails dumping the kitty into the host's hand.
   * However, if no trump has been set, we have to flip the cards in the kitty
   * in order and use that to determine the trump.
   */
  ready(player: PlayerID): ZPY.Result<null | [PlayerID, CardBase[]]> {
    if (this.phase !== ZPY.Phase.PREPARE) {
      return ZPY.BadPhaseError.from('ready', this.phase);
    }
    this.consensus.add(player);
    if (!this.has_consensus()) return null;

    let nbids = this.bids.length;

    let host = this.host ?? (nbids !== 0
      ? this.bids[nbids - 1].player
      : this.current()  // starting player defaults to host
    );
    this.install_host(host, this.kitty);
    return [host, this.kitty];
  }
  install_host(
    host: PlayerID,
    kitty: CardBase[],
  ): ZPY.Result {
    this.consensus.clear();

    this.host = host;
    this.ranks[this.host].last_host = this.ranks[this.host].rank;

    if (this.bids.length === 0) {
      this.reveal_kitty(this.host, kitty);
    }
    this.receive_kitty(this.host, kitty);

    this.kitty = kitty;
    this.phase = ZPY.Phase.KITTY;
  }

  /*
   * Helper for redacting per-player knowledge of the kitty's contents.
   */
  redact_kitty_for(
    player: PlayerID,
    host: PlayerID,
    kitty: CardBase[],
  ): [PlayerID, CardBase[]] {
    if (player === host) return [host, kitty];
    if (this.bids.length === 0) return [host, kitty];
    return [host, []];
  }

  private reveal_kitty(player: PlayerID, kitty: CardBase[]): ZPY.Result {
    const [card, rank] = this.reveal_highest(kitty);

    this.tr = new TrumpMeta(card.suit, rank);
    for (let p in this.draws) this.draws[p].rehash(this.tr);
  }

  private receive_kitty(player: PlayerID, kitty: CardBase[]): ZPY.Result {
    for (let c of kitty) {
      this.draws[player]?.insert(new Card(c.suit, c.rank, this.tr));
    }
  }

  /*
   * Phase.KITTY : {Action,Effect}.replace_kitty
   * Phase.KITTY : Effect.seal_hand
   *
   * The host discards their kitty.  We Hand-ify every player's draw pile, and
   * transition to Phase.FRIEND.
   */
  replace_kitty(player: PlayerID, kitty: CardBase[]): ZPY.Result<[]> {
    if (this.phase !== ZPY.Phase.KITTY) {
      return ZPY.BadPhaseError.from('replace_kitty', this.phase);
    }
    if (player !== this.host) {
      return new ZPY.WrongPlayerError('host only');
    }
    if (kitty.length !== this.kitty.length) {
      return new ZPY.InvalidPlayError(
        `must discard exactly ${this.kitty.length} cards for kitty`
      );
    }
    let kitty_pile = new CardPile(kitty, this.tr);

    if (!this.draws[player].contains(kitty_pile)) {
      return new ZPY.InvalidArgError('kitty not part of hand');
    }

    for (let count of kitty_pile) {
      this.draws[player].remove(...count);
    }
    this.kitty = kitty;

    this.seal_hand(player);
    return [];
  }
  seal_hand(player: PlayerID): ZPY.Result {
    for (let p in this.draws) {
      this.hands[p] = new Hand(this.draws[p]);
    }
    this.draws = {} as any; // clear this, mostly to prevent bugs
    this.phase = ZPY.Phase.FRIEND;
  }

  /*
   * Phase.FRIEND : {Action,Effect}.call_friends
   *
   * The host calls their friends, and we transition to Phase.LEAD, where
   * gameplay actually begins.
   */
  call_friends(
    player: PlayerID,
    friends: [CardBase, number][]
  ): ZPY.Result {
    if (this.phase !== ZPY.Phase.FRIEND) {
      return ZPY.BadPhaseError.from('call_friends', this.phase);
    }
    if (player !== this.host) {
      return new ZPY.WrongPlayerError('host only');
    }

    // this is the correct number of friends for all single-digit numbers of
    // players and probably at least some double-digit numbers.
    let allowed = this.nfriends;

    if (friends.length !== allowed) {
      return new ZPY.InvalidPlayError(
        `must call exactly ${allowed} friend${plural(allowed)}`
      );
    }

    for (let [c, nth] of friends) {
      if (nth < 1 || nth > this.ndecks) {
        this.friends.length = 0;
        return new ZPY.InvalidArgError(`friend index ${nth} out of bounds`);
      }
      let card = new Card(c.suit, c.rank, this.tr);

      if (card.v_rank > Rank.A) {
        this.friends.length = 0;
        return new ZPY.InvalidPlayError('no natural trump friend calls allowed');
      }
      this.friends.push({card, nth, tally: nth});
    }

    this.host_team.add(this.host);

    this.leader = this.host;
    this.cur_idx = this.order[this.leader];

    this.phase = ZPY.Phase.LEAD;
  }

  /*
   * Shared initial logic for leading and following.
   *
   * This does data validation and moves current to the next player, and
   * returns the play as a CardPile on success.
   */
  private init_play(
    player: PlayerID,
    play: Play,
  ): ZPY.Error | CardPile {
    if (!this.is_current(player)) {
      return new ZPY.OutOfTurnError();
    }
    let play_pile = new CardPile(play.gen_cards(this.tr), this.tr);

    if (!this.hands[player].pile.contains(play_pile)) {
      return new ZPY.InvalidArgError('play not part of hand');
    }
    return play_pile;
  }

  /*
   * Affirm a play.
   *
   * In addition to recording metadata, this function also performs friend
   * detection.
   */
  private commit_play(player: PlayerID, play: Play): void {
    this.plays[player] = play;

    // set `player` as the new winner if they're the first play or the current
    // winner fails to beat them
    if (this.winning == null ||
        !this.plays[this.winning].fl()!.beats(play)) {
      this.winning = player;
    }

    for (let [card, n] of play.gen_counts(this.tr)) {
      for (let friend of this.friends) {
        if (CardBase.same(card, friend.card) &&
            friend.tally > 0 &&
            (friend.tally -= n) <= 0) {
          friend.tally = 0;
          this.host_team.add(player);

          if (++this.joins === this.nfriends) {
            // add all other players to the attacking team.  note that some
            // of the joins may be redundant.
            for (let p of this.players) {
              if (!this.host_team.has(p)) {
                this.atk_team.add(p);
              }
            }
          }
        }
      }
    }
    this.cur_idx = this.next_player_idx(this.cur_idx);
  }

  /*
   * Commit the lead play.
   */
  private commit_lead(player: PlayerID, play: Play): void {
    if (this.can_see(player)) {
      for (let count of play.gen_counts(this.tr)) {
        this.hands[player].remove(...count);
      }
    }
    this.commit_play(player, play);
  }

  /*
   * Phase.LEAD : {Action,Effect}.lead_play
   * Phase.LEAD : Effect.observe_lead
   *
   * Play a card, a tuple, a tractor, a flight---anything your heart desires!
   * If the leader plays a nontrivial flight, transition to Phase.FLY, else to
   * Phase.FOLLOW.
   */
  lead_play(player: PlayerID, play: Flight): ZPY.Result<[Flight]> {
    if (this.phase !== ZPY.Phase.LEAD) {
      return ZPY.BadPhaseError.from('lead_play', this.phase);
    }
    let play_pile = this.init_play(player, play);
    if (play_pile instanceof ZPY.Error) return play_pile;

    this.observe_lead(player, play);
    return [play];
  }
  observe_lead(player: PlayerID, play: Flight): ZPY.Result {
    this.lead = play;

    if (play.tractors.length > 1) {
      this.consensus.add(player);
      this.phase = ZPY.Phase.FLY;
      // delay registering the play until Phase.FLY completes
      return;
    }
    this.commit_lead(player, play);

    this.phase = ZPY.Phase.FOLLOW;
  }

  /*
   * Phase.FLY : Action.contest_fly
   * Phase.FLY : Effect.reject_fly
   *
   * Contest a fly by revealing a play that would beat any component of it.
   * Transitions to Phase.FOLLOW.
   */
  contest_fly(
    player: PlayerID,
    reveal: CardBase[]
  ): ZPY.Result<[CardBase[], Tractor]> {
    if (this.phase !== ZPY.Phase.FLY) {
      return ZPY.BadPhaseError.from('contest_fly', this.phase);
    }
    if (player === this.leader) {
      return new ZPY.WrongPlayerError('cannot contest own flight');
    }
    let play = Play.extract(reveal, this.tr);

    if (!this.hands[player].pile.contains(play.gen_counts(this.tr))) {
      return new ZPY.InvalidArgError('reveal not part of hand');
    }
    let flight = play.fl();

    if (!flight) {
      return new ZPY.InvalidPlayError('reveal is multiple suits');
    }
    if (flight.v_suit !== this.lead.v_suit) {
      return new ZPY.InvalidPlayError('reveal is the wrong suit');
    }
    if (flight.tractors.length !== 1) {
      return new ZPY.InvalidPlayError(
        'reveal must be a singleton, tuple, or tractor'
      );
    }
    let counter = flight.tractors[0];

    // get all the compatible tractors...
    let compat = this.lead.tractors.filter(
      trc => Tractor.Shape.compare(counter.shape, trc.shape) === 0
    );
    if (compat.length === 0) {
      return new ZPY.InvalidPlayError(
        'reveal doesn\'t match any components of lead'
      );
    }
    let smallest = compat[compat.length - 1];

    if (Tractor.compare(counter, smallest) > 0) {
      this.reject_fly(player, reveal, smallest);
      return [reveal, smallest];
    }
    return new ZPY.InvalidPlayError('reveal fails to counter fly');
  }
  reject_fly(
    player: PlayerID,
    reveal: CardBase[],
    force: Tractor
  ): ZPY.Result {
    // we beat the flight; force the new flight
    this.consensus.clear();

    this.lead = new Flight([force]);
    this.commit_lead(this.leader, this.lead);

    this.phase = ZPY.Phase.FOLLOW;
  }

  /*
   * Phase.FLY : Action.PASS_CONTEST
   *
   * The equivalent of READY for Phase.FLY.  Once everyone passes, the fly
   * succeeds and play continues to Phase.FOLLOW.
   */
  pass_contest(player: PlayerID): ZPY.Result {
    if (this.phase !== ZPY.Phase.FLY) {
      return ZPY.BadPhaseError.from('pass_contest', this.phase);
    }
    this.consensus.add(player);
    if (!this.has_consensus()) return;

    this.consensus.clear();
    this.commit_lead(this.leader, this.lead);

    this.phase = ZPY.Phase.FOLLOW;
  }

  /*
   * Phase.FOLLOW : Action.follow_play
   * Phase.FOLLOW : Effect.observe_follow
   *
   * Follow the lead.  Handles end-of-trick point collection if everyone has
   * played.  Transitions to either Phase.LEAD, or Phase.FINISH if the round
   * has ended.
   */
  follow_lead(player: PlayerID, play: Play): ZPY.Result<[Play]> {
    if (this.phase !== ZPY.Phase.FOLLOW) {
      return ZPY.BadPhaseError.from('follow_lead', this.phase);
    }
    let play_pile = this.init_play(player, play);
    if (play_pile instanceof ZPY.Error) return play_pile;

    if (play.count !== this.lead.count) {
      return new ZPY.InvalidPlayError(
        'must follow with exactly ' +
        `${this.lead.count} card${plural(this.lead.count)}`
      );
    }

    const {
      follows,
      undo_chain
    } = this.hands[player].follow_with(this.lead, play_pile);
    if (!follows) {
      switch (this.rules.renege) {
        case ZPY.RenegeRule.ACCUSE: {
          // TODO: implement this
        }
        case ZPY.RenegeRule.FORBID: {
          this.hands[player].undo(play_pile, undo_chain);
          return new ZPY.InvalidPlayError('invalid follow');
        }
        case ZPY.RenegeRule.AUTOLOSE: {
          // TODO: implement this
          this.phase = ZPY.Phase.FINISH;
        }
        case ZPY.RenegeRule.UNDO_ONE: {
          // TODO: implement this
        }
      }
    }
    this.observe_follow(player, play);
    return [play];
  }
  observe_follow(player: PlayerID, play: Play): ZPY.Result {
    this.commit_play(player, play);
    if (this.trick_over()) this.cur_idx = null;
  }

  /*
   * Phase.FOLLOW : {Action,Effect}.collect_trick
   *
   * Collect points at the end of a trick.
   */
  collect_trick(player: PlayerID): ZPY.Result {
    if (this.phase !== ZPY.Phase.FOLLOW) {
      return ZPY.BadPhaseError.from('collect_trick', this.phase);
    }
    if (!this.trick_over()) {
      return new ZPY.OutOfTurnError('trick not finished');
    }
    if (player !== this.winning) {
      return new ZPY.WrongPlayerError('trick winner only');
    }

    for (let player of this.players) {
      for (let [card, n] of this.plays[player].gen_counts(this.tr)) {
        if (card.point_value() > 0) {
          for (let i = 0; i < n; ++i) {
            this.points[this.winning].push(card);
          }
        }
      }
    }
    if (this.hands[this.identity ?? this.leader].pile.size === 0) {
      this.phase = ZPY.Phase.FINISH;
      return;
    }
    this.leader = this.winning;
    this.cur_idx = this.order[this.leader];
    this.winning = null;
    this.lead = null;
    this.plays = {} as any;

    this.phase = ZPY.Phase.LEAD;
  }

  /*
   * Bump a player's rank.
   *
   * A delta of -1 indicates that the player was J'd.
   */
  private rank_up(player: PlayerID, delta: number): void {
    let meta = this.ranks[player];

    for (let i = 0; i < delta; ++i) {
      if ([5,10,Rank.J,Rank.K,Rank.B].includes(meta.rank)) {
        if (this.rules.rank === ZPY.RankSkipRule.NO_PASS) {
          if (player !== this.host) return;
        }
        if (this.rules.rank === ZPY.RankSkipRule.PLAY_ONCE) {
          if (meta.rank !== meta.last_host) return;
        }
      }

      if (meta.rank === Rank.B) {
        if (++meta.start > Rank.A) {
          // once we cycle back to 2 just... start over?
          meta.start = 2;
        }
        meta.rank = meta.start;
      } else if (meta.rank === Rank.A) {
        meta.rank = Rank.B;
      } else {
        ++meta.rank;
      }

      if ([5,10,Rank.J,Rank.K,Rank.B].includes(meta.rank)) {
        if (this.rules.rank === ZPY.RankSkipRule.NO_SKIP) {
          return;
        }
      }
    }
  }

  /*
   * Phase.FINISH : Action.end_round
   * Phase.FINISH : Effect.finish
   *
   * Score and finish up the round.  Transitions to Phase.WAIT.
   */
  end_round(player: PlayerID): ZPY.Result<[CardBase[]]> {
    if (this.phase !== ZPY.Phase.FINISH) {
      return ZPY.BadPhaseError.from('end_round', this.phase);
    }
    if (player !== this.host) {
      return new ZPY.WrongPlayerError('host only');
    }
    this.finish(player, this.kitty);
    return [this.kitty];
  }
  finish(player: PlayerID, kitty: CardBase[]): ZPY.Result {
    this.kitty = kitty;

    const {delta, winner} = this.compute_round_outcome(this.kitty);

    for (let player of this.team(winner).values()) {
      this.rank_up(player, Math.abs(delta));
    }

    // choose the next host
    let next_idx = this.next_player_idx(this.order[this.host]);
    while (true) {
      let player = this.players[next_idx];
      if (this.team(winner).has(player)) {
        this.host = player;
        break;
      }
      next_idx = this.next_player_idx(next_idx);
    }
    this.consensus = (new Set<PlayerID>()).add(this.host);
    this.phase = ZPY.Phase.WAIT;
  }

  /*
   * Determine the winner at the end of the game.
   *
   * This can be safely called anytime during Phase.FINISH or Phase.WAIT
   * because we don't reset the last-trick state until the next round starts.
   */
  compute_round_outcome(kitty: CardBase[]): {
    kitty_points: null | number;
    atk_points: number;
    delta: number;
    winner: 'attacking' | 'host';
  } {
    const kitty_points = (() => {
      if (!this.atk_team.has(this.winning)) return null;

      // score the kitty to the attacking team
      const kitty_points = kitty.reduce((n, c) => n + c.point_value(), 0);
      const multiplier = Math.max(
        ...this.plays[this.winning].fl()!.tractors.map(t => t.count)
      );
      return kitty_points * (() => {
        switch (this.rules.kitty) {
          case ZPY.KittyMultiplierRule.EXP: return 2 ** multiplier;
          case ZPY.KittyMultiplierRule.MULT: return 2 * multiplier;
        }
        assert(false, 'ZPY: invalid kitty rules');
      })();
    })();

    const atk_points = this.team_point_total('attacking') + kitty_points;

    // number of ranks the attacking team ascends
    let delta = Math.floor(atk_points / (this.ndecks * 20)) - 2;
    if (atk_points === 0) --delta;

    const winner = delta >= 0 ? 'attacking' : 'host';

    return {kitty_points, atk_points, delta: Math.abs(delta), winner};
  }

  next_ready(player: PlayerID): ZPY.Result {
    if (this.phase !== ZPY.Phase.WAIT) {
      return ZPY.BadPhaseError.from('next_ready', this.phase);
    }
    this.consensus.add(player);
  }

  /*
   * Phase.WAIT : {Action,Effect}.next_round
   *
   * Start a new round.
   */
  next_round(player: PlayerID): ZPY.Result {
    if (this.phase !== ZPY.Phase.WAIT) {
      return ZPY.BadPhaseError.from('next_round', this.phase);
    }
    if (player !== this.host) {
      return new ZPY.WrongPlayerError('host only');
    }
    if (this.nplayers < ZPY.min_players) {
      return new ZPY.InvalidArgError(
        `must have at least ${ZPY.min_players} players`
      );
    }
    if (!this.has_consensus()) {
      return new ZPY.InvalidPlayError('not everyone is ready');
    }
    this.consensus.clear();

    this.reset_round(this.host, true);
    this.phase = ZPY.Phase.DRAW;
  }

  /////////////////////////////////////////////////////////////////////////////

  /*
   * Shallow copy `this` as a JSON-compatible object for serialization.
   */
  static from<PlayerID extends keyof any>(
    data: Data.Type<PlayerID>
  ): ZPY<PlayerID> {
    const zpy = new ZPY<PlayerID>({} as ZPY.RuleModifiers);
    Object.assign(zpy, data);
    return zpy;
  }

  /*
   * Make a shallow copy of the game state for `player`.
   */
  redact_for(player: PlayerID): ZPY<PlayerID> {
    let copy = new ZPY<PlayerID>(this.rules);
    copy.phase    = this.phase;
    copy.identity = player;

    copy.owner   = this.owner;
    copy.players = this.players;
    copy.ranks   = this.ranks;
    copy.ndecks  = this.ndecks;

    copy.round     = this.round;
    copy.order     = this.order;
    copy.consensus = this.consensus;

    // deck is redacted, but not deck_sz
    copy.deck_sz = this.deck_sz;
    if (this.phase === ZPY.Phase.KITTY &&
        (player === this.host || this.bids.length === 0)) {
      // kitty is public during Phase.KITTY iff no one bid
      copy.kitty = this.kitty;
    }
    copy.bids    = this.bids;
    // other players' draws are redacted
    if (player in this.draws) {
      copy.draws[player] = this.draws[player];
    }
    copy.cur_idx = this.cur_idx;

    copy.host = this.host;
    copy.tr   = this.tr;
    // other players' hands are redacted
    if (player in this.hands) {
      copy.hands[player] = this.hands[player];
    }
    copy.points  = this.points;
    copy.friends = this.friends;
    copy.joins   = this.joins;
    copy.host_team = this.host_team;
    copy.atk_team  = this.atk_team;

    copy.leader  = this.leader;
    copy.lead    = this.lead;
    copy.plays   = this.plays;
    copy.winning = this.winning;

    return copy;
  }

  /*
   * Human-readable game state printout.
   */
  toString(color: boolean = false): string {
    let out =
`identity: ${this.identity ?? 'global'}
phase: ${ZPY.Phase[this.phase]}

owner: ${this.owner}
ndecks: ${this.ndecks}
players: ${this.players.join(', ')}
ranks:
${o_map(this.ranks,
  (p, meta) => `  ${p}: ${
    o_map(meta,
      ((k: string, v: Rank) => `${k[0]}:${rank_to_string(v)}`) as any
    ).join(' ')
  }`
).join('\n')}

round: ${this.round}
consensus: ${Array.from(this.consensus.values()).join(', ')}

deck: ${this.deck.map(c => c.toString(color)).join(' ')}
kitty: ${this.kitty.map(c => c.toString(color)).join(' ')}
bids:
${this.bids.map(
  ({player, card, n}) => `  ${player}: ${
    array_fill(n, card.toString(color)).join(' ')
  }`
).join('\n')}
current: ${this.current()}

host: ${this.host}
tr: ${this.tr?.toString(color)}
friends: ${this.friends.map(
  ({card, nth}) => `${card.toString(color)}:${nth}º`
).join(', ')}
joins: ${this.joins}
host_team: ${Array.from(this.host_team.values()).join(', ')}
atk_team: ${Array.from(this.atk_team.values()).join(', ')}

leader: ${this.leader}
lead: ${this.lead?.toString(this.tr, color)}
plays:
${o_map(this.plays,
  (p, play) => `  ${p}: ${play.toString(this.tr, color)}`
).join('\n')}
winning: ${this.winning}

points:
${o_map(this.points,
  (p, cards) => `  ${p}: ${cards.map(c => c.toString(color)).join(' ')}`
).join('\n')}`;

    for (let p of this.players) {
      let hand_pile = this.hands[p]?.pile ?? this.draws[p];
      if (!hand_pile) continue;

      out += `

${p}'s hand: ${hand_pile.size > 0 ? '\n' + hand_pile.toString(color) : ''}`;
    }
    return out;
  }
}

///////////////////////////////////////////////////////////////////////////////

export namespace ZPY {
  export enum RenegeRule {
    ACCUSE,   // reneges are tracked, but must be called out by other players
    FORBID,   // disallow plays that would result in a renege
    AUTOLOSE, // reneges immediately cause players to lose
    UNDO_ONE, // allow players to undo their renege play before the trick ends
  }
  export enum RankSkipRule {
    PLAY_ONCE, // must play 5,10,J,K,W once before ranking up
    NO_SKIP,   // must stop at 5,10,J,K,W before passing
    NO_PASS,   // must win as host on 5,10,J,K,W to pass
    NO_RULE,   // no limits, freely skip any rank
  }
  export enum KittyMultiplierRule {
    EXP,  // 2^n multiplier
    MULT, // 2*n multiplier
  }
  export type RuleModifiers = {
    renege: RenegeRule;
    rank: RankSkipRule;
    kitty: KittyMultiplierRule;
  }

  export enum Phase {
    INIT,    // assembling players
    DRAW,    // drawing cards; bidding on trump
    PREPARE, // last chance to bid or request a redeal
    KITTY,   // host discarding a new kitty
    FRIEND,  // host naming friends
    LEAD,    // player leading a trick
    FLY,     // waiting to see if a lead flies
    FOLLOW,  // players following a lead
    FINISH,  // end-of-round; waiting to decide victor
    WAIT,    // between rounds; players can leave
  }

  export class Error {
    constructor(readonly msg?: string) {}
    toString(): string { return `${this.constructor.name}: ${this.msg}`; }
  }
  export class BadPhaseError extends Error {
    static from(intent: string, phase: Phase) {
      return new BadPhaseError(
        `${intent} not valid for Phase.${Phase[phase]}`
      );
    }
    constructor(msg?: string) { super(msg); }
  }
  export class InvalidArgError extends Error {
    constructor(msg?: string) { super(msg); }
  }
  export class DuplicateActionError extends Error {
    constructor(msg?: string) { super(msg); }
  }
  export class WrongPlayerError extends Error {
    constructor(msg?: string) { super(msg); }
  }
  export class OutOfTurnError extends Error {
    constructor(msg?: string) { super(msg ?? "not your turn"); }
  }
  export class InvalidPlayError extends Error {
    constructor(msg?: string) { super(msg); }
  }
  export type Result<T = void> = T | Error;
}
