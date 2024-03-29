/*
 * interactive play portion of the ZPY board
 */
import * as React from 'react'
import {
  DragDropContext,
  Draggable, DraggableProvided, DraggableStateSnapshot,
  Droppable, DroppableProvided, DroppableStateSnapshot,
  DragStart, DropResult,
} from 'react-beautiful-dnd'

import * as P from 'protocol/protocol'

import { TrumpMeta, Suit, CardBase, Card, CardPile } from 'lib/zpy/cards'
import { Play, Flight } from 'lib/zpy/trick'
import { ZPY } from 'lib/zpy/zpy'
import * as ZPYEngine from 'lib/zpy/engine'

import { CardID, EngineCallbacks } from 'components/zpy/common'
import { CardImage } from 'components/zpy/CardImage'
import { card_width, CardArea, EmptyArea } from 'components/zpy/CardArea'
import { ConfigArea } from 'components/zpy/ConfigArea'
import { FriendSelector } from 'components/zpy/FriendSelector'
import { Instructions } from 'components/zpy/Instructions'

import { isMac } from 'components/utils/platform'

import { array_fill } from 'utils/array'
import * as cookie from 'utils/cookie'

import assert from 'utils/assert'


export class PlayArea extends React.Component<
  PlayArea.Props,
  PlayArea.State
