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

import { CardBase, TrumpMeta } from 'lib/zpy/cards.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { CardID, EngineCallbacks } from 'components/zpy/common.ts'
import { CardImage } from 'components/zpy/CardImage.tsx'
import { card_width, CardArea, EmptyArea } from 'components/zpy/CardArea.tsx'
import { isWindows } from 'components/utils/platform.ts'

import { strict as assert} from 'assert'


function reorder<T>(arr: T[], src: number, dst: number): T[] {
  const result = [...arr];
  const [removed] = result.splice(src, 1);
  result.splice(dst, 0, removed);
  return result;
}

export class PlayArea extends React.Component<
  PlayArea.Props,
  PlayArea.State
> {
  constructor(props: PlayArea.Props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onEffect = this.onEffect.bind(this);
    this.onClickDeck = this.onClickDeck.bind(this);

    this.onClickOut = this.onClickOut.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);

    this.onSelect = this.onSelect.bind(this);
    this.onDragStart = this.onDragStart.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);

    let state = PlayArea.withCardsAdded({
      seen: [],
      id_set: new Set(),
      areas: [{ordered: [], id_to_pos: {}}],
      id_to_area: {},
      selected: new Set(),
      prev_start: null,
      prev_stop: null,
      multidrag: null,
      action: {
        pending: false,
      },
    }, props.hand, 0);

    if (props.kitty !== null) {
      state.areas.push({ordered: [], id_to_pos: {}});
      state = PlayArea.withCardsAdded(state, props.kitty, 1);
    }
    this.state = PlayArea.validate(state);
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
      selected: new Set(...state.selected),
      prev_start: state.prev_start,
      prev_stop: state.prev_stop,
      multidrag: state.multidrag,
      action: {...state.action},
    }
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
    state = PlayArea.copyState(state);

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
    if (!PlayArea.isStagingAreaVariadic(props)) return state;

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
    this.props.funcs.attempt(
      {kind: 'start_game', args: [this.props.me.id]},
      this.onEffect, this.onEffect
    );
    return true;
  }

  onClickDeck(ev: React.MouseEvent | React.TouchEvent) {
    if (ev.defaultPrevented) return;
    if ('button' in ev && ev.button !== 0) return;

    this.props.funcs.attempt(
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
        this.onEffect();
      },
      this.onEffect
    );
  }

  submitBidTrump(): boolean {
    const cards = this.state.areas[1].ordered;
    console.log(cards);
    if (cards.length === 0) return false;

    const cb = cards[0].cb;
    if (!cards.every(c => CardBase.same(c.cb, cb))) return false;

    this.props.funcs.attempt(
      {kind: 'bid_trump', args: [this.props.me.id, cb, cards.length]},
      this.onEffect, this.onEffect
    );
    return true;
  }

  /*
   * shared logic around an attempt completing
   */
  onEffect(_?: any) {
    this.setState({action: {pending: false}});
  }

  /*
   * attempt a context-dependent action, returning whether or not we did
   * anything at all (even if we failed)
   */
  onSubmit(): boolean {
    if (this.state.action.pending) return false;

    switch (this.props.phase) {
      case ZPY.Phase.INIT: return this.submitStartGame();
      case ZPY.Phase.DRAW: return this.submitBidTrump();
      case ZPY.Phase.PREPARE:
        break;
      case ZPY.Phase.KITTY:
        break;
      case ZPY.Phase.FRIEND:
        break;
      case ZPY.Phase.LEAD:
        break;
      case ZPY.Phase.FLY:
        break;
      case ZPY.Phase.FOLLOW:
        break;
      case ZPY.Phase.FINISH:
        break;
      case ZPY.Phase.WAIT:
        break;
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
    const metaKey = isWindows() ? ev.ctrlKey : ev.metaKey;

    if (ev.key === 'a') {
      ev.preventDefault();
      this.selectAll();
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
      const multidrag_id = state.multidrag?.id;
      state = {...state, multidrag: null};

      const src_adx = parseInt(src.droppableId);
      const dst_adx = parseInt(dst.droppableId);

      if (dst_adx === state.areas.length) {
        // user dragged into the "new area" area; instantiate it
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

  selectAll() {
    this.setState((state, props) => {
      return {selected: new Set(state.id_set)};
    });
  }

  deselectAll() {
    this.setState({
      selected: new Set(),
      prev_start: null,
      prev_stop: null,
    });
  }

  /////////////////////////////////////////////////////////////////////////////

  renderDrawArea(state: PlayArea.State) {
    return <div className="action draw">
      <div className="deck">
        <CardImage
          card="back"
          width={card_width}
          onClick={this.onClickDeck}
        />
      </div>
      <div className="bids">
        <CardArea
          droppableId="1"
          cards={state.areas?.[1]?.ordered ?? []}
          selected={state.selected}
          multidrag={state.multidrag}
          onSelect={this.onSelect}
        />
      </div>
    </div>;
  }

  renderFriendArea(state: PlayArea.State) {
    return <div className="action friend">
    </div>;
  }

  static isStagingAreaVariadic(props: PlayArea.Props) {
    return props.phase === ZPY.Phase.LEAD ||
           props.phase === ZPY.Phase.FOLLOW;
  }

  renderNextArea(state: PlayArea.State) {
    if (!PlayArea.isStagingAreaVariadic(this.props)) return null;
    return <EmptyArea
      key={this.state.areas.length}
      droppableId={'' + this.state.areas.length}
    />;
  }

  renderStagingArea(state: PlayArea.State) {
    return <div className="action staging">
      {this.state.areas.map((area, adx) => {
        if (adx === 0) return null;
        return <CardArea
          key={adx}
          droppableId={'' + adx}
          cards={state.areas[adx].ordered}
          selected={state.selected}
          multidrag={state.multidrag}
          onSelect={this.onSelect}
        />
      })}
      {this.renderNextArea(state)}
    </div>
  }

  renderActionArea(state: PlayArea.State) {
    switch (this.props.phase) {
      case ZPY.Phase.DRAW:
      case ZPY.Phase.PREPARE:
        return this.renderDrawArea(state);
      case ZPY.Phase.FRIEND:
        return this.renderFriendArea(state);
      case ZPY.Phase.KITTY:
      case ZPY.Phase.LEAD:
      case ZPY.Phase.FLY:
      case ZPY.Phase.FOLLOW:
        return this.renderStagingArea(state);
      default: break;
    }
    return null;
  }

  render() {
    return (
      <DragDropContext
        onDragStart={this.onDragStart}
        onDragEnd={this.onDragEnd}
      >
        {this.renderActionArea(this.state)}
        <div className="hand">
          <CardArea
            droppableId="0"
            cards={this.state.areas[0].ordered}
            selected={this.state.selected}
            multidrag={this.state.multidrag}
            onSelect={this.onSelect}
          />
        </div>
      </DragDropContext>
    );
  }
}

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
  tr: null | TrumpMeta;

  // initial hand and kitty
  hand: Iterable<CardBase>;
  kitty: null | CardBase[];

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

  // player action-related metadata
  action: {
    // is there an action pending?
    pending: boolean;
  };
};

}
