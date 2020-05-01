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

import * as P from 'protocol/protocol.ts'

import { TrumpMeta, CardBase, Card, CardPile } from 'lib/zpy/cards.ts'
import { Play, Flight } from 'lib/zpy/trick.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { CardID, EngineCallbacks } from 'components/zpy/common.ts'
import { CardImage } from 'components/zpy/CardImage.tsx'
import { card_width, CardArea, EmptyArea } from 'components/zpy/CardArea.tsx'
import { FriendSelector } from 'components/zpy/FriendSelector.tsx'
import { isWindows } from 'components/utils/platform.ts'

import { array_fill } from 'utils/array.ts'
import { plural } from 'utils/string.ts'

import { strict as assert} from 'assert'


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
    this.onClickDeck = this.onClickDeck.bind(this);

    // window event listeners
    this.onClickOut = this.onClickOut.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);

    // drag/drop/select handlers
    this.onSelect = this.onSelect.bind(this);
    this.onFriendSelect = this.onFriendSelect.bind(this);
    this.onDragStart = this.onDragStart.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);

    const {hand, kitty} = PlayArea.cardsForInit(
      this.props.me.id,
      this.props.zpy,
    );

    let state = PlayArea.withCardsAdded({
      seen: [],

      id_set: new Set(),
      areas: [{ordered: [], id_to_pos: {}}],
      id_to_area: {},

      selected: new Set(),
      prev_start: null,
      prev_stop: null,
      multidrag: null,

      fr_select: array_fill(this.props.zpy.ndecks, () => ({})),

      action_pending: false,
      pending_cards: [],
    }, hand, 0);

    if (kitty.length > 0) {
      // a host's kitty phase is the only time we add the kitty to our hand
      state.areas.push({ordered: [], id_to_pos: {}});
      state = PlayArea.withCardsAdded(state, kitty, 1);
    }
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

      fr_select: state.fr_select.map(fr => ({...fr})),

      action_pending: state.action_pending,
      pending_cards: [...state.pending_cards],
    }
  }

  /*
   * account for new/removed cards from a server reset
   */
  onReset(zpy: ZPYEngine.ClientState) {
    const {hand, kitty} = PlayArea.cardsForInit(this.props.me.id, zpy);

    this.setState((state, props) => {
      const all_cards = PlayArea.filter(state);

      const ingest = (input: Iterable<CardBase>, adx: number) => {
        const delta = card_delta(input, all_cards);
        if (delta.left.length > 0) {
          state = PlayArea.withCardsAdded(state, delta.left, adx);
        }
        if (delta.right.length > 0) {
          state = PlayArea.withCardsRemoved(state, props, delta.right);
        }
      };
      ingest(hand, 0);
      ingest(hand, 1);
      return state;
    });

  }

  /*
   * account for new/removed cards from a server update
   */
  onUpdate(effect: ZPYEngine.Effect) {
    const me = this.props.me.id;
    const zpy = this.props.zpy;

    switch (effect.kind) {
      case 'set_decks': {
        this.setState({
          fr_select: array_fill(zpy.ndecks, () => ({}))
        });
        break;
      }
      case 'install_host': {
        const kitty = effect.args[1];
        if (me === zpy.host && kitty.length > 0) {
          this.setState((state, props) =>
            PlayArea.withCardsAdded(state, kitty, 1)
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

  /*
   * pull the cards from `this.props.zpy` that we use for initialization
   */
  static cardsForInit(me: P.UserID, zpy: ZPYEngine.ClientState): {
    hand: Iterable<CardBase>,
    kitty: CardBase[],
  } {
    const hand: Iterable<CardBase> =
      me in zpy.hands ? zpy.hands[me].pile.gen_cards() :
      me in zpy.draws ? zpy.draws[me].gen_cards() : [];

    const kitty = (
      me === zpy.host &&
      zpy.kitty.length > 0 &&
      zpy.phase === ZPY.Phase.KITTY
    ) ? zpy.kitty : [];

    return {hand, kitty};
  }

  /*
   * return a copy of `state` with `to_add` added to area `adx`
   *
   * we treat `cards` as never-before-seen objects, and assign them id's
   */
  static withCardsAdded(
    state: PlayArea.State,
    to_add: Iterable<CardBase>,
    adx: number,
  ): PlayArea.State {
    assert(adx === 0 || adx === 1);

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
      const c = {cb, id: ('' + state.seen.length)};

      state.seen.push(c);
      state.id_set.add(c.id);
      state.areas[adx].id_to_pos[c.id] = state.areas[adx].ordered.length;
      state.areas[adx].ordered.push(c);
      state.id_to_area[c.id] = adx;
    }
    return state;
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

  submitStartGame(): boolean {
    return this.attempt({kind: 'start_game', args: [this.props.me.id]});
  }

  submitDrawCard(): boolean {
    return this.attempt(
      {kind: 'draw_card', args: [this.props.me.id]},
      (effect: ZPYEngine.Effect) => {
        if (effect.kind !== 'add_to_hand') {
          assert(false);
          return;
        }
        if (effect.args[0] !== this.props.me.id) return;

        this.setState((state, props) =>
          PlayArea.withCardsAdded(state, [effect.args[1]], 0)
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
    const fl = this.extractPlay()?.fl();
    if (!fl) return false;

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
    return this.attempt({kind: 'collect_trick', args: [this.props.me.id]});
  }

  submitFollowOrCollect(): boolean {
    if (this.props.zpy.trick_over()) {
      return this.submitCollectTrick();
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

  submitEndRound(): boolean {
    if (this.props.me.id !== this.props.zpy.host) return false;
    return this.attempt({kind: 'end_round', args: [this.props.me.id]});
  }

  submitNextRound(): boolean {
    if (this.props.me.id !== this.props.zpy.host) return false;
    return this.attempt({kind: 'next_round', args: [this.props.me.id]});
  }

  /*
   * yoink a play out of the staging area
   */
  extractPlay(): null | Play {
    const piles = this.state.areas.slice(1).map(
      area => Play.extract(area.ordered.map(c => c.cb), this.props.zpy.tr)
    );
    if (piles.length === 0) return null;

    if (piles.length === 1) {
      // XXX: if this is a guess, assume it's right
      return piles[0];
    }

    const components: Flight[] = piles
      .map(p => p.fl())
      .filter(fl => fl !== null);

    // no component can be a Toss
    if (components.length !== piles.length) return null;

    const v_suit = this.props.zpy.lead?.tractors[0].v_suit ??
                   components[0].v_suit;
    // all components must be the same suit
    if (!components.every(fl => fl.v_suit === v_suit)) return null;

    let singletons: null | Flight = null;

    for (let fl of components) {
      if (fl.tractors.length === 1) continue;

      // at most one component with > 1 tractor allowed
      if (singletons !== null) return null;
      singletons = fl;

      // that component must be all singletons
      if (fl.count !== fl.tractors.length) return null;
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
           effect.kind === 'follow_lead');

    if (effect.args[0] !== this.props.me.id) return;

    this.setState((state, props) => {
      if (effect.kind === 'lead_play' &&
          effect.args[1].tractors.length > 1) {
        // we're trying to fly something, so we need to defer the removal of
        // cards from our hand until the fly either passes or fails
        assert(state.pending_cards.length === 0);
        return {...state, pending_cards: to_rm};
      }
      return PlayArea.withCardsRemoved(state, props, to_rm)
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
      case ZPY.Phase.WAIT: return this.submitNextRound();
    }
    return false;
  }

  /////////////////////////////////////////////////////////////////////////////

  /*
   * intercepted keypresses:
   *
   *  {ctrl,cmd}-a: select all cards
   *  enter: perform an action (typically submitting staged cards)
   */
  onKeyDown(ev: React.KeyboardEvent | KeyboardEvent) {
    if (ev.defaultPrevented) return;

    const metaKey = isWindows() ? ev.ctrlKey : ev.metaKey;

    if (ev.key === 'a' && metaKey) {
      const ev_ = ev as (typeof ev & {preventPlayArea: boolean});
      if (ev_.preventPlayArea) return;

      ev.preventDefault();
      this.selectAll();
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
   * handler for click and touch events to trigger selection behavior
   */
  onSelect(id: string, ev: React.MouseEvent | React.TouchEvent) {
    // click is swallowed if a drag occurred
    if (ev.defaultPrevented) return;

    // left click only
    if ('button' in ev && ev.button !== 0) return;

    // synthetic events won't persist into the setState() callback
    const metaKey = isWindows() ? ev.ctrlKey : ev.metaKey;
    const {shiftKey} = ev;

    ev.preventDefault(); // bypass window handler

    this.setState((state, props): PlayArea.State => {
      assert(state.prev_start === null ||
             state.selected.has(state.prev_start));

      if (state.prev_start === null || metaKey) {
        // either an initial selection or a continued selection
        let selected = new Set(state.selected);
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
        let selected = new Set(state.selected);

        const range_for = (prev_id: string) => {
          let prev_pos = area.id_to_pos[prev_id];
          return [Math.min(pos, prev_pos), Math.max(pos, prev_pos)];
        };

        if (state.prev_stop !== null) {
          let [first, last] = range_for(state.prev_stop);
          for (let o = first; o <= last; ++o) {
            selected.delete(area.ordered[o].id);
          }
        }
        let [first, last] = range_for(state.prev_start);
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

      return (state.selected.size === 1 && state.selected.has(id)
        // only this card selected; toggle selection
        ? {...state, selected: new Set(), prev_start: null}
        // fresh selection; override existing selection with this card
        : {...state, selected: new Set([id]), prev_start: id}
      );
    });
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
      let pile = PlayArea
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

    this.setState((state, props): PlayArea.State => {
      const multidrag_id = state.multidrag?.id ?? null;
      state = {...state, multidrag: null};

      const src_adx = parseInt(src.droppableId);
      const dst_adx = parseInt(dst.droppableId);

      if (dst_adx === state.areas.length) {
        // user dragged into the "next area" area OR into a bid/kitty area that
        // we don't have set up in `state`; instantiate it here
        state = {
          ...state,
          areas: [...state.areas, {ordered: [], id_to_pos: {}}],
        };
      }

      const src_area = state.areas[src_adx];
      const dst_area = state.areas[dst_adx];

      const src_id = src_area.ordered[src.index].id;

      const is_dragging = (card: CardID): boolean => {
        return state.selected.size !== 0
          ? state.selected.has(card.id)
          : card.id === src_id;
      };
      const is_not_dragging = (card: CardID): boolean => !is_dragging(card);

      // count the number of cards that remain before dst.index once we move
      // all the dragging cards out of the way
      let dst_index = Math.min(
        dst_area.ordered.reduce((n, card, i) => {
          if (i > dst.index) return n;

          const skip = (true || multidrag_id === null) // [multidrag policy]
            ? is_dragging(card)
            : card.id === multidrag_id;

          return skip ? n : n + 1;
        }, 0),
        dst.index
      );

      const not_dragging = [...dst_area.ordered].filter(is_not_dragging);

      const dst_ordered = [
        ...not_dragging.slice(0, dst_index),
        ...PlayArea.filter(state, is_dragging),
        ...not_dragging.slice(dst_index),
      ];

      const selected = state.selected.size !== 0
        ? [...state.selected]
        : [src_id];
      const affected_areas = new Set(selected.map(id => state.id_to_area[id]));

      return PlayArea.validate(PlayArea.reapAreas({
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
    });
  };

  /////////////////////////////////////////////////////////////////////////////

  selectAll() {
    this.setState((state, props) => ({
      selected: new Set(state.id_set),
    }));
  }

  deselectAll() {
    this.setState({
      selected: new Set(),
      prev_start: null,
      prev_stop: null,
    });
  }

  sortHand() {
    const tr = this.props.zpy.tr;
    if (tr === null) return;

    this.setState((state, props) => {
      const sorted = [...state.areas[0].ordered].sort((l, r) => {
        const ll = Card.from(l.cb, tr);
        const rr = Card.from(r.cb, tr);
        return Card.compare(ll, rr) ?? Math.sign(ll.v_suit - rr.v_suit);
      });
      return {areas: [
        {
          ordered: sorted,
          id_to_pos: id_to_pos(sorted),
        },
        ...state.areas.slice(1)
      ]};
    });
  }

  resetPlays() {
    if (this.state.areas.length === 1) return;
    if (this.state.id_set.size === this.state.areas[0].ordered.length) return;

    this.setState((state, props) => {
      const play_areas = state.areas.slice(1);

      const hand_ordered = state.areas[0].ordered.concat(
        ...play_areas.map(area => area.ordered)
      );
      return PlayArea.reapAreas({
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
    });
  }

  /////////////////////////////////////////////////////////////////////////////

  renderSingletonStagingArea() {
    return <CardArea
      droppableId="1"
      cards={this.state.areas[1]?.ordered ?? []}
      selected={this.state.selected}
      multidrag={this.state.multidrag}
      onSelect={this.onSelect}
    />;
  }

  onClickDeck(ev: React.MouseEvent | React.TouchEvent) {
    if (ev.defaultPrevented) return;
    if ('button' in ev && ev.button !== 0) return;

    ev.preventDefault();
    this.submitDrawCard();
  }

  renderDrawArea() {
    return <div className="action draw">
      <div className="deck">
        <CardImage
          card="back"
          width={card_width}
          onClick={this.onClickDeck}
        />
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

  static isStagingAreaVariadic(props: PlayArea.Props) {
    return props.phase === ZPY.Phase.LEAD ||
           props.phase === ZPY.Phase.FOLLOW;
  }

  renderStagingArea() {
    if (!PlayArea.isStagingAreaVariadic(this.props)) {
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
          onSelect={this.onSelect}
        />
      })}
      <EmptyArea
        key={this.state.areas.length}
        droppableId={'' + this.state.areas.length}
      />
    </div>
  }

  renderActionArea() {
    const component = (() => {
      switch (this.props.phase) {
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
        default: break;
      }
      return null;
    })();
    return component ?? (<div className="action"></div>);
  }

  renderInstructionArea() {
    const me = this.props.me.id;
    const zpy = this.props.zpy;

    const enter = <kbd>↵ Enter</kbd>;

    const is_active = (() => {
      switch (this.props.phase) {
        case ZPY.Phase.INIT: return (
          me === zpy.owner &&
          zpy.players.length >= ZPY.min_players
        );
        case ZPY.Phase.DRAW: return true;
        case ZPY.Phase.PREPARE: return !zpy.consensus.has(me);
        case ZPY.Phase.KITTY: return me === zpy.host;
        case ZPY.Phase.FRIEND: return me === zpy.host;
        case ZPY.Phase.LEAD: return me === zpy.leader;
        case ZPY.Phase.FLY: return !zpy.consensus.has(me);
        case ZPY.Phase.FOLLOW: return zpy.current !== null
          ? me === zpy.players[zpy.current]
          : me === zpy.winning;
        case ZPY.Phase.FINISH: return me === zpy.host;
        case ZPY.Phase.WAIT: return me === zpy.host;
      }
      assert(false);
      return false;
    })();

    if (!is_active) {
      const text = (() => {
        switch (this.props.phase) {
          case ZPY.Phase.INIT: return me === zpy.owner
            ? <>gather at least {ZPY.min_players} players</>
            : <>waiting for the game to start</>;
          case ZPY.Phase.DRAW:
            return null;
          case ZPY.Phase.PREPARE:
            return <>waiting for everyone to be ready</>;
          case ZPY.Phase.KITTY:
            return <>waiting for the host to discard a kitty</>;
          case ZPY.Phase.FRIEND:
            return <>waiting for the host to call friends</>;
          case ZPY.Phase.LEAD:
            return <>waiting for the trick leader to play</>;
          case ZPY.Phase.FLY:
            return <>waiting on others to see if the play flies</>;
          case ZPY.Phase.FOLLOW: return zpy.current !== null
            ? <>waiting for the next player to play</>
            : <>waiting for the winner to collect the trick</>;
          case ZPY.Phase.FINISH:
            return <>waiting for the host to reveal the kitty</>;
          case ZPY.Phase.WAIT:
            return <>waiting for the host to start the round</>;
        }
        return null;
      })();
      return <div className="instructions inactive">{text}</div>;
    }

    const text = (() => {
      switch (this.props.phase) {
        case ZPY.Phase.INIT:
          return <>press {enter} to start the game</>;
        case ZPY.Phase.DRAW:
          return <>
            click the deck to draw;
            drag cards above and press {enter} to submit a trump bid
          </>;
        case ZPY.Phase.PREPARE:
          return <>
            press {enter} to indicate you are ready,
            or drag cards above first to submit a trump bid.
          </>;
        case ZPY.Phase.KITTY:
          return <>
            take the kitty above, then put back that many cards;
            press {enter} to submit
          </>;
        case ZPY.Phase.FRIEND:
          return <>
            select {zpy.nfriends} friend{plural(zpy.nfriends)} and
            press {enter} to submit
          </>;
        case ZPY.Phase.LEAD:
          return <>
            drag cards above and press {enter} to submit your lead.
            make separate piles to have full control of an ambiguous fly.
          </>;
        case ZPY.Phase.FLY:
          return <>
            press {enter} if the play flies;
            or drag a card, tuple, or tractor above
            and press {enter} to contest the play
          </>;
        case ZPY.Phase.FOLLOW: return zpy.current !== null
          ? <>
              drag cards above and press {enter} to submit your play.
              place cards in separate piles for full control of your play.
            </>
          : <>you won the trick; press {enter} to collect it</>;
        case ZPY.Phase.FINISH:
          return <>press {enter} to reveal the kitty and end the round.</>;
        case ZPY.Phase.WAIT:
          return <>press {enter} to start the next round.</>;
      }
      return null;
    })();
    if (text === null) return null;

    return <div className="instructions active">{text}</div>;
  }

  renderHand() {
    return <div className="hand">
      <CardArea
        droppableId="0"
        cards={this.state.areas[0].ordered}
        selected={this.state.selected}
        multidrag={this.state.multidrag}
        onSelect={this.onSelect}
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
        {this.renderActionArea()}
        {this.renderInstructionArea()}
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
  tr?: TrumpMeta,
): {
  both: CardID[],
  left: CardBase[],
  right: CardID[],
} {
  const left_pile = new CardPile(left, tr ?? TrumpMeta.def());

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

export type Props = {
  me: P.User;
  phase: ZPY.Phase;
  zpy: ZPYEngine.ClientState;

  funcs: EngineCallbacks<any>;
};

export type State = {
  // all cards that have ever been a part of our hand.  we update this whenever
  // new cards are passed in through Props#hand or Props#kitty.  correctness
  // relies on two facts:
  //
  //    1/ within a ZPY round, [...hand, ...kitty] strictly grows, then we
  //       update state at least once, then it strictly decreases
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

  fr_select: Record<string, [CardBase, number]>[];

  // is there an action pending?
  action_pending: boolean;
  // pending cards for removal; see onPlayEffect()
  pending_cards: CardID[];
};

}