> {
  constructor(props: PlayArea.Props) {
    super(props);

    // server message callbacks
    this.onReset = this.onReset.bind(this);
    this.onUpdate = this.onUpdate.bind(this);

    // player actions
    this.onSubmit = this.onSubmit.bind(this);
    this.onEffect = this.onEffect.bind(this);
    this.onPlayEffect = this.onPlayEffect.bind(this);
    this.onConfigChange = this.onConfigChange.bind(this);
    this.onClickDeck = this.onClickDeck.bind(this);

    // window event listeners
    this.onClickOut = this.onClickOut.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);

    // drag/drop/select handlers
    this.onClickCard = this.onClickCard.bind(this);
    this.onTeleport = this.onTeleport.bind(this);
    this.onFriendSelect = this.onFriendSelect.bind(this);
    this.onDragStart = this.onDragStart.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);

    const hand = this.props.zpy.hand(this.props.me.id);

    const state = PlayArea.withCardsAdded({
      seen: [],

      id_set: new Set(),
      areas: [{ordered: [], id_to_pos: {}}],
      id_to_area: {},

      selected: new Set(),
      prev_start: null,
      prev_stop: null,
      multidrag: null,

      config: {
        ndecks: this.props.zpy.ndecks,
        ...this.props.zpy.rules,
      },
      fr_select: array_fill(this.props.zpy.ndecks, () => ({})),

      auto_sort: cookie.parse(document.cookie).auto_sort === 'true',
      auto_draw: cookie.parse(document.cookie).auto_draw === 'true',
      auto_play: false,
      full_control: false,

      action_pending: false,
      pending_cards: [],
    }, props, hand, 0);

    this.state = PlayArea.validate(state);

    this.props.funcs.subscribeReset(this.onReset);
    this.props.funcs.subscribeUpdate(this.onUpdate);
  }

  componentDidMount() {
    window.addEventListener('click', this.onClickOut);
    window.addEventListener('touchend', this.onClickOut);
    window.addEventListener('keydown', this.onKeyDown);
  }

  componentWillUnmount() {
    window.removeEventListener('click', this.onClickOut);
    window.removeEventListener('touchend', this.onClickOut);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  /////////////////////////////////////////////////////////////////////////////
  /*
   * this.state coherency
   */

  /*
   * assert coherency of `state`, then return it for convenience
   */
  static validate(state: PlayArea.State): PlayArea.State {
    // all cards should be unique and tracked
    const cards = PlayArea.filter(state);
    assert(cards.length === state.id_set.size);
    assert(cards.every(card => state.id_set.has(card.id)));

    // all metadata ids should be valid
    for (let id of [
      state.prev_start,
      state.prev_stop,
      state.multidrag?.id ?? null,
    ]) {
      assert(id === null || state.id_set.has(id));
    }

    // areas should be tracked and correct
    assert(state.areas.every(
      (area, adx) => area.ordered.every(
        (card, i) => (
          state.id_to_area[card.id] === adx &&
          area.id_to_pos[card.id] === i
        )
      )
    ));
    return state;
  }

  /*
   * make a deep copy of `state`
   */
  static copyState(state: PlayArea.State): PlayArea.State {
    return {
      seen: [...state.seen],

      id_set: new Set(state.id_set),
      areas: state.areas.map(({ordered, id_to_pos}) => ({
        ordered: [...ordered],
        id_to_pos: {...id_to_pos},
      })),
      id_to_area: {...state.id_to_area},

      selected: new Set(state.selected),
      prev_start: state.prev_start,
      prev_stop: state.prev_stop,
      multidrag: state.multidrag,

      config: {...state.config},
      fr_select: state.fr_select.map(fr => ({...fr})),

      auto_sort: state.auto_sort,
      auto_draw: state.auto_draw,
      auto_play: state.auto_play,
      full_control: state.full_control,

      action_pending: state.action_pending,
      pending_cards: [...state.pending_cards],
    }
  }

  /*
   * return a copy of `state` with `to_add` added to area `adx`
   *
   * we treat `cards` as never-before-seen objects, and assign them id's
   */
  static withCardsAdded(
    state: PlayArea.State,
    props: PlayArea.Props,
    to_add: Iterable<CardBase>,
    adx: number,
  ): PlayArea.State {
    assert(adx === 0 || adx === 1, 'withCardsAdded: invalid adx', adx);

    state = PlayArea.copyState(state);

    if (adx === 1) {
      if (state.areas[1]?.ordered.length > 0) {
        // shunt any staged cards back into the hand
        state.areas[0].ordered =
          state.areas[0].ordered.concat(state.areas[1].ordered);
        state.areas[0].id_to_pos = id_to_pos(state.areas[0].ordered);
        state.id_to_area = {
          ...state.id_to_area,
          ...id_to_cns(state.areas[1].ordered, 0),
        };
      }
      // reset kitty area
      state.areas[1] = {ordered: [], id_to_pos: {}};
    }

    for (let cb of to_add) {
      const c = {
        cb: CardBase.strip(cb),
        id: ('' + state.seen.length)
      };
      state.seen.push(c);
      state.id_set.add(c.id);
      state.areas[adx].id_to_pos[c.id] = state.areas[adx].ordered.length;
      state.areas[adx].ordered.push(c);
      state.id_to_area[c.id] = adx;
    }
    return state.auto_sort
      ? PlayArea.withHandSorted(state, props)
      : state;
  }

  /*
   * return a copy of `state` with `to_rm` removed
   */
  static withCardsRemoved(
    state: PlayArea.State,
    props: PlayArea.Props,
    to_rm: CardID[],
  ): PlayArea.State {
    for (let {cb, id} of to_rm) {
      state.id_set.delete(id);
      state.selected.delete(id);

      delete state.id_to_area[id];

      if (id === state.prev_start) {
        state.prev_start = null;
        state.prev_stop = null;
      }
      if (id === state.prev_stop) {
        state.prev_stop = null;
      }
    }
    const rm_ids = new Set(to_rm.map(c => c.id));

    for (let area of state.areas) {
      const prev_len = area.ordered.length;
      area.ordered = area.ordered.filter(c => !rm_ids.has(c.id));

      if (area.ordered.length !== prev_len) {
        area.id_to_pos = id_to_pos(area.ordered);
      }
    }
    return PlayArea.reapAreas(state, props);
  }

  /*
   * discard empty non-hand areas in `state` and update `id_to_pos`
   */
  static reapAreas(
    state: PlayArea.State,
    props: PlayArea.Props,
  ): PlayArea.State {
    const areas = [...state.areas].filter(
      (area, adx) => adx === 0 || area.ordered.length > 0
    );
    if (areas.length === state.areas.length) return state;

    const id_to_area = {...state.id_to_area};

    // remap all cards in all areas besides the hand
    for (let adx = 1; adx < areas.length; ++adx) {
      const ordered = areas[adx].ordered;
      for (let pos = 0; pos < ordered.length; ++pos) {
        id_to_area[ordered[pos].id] = adx;
      }
    }
    return {...state, areas, id_to_area};
  }

  /*
   * filter a flattened, ordered array of all cards in `state`
   */
  static filter(
    state: PlayArea.State,
    filt?: (card: CardID) => boolean
  ): CardID[] {
    return state.areas.flatMap(
      area => filt ? area.ordered.filter(filt) : area.ordered
    );
  }

  /////////////////////////////////////////////////////////////////////////////
  /*
   * server message reactivity
   */

  /*
   * account for new/removed cards from a server reset and trigger automatic
   * responses
   */
  onReset(zpy: ZPYEngine.ClientState) {
    const hand = zpy.hand(this.props.me.id);

    this.setState((state, props) => {
      const all_cards = PlayArea.filter(state);
      const {
        left: to_add,
        right: to_rm
      } = card_delta(hand, all_cards, zpy.tr);

      if (to_add.length > 0) {
        state = PlayArea.withCardsAdded(state, props, to_add, 0);
      }
      if (to_rm.length > 0) {
        state = PlayArea.withCardsRemoved(state, props, to_rm);
      }
      return {...state, action_pending: false};
    });

    // if this is a reconnect, apply all the auto options
    this.tryAutoSort();
    this.tryAutoDraw();
    this.tryAutoPlay();
  }

  /*
   * account for state changes from a server update
   */
  onUpdate(effect: ZPYEngine.Effect) {
    const me = this.props.me.id;
    const zpy = this.props.zpy;

    switch (effect.kind) {
      case 'set_decks':
        this.setState({
          fr_select: array_fill(zpy.ndecks, () => ({}))
        });
        break;

      case 'init_game':
      case 'add_to_hand':
        this.tryAutoDraw();
        break;
      case 'secure_bid':
        this.tryAutoSort();
        break;
      case 'observe_follow':
        this.tryAutoPlay();
        break;

      case 'install_host': {
        const kitty = effect.args[1];
        if (me === zpy.host && kitty.length > 0) {
          this.setState((state, props) =>
            PlayArea.withCardsAdded(state, props, kitty, 1)
          );
        }
        break;
      }
      case 'reject_fly': {
        if (me === zpy.leader) {
          // our fly was rejected, so remove our forced play from our hand
          this.setState((state, props) => {
            const to_rm = card_delta(
              effect.args[2].gen_cards(zpy.tr),
              state.pending_cards,
              zpy.tr
            ).both;
            return {
              ...PlayArea.withCardsRemoved(state, props, to_rm),
              pending_cards: [],
            };
          });
        } else if (me === effect.args[0]) {
          // put our reveal back in our hand to avoid auto-play
          this.resetPlays();
        }
        break;
      }
      case 'pass_contest': {
        if (me === zpy.leader && zpy.phase === ZPY.Phase.FOLLOW) {
          // our fly passed, so remove the cards from our hand
          this.setState((state, props) => ({
            ...PlayArea.withCardsRemoved(state, props, state.pending_cards),
            pending_cards: [],
          }));
        }
        break;
      }

      default: break;
    }
  }

  tryAutoSort() {
    if (this.state.auto_sort) {
      this.setState((state, props) => PlayArea.withHandSorted(state, props));
    }
  }

  tryAutoDraw() {
    const me = this.props.me.id;
    const zpy = this.props.zpy;

    if (this.state.auto_draw &&
        this.props.phase === ZPY.Phase.DRAW &&
        zpy.is_current(me)) {
      setTimeout(() => this.submitDrawCard(), 250);
    }
  }

  tryAutoPlay() {
    const me = this.props.me.id;
    const zpy = this.props.zpy;

    if (this.state.auto_play &&
        this.props.phase === ZPY.Phase.FOLLOW &&
        zpy.is_current(me) &&
        !zpy.trick_over()) {
      this.submitFollowLead();
    }
  }

  /////////////////////////////////////////////////////////////////////////////
  /*
   * intent submission
   */

  submitStartGame(): boolean {
    return this.attempt({kind: 'start_game', args: [this.props.me.id]});
  }

  submitDrawCard(): boolean {
    if (!this.props.zpy.is_current(this.props.me.id)) return false;

    return this.attempt(
      {kind: 'draw_card', args: [this.props.me.id]},
      (effect: ZPYEngine.Effect) => {
        if (effect.kind !== 'add_to_hand') {
          assert(false, 'unexpected effect for draw_card', effect);
          return;
        }
        if (effect.args[0] !== this.props.me.id) return;

        this.setState((state, props) =>
          PlayArea.withCardsAdded(state, props, [effect.args[1]], 0)
        );
        this.onEffect(effect);
      }
    );
  }

  submitBidTrump(): boolean {
    const cards = this.state.areas[1]?.ordered ?? [];
    if (cards.length === 0) return false;

    const cb = cards[0].cb;
    if (!cards.every(c => CardBase.same(c.cb, cb))) return false;

    return this.attempt({
      kind: 'bid_trump',
      args: [this.props.me.id, cb, cards.length],
    });
  }

  submitReady(): boolean {
    return this.attempt({kind: 'ready', args: [this.props.me.id]});
  }

  submitBidOrReady(): boolean {
    const cards = this.state.areas[1]?.ordered ?? [];

    if (cards.length === 0 &&
        this.props.phase === ZPY.Phase.PREPARE) {
      return this.submitReady();
    }
    return this.submitBidTrump();
  }

  submitReplaceKitty(): boolean {
    const cards = this.state.areas[1]?.ordered ?? [];
    if (cards.length === 0) return false;

    return this.attempt({
      kind: 'replace_kitty',
      args: [this.props.me.id, cards.map(c => c.cb)],
    }, this.onPlayEffect.bind(this, cards));
  }

  submitCallFriends(): boolean {
    const friends = this.state.fr_select.flatMap(fr => Object.values(fr));
    if (friends.length === 0) return false;

    return this.attempt({
      kind: 'call_friends',
      args: [this.props.me.id, friends]
    });
  }

  submitLeadPlay(): boolean {
    const play = this.extractPlay();
    if (!play) return false;

    const fl = play.fl();
    if (!fl) {
      this.props.funcs.queueError(new ZPY.InvalidPlayError(
        'no mixed-suit leads'
      ));
      return false;
    }

    const to_rm = this.state.areas.slice(1).flatMap(a => a.ordered);

    return this.attempt(
      {kind: 'lead_play', args: [this.props.me.id, fl]},
      this.onPlayEffect.bind(this, to_rm)
    );
  }

  submitFollowLead(): boolean {
    const play = this.extractPlay();
    if (!play) return false;

    const to_rm = this.state.areas.slice(1).flatMap(a => a.ordered);

    return this.attempt(
      {kind: 'follow_lead', args: [this.props.me.id, play]},
      this.onPlayEffect.bind(this, to_rm)
    );
  }

  submitCollectTrick(): boolean {
    if (this.props.me.id !== this.props.zpy.winning) return false;
    return this.attempt({kind: 'collect_trick', args: [this.props.me.id]});
  }

  submitFollowOrCollect(): boolean {
    if (this.props.zpy.trick_over()) {
      return this.submitCollectTrick();
    }
    if (!this.props.zpy.is_current(this.props.me.id)) {
      // if we're /not/ the current player, enable auto-play
      this.setState({auto_play: true});
      return false;
    }
    return this.submitFollowLead();
  }

  submitContestFly(): boolean {
    const cards = this.state.areas[1]?.ordered ?? [];
    if (cards.length === 0) return false;

    return this.attempt({
      kind: 'contest_fly',
      args: [this.props.me.id, cards.map(c => c.cb)],
    });
  }

  submitPassContest(): boolean {
    return this.attempt({kind: 'pass_contest', args: [this.props.me.id]});
  }

  submitContestOrPass(): boolean {
    const cards = this.state.areas[1]?.ordered ?? [];
    if (cards.length === 0) {
      return this.submitPassContest();
    }
    return this.submitContestFly();
  }

  submitUndoPlay(): boolean {
    if (this.state.action_pending) return false;

    const play = this.props.zpy.plays[this.props.me.id] ?? null;
    if (play === null) return false;

    const to_add = play.gen_cards(this.props.zpy.tr);

    return this.attempt(
      {kind: 'undo_play', args: [this.props.me.id]},
      (effect: ZPYEngine.Effect) => {
        this.setState((state, props) =>
          PlayArea.withCardsAdded(state, props, to_add, 0)
        );
        this.onEffect(effect);
      }
    );
  }

  submitEndRound(): boolean {
    if (this.props.me.id !== this.props.zpy.host) return false;
    return this.attempt({kind: 'end_round', args: [this.props.me.id]});
  }

  submitNextReady(): boolean {
    if (this.props.me.id === this.props.zpy.host) return false;
    return this.attempt({kind: 'next_ready', args: [this.props.me.id]});
  }

  submitNextRound(): boolean {
    if (this.props.me.id !== this.props.zpy.host) return false;
    return this.attempt({kind: 'next_round', args: [this.props.me.id]});
  }

  submitReadyOrNext(): boolean {
    return this.props.zpy.has_consensus()
      ? this.submitNextRound()
      : this.submitNextReady();
  }

  /*
   * yoink a play out of the staging area
   */
  extractPlay(): null | Play {
    const piles = this.state.areas.slice(1).map(
      area => Play.extract(area.ordered.map(c => c.cb), this.props.zpy.tr)
    );
    if (piles.length === 0) return null;

    // full-control: just return the Play#extract'd play
    if (!this.state.full_control && piles.length === 1) {
      return piles[0];
    }

    // even in full-control mode, a single Toss is valid
    if (piles.length === 1 && piles[0].ts() !== null) {
      return piles[0];
    }
    // past this point, we should be in full-control mode with either multiple
    // piles or a single pile that's a Flight

    const components: Flight[] = piles
      .map(p => p.fl())
      .filter(fl => fl !== null);

    // no component can be a Toss
    if (components.length !== piles.length) {
      this.props.funcs.queueError(new ZPY.InvalidPlayError(
        'all cards must be the same suit in full-control mode'
      ));
      return null;
    }

    const v_suit = components[0].v_suit;

    // all components must be the same suit
    if (!components.every(fl => fl.v_suit === v_suit)) {
      this.props.funcs.queueError(new ZPY.InvalidPlayError(
        'all cards must be the same suit in full-control mode'
      ));
      return null;
    }

    let singletons: null | Flight = null;

    for (let fl of components) {
      if (fl.tractors.length === 1) continue;

      // at most one component with > 1 tractor allowed
      if (singletons !== null) {
        this.props.funcs.queueError(new ZPY.InvalidPlayError(
          'separate all your tuples, tractors, and singletons'
        ));
        return null;
      }
      singletons = fl;

      // that component must be all singletons
      if (fl.count !== fl.tractors.length) {
        this.props.funcs.queueError(new ZPY.InvalidPlayError(
          'separate all your tuples, tractors, and singletons'
        ));
        return null;
      }
    }
    // the piles form a valid Flight; flatten them all together
    return new Flight(components.flatMap(fl => fl.tractors));
  }

  /*
   * remove cards from state when a play action (replace_kitty, lead_play, or
   * follow_lead) commits
   */
  onPlayEffect(to_rm: CardID[], effect: ZPYEngine.Effect) {
    assert(effect.kind === 'replace_kitty' ||
           effect.kind === 'lead_play' ||
           effect.kind === 'follow_lead',
           'unexpected effect for card submit', effect);

    if (effect.args[0] !== this.props.me.id) return;

    this.setState((state, props) => {
      if (effect.kind === 'lead_play' &&
          effect.args[1].tractors.length > 1) {
        // we're trying to fly something, so we need to defer the removal of
        // cards from our hand until the fly either passes or fails
        assert(
          state.pending_cards.length === 0,
          'lead_play already in flight',
          state.pending_cards
        );
        return {
          ...state,
          auto_play: false,
          pending_cards: to_rm,
        };
      }
      return {
        ...PlayArea.withCardsRemoved(state, props, to_rm),
        auto_play: false,
      };
    });
    this.onEffect(effect);
  }

  /*
   * convenience wrapper around this.props.funcs.attempt
   */
  attempt(
    intent: ZPYEngine.Intent,
    onUpdate?: (effect: ZPYEngine.Effect) => void,
  ): true {
    this.setState({action_pending: true});

    this.props.funcs.attempt(
      intent,
      onUpdate ?? this.onEffect,
      this.onEffect
    );
    return true;
  }

  /*
   * shared logic around an attempt completing
   */
  onEffect(_?: any) {
    this.setState({action_pending: false});
  }

  /*
   * attempt a context-dependent action, returning whether or not we did
   * anything at all (even if we failed)
   */
  onSubmit(): boolean {
    if (this.state.action_pending) return false;

    switch (this.props.phase) {
      case ZPY.Phase.INIT: return this.submitStartGame();
      case ZPY.Phase.DRAW: return this.submitBidTrump();
      case ZPY.Phase.PREPARE: return this.submitBidOrReady();
      case ZPY.Phase.KITTY: return this.submitReplaceKitty();
      case ZPY.Phase.FRIEND: return this.submitCallFriends();
      case ZPY.Phase.LEAD: return this.submitLeadPlay();
      case ZPY.Phase.FLY: return this.submitContestOrPass();
      case ZPY.Phase.FOLLOW: return this.submitFollowOrCollect();
      case ZPY.Phase.FINISH: return this.submitEndRound();
      case ZPY.Phase.WAIT: return this.submitReadyOrNext();
    }
    return false;
  }

  /////////////////////////////////////////////////////////////////////////////
  /*
   * event handlers
   */

  /*
   * intercepted keypresses:
   *
   *  {ctrl,cmd}-a: select all cards
   *  enter: perform an action (typically submitting staged cards)
   */
  onKeyDown(ev: React.KeyboardEvent | KeyboardEvent) {
    if (ev.defaultPrevented) return;

    const ev_ = ev as (typeof ev & {editableCaptured: boolean});
    if (ev_.editableCaptured) return;

    const metaKey = isMac() ? ev.metaKey : ev.ctrlKey;

    if (ev.key === 'a' && metaKey) {
      ev.preventDefault();
      this.selectAll();
      return;
    }
    if (ev.key === 'z' && metaKey) {
      if (this.submitUndoPlay()) {
        ev.preventDefault();
      }
      return;
    }
    if (ev.key === 'S') {
      ev.preventDefault();
      this.sortHand();
      return;
    }
    if (ev.key === 'R') {
      ev.preventDefault();
      this.resetPlays();
      return;
    }
    if (ev.key === 'Enter') {
      if (this.onSubmit()) {
        ev.preventDefault();
      }
      return;
    }
  }

  /*
   * handler for click and touch events to trigger card manipulations
   *
   * the rules:
   *    - single click teleports the selected ?? clicked card(s) between the
   *      hand and play area 1
   *    - cmd-click adds or removes cards from the selection
   *    - shift-click performs range selection/deselection
   */
  onClickCard(id: string, ev: React.MouseEvent | React.TouchEvent) {
    // click is swallowed if a drag occurred
    if (ev.defaultPrevented) return;

    // left click only
    if ('button' in ev && ev.button !== 0) return;

    // synthetic events won't persist into the setState() callback
    const metaKey = isMac() ? ev.metaKey : ev.ctrlKey;
    const {shiftKey} = ev;

    ev.preventDefault(); // bypass window handler

    if (!metaKey && !shiftKey) {
      const dst_adx = this.state.id_to_area[id] === 0 ? 1 : 0;
      const dst_pos = this.state.areas[dst_adx]?.ordered?.length;

      return this.moveCards(dst_adx, dst_pos, id);
    }

    this.setState((state, props): PlayArea.State => {
      assert(state.prev_start === null ||
             state.selected.has(state.prev_start),
             'incoherent select state');

      if (state.prev_start === null || metaKey) {
        // either an initial selection or a continued selection
        const selected = new Set(state.selected);
        return (selected.delete(id) // true if deletion occured
          ? {...state, selected, prev_start: null}
          : {...state, selected: selected.add(id), prev_start: id}
        );
      }

      if (shiftKey) {
        // if the click target is in a different area from prev_start, this
        // selection operation is invalid
        if (state.id_to_area[id] !== state.id_to_area[state.prev_start]) {
          return state;
        }
        const area = state.areas[state.id_to_area[id]];
        const pos = area.id_to_pos[id];

        // range selection
        const selected = new Set(state.selected);

        const range_for = (prev_id: string) => {
          const prev_pos = area.id_to_pos[prev_id];
          return [Math.min(pos, prev_pos), Math.max(pos, prev_pos)];
        };

        if (state.prev_stop !== null) {
          const [first, last] = range_for(state.prev_stop);
          for (let o = first; o <= last; ++o) {
            selected.delete(area.ordered[o].id);
          }
        }
        const [first, last] = range_for(state.prev_start);
        for (let o = first; o <= last; ++o) {
          selected.add(area.ordered[o].id);
        }
        return {
          ...state,
          selected,
          prev_start: state.prev_start,
          prev_stop: id,
        };
      }

      // this shouldn't happen if single-click == teleport
      return (state.selected.size === 1 && state.selected.has(id)
        // only this card selected; toggle selection
        ? {...state, selected: new Set(), prev_start: null}
        // fresh selection; override existing selection with this card
        : {...state, selected: new Set([id]), prev_start: id}
      );
    });
  }

  /*
   * teleport the clicked or selected cards between the hand and staging area
   *
   * we handle dblclick events as well as mousedown, for middle-click
   *
   * NB: this is currently unused because single-click is being used as the
   * teleport trigger
   */
  onTeleport(id: string, ev: React.MouseEvent) {
    // click is swallowed if a drag occurred
    if (ev.defaultPrevented) return;

    switch (ev.type) {
      case 'dblclick':
        // left dblclick only
        if (ev?.button !== 0) return;
        break;
      case 'mousedown':
        // middle mousedown only
        if (ev?.button !== 1) return;
        break;
      default: return;
    }

    ev.preventDefault(); // bypass window handler

    const dst_adx = this.state.id_to_area[id] === 0 ? 1 : 0;
    const dst_pos = this.state.areas[dst_adx]?.ordered?.length;

    this.moveCards(dst_adx, dst_pos, id);
  }

  /*
   * event handler for clicking outside of all selectable items
   */
  onClickOut(
    ev: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent
  ) {
    if (ev.defaultPrevented) return;
    if ('button' in ev && ev.button !== 0) return;
    this.deselectAll();
  }

  onDragStart(start: DragStart) {
    if (!this.state.selected.has(start.draggableId)) {
      this.deselectAll();
    }
    if (this.state.selected.size <= 1) {
      return;
    }
    // cards were added or removed, or we need to trigger multi-drag rendering
    this.setState((state, props) => {
      const pile = PlayArea
        .filter(state, card => state.selected.has(card.id))
        .map(card => card.cb);

      return {multidrag: {id: start.draggableId, pile}};
    });
  }

  onDragEnd(result: DropResult) {
    const { source: src, destination: dst } = result;

    if (!dst || result.reason === 'CANCEL') {
      this.setState({multidrag: null});
      return;
    }
    const dst_adx = parseInt(dst.droppableId);
    const src_id = result.draggableId;

    this.moveCards(dst_adx, dst.index, src_id);
  };

  /////////////////////////////////////////////////////////////////////////////
  /*
   * card area manipulation
   */

  selectAll() {
    this.setState((state, props) => ({
      selected: new Set(state.id_set),
    }));
  }

  deselectAll() {
    if (this.state.selected.size === 0) return;

    this.setState({
      selected: new Set(),
      prev_start: null,
      prev_stop: null,
    });
  }

  sortHand() {
    if (this.props.zpy.tr === null) return;

    this.setState((state, props) => PlayArea.withHandSorted(state, props));
  }

  static withHandSorted(
    state: PlayArea.State,
    props: PlayArea.Props,
  ): PlayArea.State {
    // if there's no host and nobody has bid yet, we want cards of our own rank
    // to be considered trump
    const tr = props.zpy.host === null && props.zpy.bids.length === 0
      ? new TrumpMeta(Suit.TRUMP, props.zpy.ranks[props.me.id].rank)
      : props.zpy.tr;

    if (tr === null) return;

    const suit_order: number[] = [...CardBase.SUITS];
    if (tr.suit !== Suit.TRUMP) {
      for (let i = 0; i < 4; ++i) {
        suit_order[(tr.suit + 1 + i) % 4] = i;
      }
    }
    suit_order.push(Suit.TRUMP);

    const sorted = [...state.areas[0].ordered].sort((l, r) => {
      const ll = Card.from(l.cb, tr);
      const rr = Card.from(r.cb, tr);
      return Math.sign(suit_order[ll.v_suit] - suit_order[rr.v_suit]) ||
             Math.sign(ll.v_rank - rr.v_rank) ||
             // this last term is for matching up off-suit natural trumps
             Math.sign(ll.suit - rr.suit);
    });
    return {
      ...state,
      areas: [
        {
          ordered: sorted,
          id_to_pos: id_to_pos(sorted),
        },
        ...state.areas.slice(1)
      ]
    };
  }

  resetPlays() {
    if (this.state.areas.length === 1) return;
    if (this.state.id_set.size === this.state.areas[0].ordered.length) return;

    this.setState((state, props) => {
      const play_areas = state.areas.slice(1);

      const hand_ordered = state.areas[0].ordered.concat(
        ...play_areas.map(area => area.ordered)
      );
      state = PlayArea.reapAreas({
        ...state,
        areas: [
          {
            ordered: hand_ordered,
            id_to_pos: id_to_pos(hand_ordered),
          },
          ...play_areas.map(_ => ({ordered: [], id_to_pos: {}}))
        ],
        id_to_area: id_to_cns(hand_ordered, 0),
      }, props);

      return state.auto_sort
        ? PlayArea.withHandSorted(state, props)
        : state;
    });
  }

  /*
   * take all selected cards (or the card given by `src_id` if no cards are
   * selected) and move them into `dst_adx` at `dst_pos`
   */
  moveCards(dst_adx: number, dst_pos: number, src_id: string) {
    this.setState((state, props): PlayArea.State => {
      if (dst_adx === state.areas.length) {
        // user dragged or teleported card(s) into the "next area" area OR into
        // a play area that we don't have set up in `state`; instantiate it
        // here (unless the area shouldn't exist)
        if (props.phase === ZPY.Phase.FRIEND) return;
        state = {
          ...state,
          areas: [...state.areas, {ordered: [], id_to_pos: {}}],
        };
      }

      const multidrag_id = state.multidrag?.id ?? null;
      state = {...state, multidrag: null};

      const dst_area = state.areas[dst_adx];

      const is_dragging = (card: CardID): boolean => {
        return state.selected.size !== 0
          ? state.selected.has(card.id)
          : card.id === src_id;
      };
      const is_not_dragging = (card: CardID): boolean => !is_dragging(card);

      // count the number of cards that remain before dst_pos once we move all
      // the dragging cards out of the way
      const dst_pos_after = Math.min(
        dst_area.ordered.reduce((n, card, i) => {
          if (i > dst_pos) return n;

          const skip = (true || multidrag_id === null) // [multidrag policy]
            ? is_dragging(card)
            : card.id === multidrag_id;

          return skip ? n : n + 1;
        }, 0),
        dst_pos
      );

      const not_dragging = [...dst_area.ordered].filter(is_not_dragging);

      const dst_ordered = [
        ...not_dragging.slice(0, dst_pos_after),
        ...PlayArea.filter(state, is_dragging),
        ...not_dragging.slice(dst_pos_after),
      ];

      const selected = state.selected.size !== 0
        ? [...state.selected]
        : [src_id];
      const affected_areas = new Set(selected.map(id => state.id_to_area[id]));

      state = PlayArea.validate(PlayArea.reapAreas({
        ...state,
        areas: state.areas.map((area, adx) => {
          if (adx === dst_adx) {
            return {
              ordered: dst_ordered,
              id_to_pos: id_to_pos(dst_ordered)
            };
          }
          if (affected_areas.has(adx)) {
            const ordered = [...area.ordered].filter(is_not_dragging);
            return {ordered, id_to_pos: id_to_pos(ordered)};
          }
          return area;
        }),
        id_to_area: {
          ...state.id_to_area,
          ...Object.fromEntries(selected.map(id => [id, dst_adx]))
        },
      }, props));

      if (state.auto_sort) {
        if (dst_adx === 0 && affected_areas.has(0)) {
          state = {...state, auto_sort: false};
        } else {
          state = PlayArea.withHandSorted(state, props);
        }
      }
      return state;
    });
  }

  /////////////////////////////////////////////////////////////////////////////
  /*
   * user options buttons
   */

  renderToggleButton(
    label: string,
    option: keyof PlayArea.UserOptions,
    tooltip: string,
    on_toggle?: (checked: boolean) => void,
  ) {
    const checked = this.state[option];

    const toggle = <label
      key={option}
      className={`toggle ${option} ${checked ? 'on' : 'off'}`}
    >
      <input
        className={`toggle-input ${option}`}
        name={option}
        type="checkbox"
        checked={checked}
        onChange={ev => {
          this.setState({[option]: ev.target.checked} as any);
          on_toggle?.(ev.target.checked);
        }}
      />
      <div
        className={`toggle-text ${option}`}
      >
        {label}
      </div>
    </label>;

    return <div
      key={option}
      aria-label={tooltip}
      data-balloon-pos="up-right"
    >
      {toggle}
    </div>;
  }

  renderUserOptions() {
    const auto_sort = this.renderToggleButton(
      'keep hand sorted',
      'auto_sort',
      'sort by rank order, alternating suits, with trumps last',
      checked => {
        if (checked) this.sortHand();
        document.cookie = `auto_sort=${checked};secure`;
      }
    );

    const auto_draw = this.renderToggleButton(
      'auto-draw',
      'auto_draw',
      'automatically draw cards on your turn',
      checked => {
        if (checked &&
            this.props.phase === ZPY.Phase.DRAW &&
            this.props.zpy.is_current(this.props.me.id)) {
          this.submitDrawCard();
        }
        document.cookie = `auto_draw=${checked};secure`;
      }
    );

    const auto_play = this.renderToggleButton(
      'auto-play staged',
      'auto_play',
      'auto-play the cards below when it\'s your turn',
      checked => {
        if (!checked) return;

        // refuse if there are no cards staged
        const count = this.state.areas.slice(1).reduce(
          (total, a) => total + a.ordered.length, 0
        );
        if (count === 0) this.setState({auto_play: false});
        // we undo auto-play every time a play is made; see onPlayEffect()
      }
    );

    const full_control = this.renderToggleButton(
      'full play control',
      'full_control',
      'enable playing cards in separate piles for complex fly patterns',
      // reset the play area, or else some cards might get hidden
      checked => { if (!checked) this.resetPlays(); }
    );

    const opts = [auto_sort];

    switch (this.props.phase) {
      case ZPY.Phase.INIT: return null;
      case ZPY.Phase.DRAW: opts.push(auto_draw); break;
      case ZPY.Phase.PREPARE: break;
      case ZPY.Phase.KITTY: break;
      case ZPY.Phase.FRIEND: break;
      case ZPY.Phase.LEAD: opts.push(full_control); break;
      case ZPY.Phase.FLY: break;
      case ZPY.Phase.FOLLOW:
        opts.push(full_control);
        if (this.props.me.id !== this.props.zpy.leader) {
          opts.push(auto_play);
        }
        break;
      case ZPY.Phase.FINISH: break;
      case ZPY.Phase.WAIT: return null;
    }

    return <div className="user-options">{opts}</div>;
  }

  /////////////////////////////////////////////////////////////////////////////
  /*
   * toplevel render functions
   */

  renderSingletonStagingArea() {
    return <CardArea
      droppableId="1"
      cards={this.state.areas[1]?.ordered ?? []}
      selected={this.state.selected}
      multidrag={this.state.multidrag}
      onClick={this.onClickCard}
    />;
  }

  onConfigChange<K extends ConfigArea.Key>(key: K, val: ConfigArea.T[K]) {
    if (key === 'ndecks') {
      this.attempt({kind: 'set_decks', args: [this.props.me.id, val]});
    } else {
      this.attempt({
        kind: 'set_rule_mods',
        args: [this.props.me.id, {[key]: val}]
      });
    }
    this.setState((state, props) => ({
      config: {...state.config, [key]: val}
    }));
  }

  renderSetupArea() {
    if (this.props.me.id !== this.props.zpy.owner) return null;

    return <ConfigArea
      nplayers={this.props.zpy.players.length}
      config={this.state.config}
      onChange={this.onConfigChange}
    />;
  }

  onClickDeck(ev: React.MouseEvent | React.TouchEvent) {
    if (ev.defaultPrevented) return;
    if ('button' in ev && ev.button !== 0) return;

    // XXX: ideally just don't even render the deck
    if (this.props.phase !== ZPY.Phase.DRAW) return;

    ev.preventDefault();
    this.submitDrawCard();
  }

  renderDrawArea() {
    return <div className="action draw">
      <div className="deck">
        <div
          aria-label={`${this.props.zpy.deck_sz} cards left`}
          data-balloon-pos="left"
        >
          <CardImage
            card="back"
            width={card_width}
            onClick={this.onClickDeck}
          />
        </div>
      </div>
      <div className="bids">
        {this.renderSingletonStagingArea()}
      </div>
    </div>;
  }

  onFriendSelect(
    cb: CardBase,
    nth: number,
    ev: React.MouseEvent | React.TouchEvent
  ) {
    ev.preventDefault();

    this.setState((state, props) => ({
      fr_select: state.fr_select.map((fr, i) => {
        if (i !== nth) return fr;
        const key = cb.toString();

        if (key in fr) {
          const result = {...fr};
          delete result[key];
          return result;
        }
        return {...fr, [key]: [cb, nth + 1]};
      })
    }));
  }

  renderFriendArea() {
    if (this.props.me.id !== this.props.zpy.host) return null;

    return <div className="action friend">
      <FriendSelector
        tr={this.props.zpy.tr}
        selected={this.state.fr_select}
        onSelect={this.onFriendSelect}
      />
    </div>;
  }

  renderStagingArea() {
    const variadic_staging = this.state.full_control && (
      this.props.phase === ZPY.Phase.LEAD ||
      this.props.phase === ZPY.Phase.FOLLOW
    );

    if (!variadic_staging) {
      return <div className="action staging">
        {this.renderSingletonStagingArea()}
      </div>;
    }

    return <div className="action staging">
      {this.state.areas.map((area, adx) => {
        if (adx === 0) return null;
        return <CardArea
          key={adx}
          droppableId={'' + adx}
          cards={this.state.areas[adx].ordered}
          selected={this.state.selected}
          multidrag={this.state.multidrag}
          onClick={this.onClickCard}
        />
      })}
      <EmptyArea
        key={this.state.areas.length}
        droppableId={'' + this.state.areas.length}
        text={this.state.areas.length > 1 ? "start another fly chunk" : null}
      />
    </div>
  }

  renderActionArea() {
    const component = (() => {
      switch (this.props.phase) {
        case ZPY.Phase.INIT:
          return this.renderSetupArea();
        case ZPY.Phase.DRAW:
        case ZPY.Phase.PREPARE:
          return this.renderDrawArea();
        case ZPY.Phase.FRIEND:
          return this.renderFriendArea();
        case ZPY.Phase.KITTY:
        case ZPY.Phase.LEAD:
        case ZPY.Phase.FLY:
        case ZPY.Phase.FOLLOW:
          return this.renderStagingArea();
        case ZPY.Phase.FINISH:
          return null;
        case ZPY.Phase.WAIT:
          return this.renderSetupArea();
      }
      return null;
    })();
    return component ?? (<div className="action"></div>);
  }

  renderHand() {
    if (this.props.phase <= ZPY.Phase.INIT ||
        this.props.phase >= ZPY.Phase.FINISH) {
      return null;
    }
    return <div className="hand">
      <CardArea
        droppableId="0"
        cards={this.state.areas[0].ordered}
        selected={this.state.selected}
        multidrag={this.state.multidrag}
        onClick={this.onClickCard}
      />
    </div>;
  }

  /////////////////////////////////////////////////////////////////////////////

  render() {
    return (
      <DragDropContext
        onDragStart={this.onDragStart}
        onDragEnd={this.onDragEnd}
      >
        <div className="action-container">
          {this.renderUserOptions()}
          {this.renderActionArea()}
        </div>
        <Instructions
          me={this.props.me}
          phase={this.props.phase}
          zpy={this.props.zpy}
          onEnter={this.onSubmit}
        />
        {this.renderHand()}
      </DragDropContext>
    );
  }
}

///////////////////////////////////////////////////////////////////////////////

/*
 * make a record mapping card id to a constant `val`
 */
function id_to_cns<T>(cards: CardID[], val: T): Record<string, T> {
  return Object.fromEntries(cards.map(card => [card.id, val]))
}

/*
 * make a record mapping card id to its position in `cards`
 */
function id_to_pos(cards: CardID[]): Record<string, number> {
  return Object.fromEntries(cards.map((card, i) => [card.id, i]));
}

/*
 * make a venn diagram of `left` and `right`
 *
 * for duplicate cards, we choose arbitrary ids for that card from `right`
 */
function card_delta(
  left: Iterable<CardBase>,
  right: Iterable<CardID>,
  tr: TrumpMeta,
): {
  both: CardID[],
  left: CardBase[],
  right: CardID[],
} {
  const left_pile = new CardPile(left, tr);

  const result = {
    both: [] as CardID[],
    left: [] as CardBase[],
    right: [] as CardID[]
  };

  for (const c of right) {
    if (left_pile.count(c.cb) > 0) {
      // c is in the intersection
      result.both.push(c);
      left_pile.remove(c.cb);
    } else {
      // c is only in `right`
      result.right.push(c);
    }
  }
  for (const cb of left_pile.gen_cards()) {
    result.left.push(cb);
  }
  return result;
}

///////////////////////////////////////////////////////////////////////////////

export namespace PlayArea {

type Area = {
  // card in sorted order; pos => id
  ordered: CardID[];
  // ordered position of each card; id => pos
  id_to_pos: Record<string, number>;
};

export type UserOptions = {
  auto_sort: boolean;
  auto_draw: boolean;
  auto_play: boolean;
  full_control: boolean;
};

export type Props = {
  me: P.User;
  phase: ZPY.Phase;
  zpy: ZPYEngine.ClientState;

  funcs: EngineCallbacks<any>;
};

export type State = {
  // all cards that have ever been a part of our hand.  we update this whenever
  // new cards are passed in through Props#hand or via an update.  correctness
  // relies on two facts:
  //
  //    1/ within a ZPY round, [...hand] strictly grows, then we update state
  //       at least once, then it strictly decreases
  //    2/ the lifetime of the PlayArea component does not outlast a round
  //
  // (1) holds by the rules of the game and the requirement that the player
  // submit "ready" before play begins.  (2) holds from our parent using the
  // round as our key.
  seen: CardID[];

  // set of all card ids currently in this PlayArea
  id_set: Set<string>;
  // card areas; 0 is the Hand, [1:] are the action areas
  areas: Area[];
  // map from card id to enclosing droppable area id
  id_to_area: Record<string, number>;

  // currently selected card ids
  selected: Set<string>;
  // last card id to start being selected
  prev_start: null | string;
  // last card id to end a shift-select range
  prev_stop: null | string;
  // multidrag metadata
  multidrag: null | {
    // card being dragged
    id: string;
    // list of all cards in the pile
    pile: CardBase[];
  };

  // local config update state
  config: ConfigArea.T;
  // selected card is in the friend selector
  fr_select: Record<string, [CardBase, number]>[];

  // is there an action pending?
  action_pending: boolean;
  // pending cards for removal; see onPlayEffect()
  pending_cards: CardID[];
} & UserOptions;

}
