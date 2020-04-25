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

import { CardBase } from 'lib/zpy/cards.ts'

import { CardID } from 'components/zpy/common.ts'
import { CardArea, NextArea } from 'components/zpy/CardArea.tsx'
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

    this.state = {
      id_set: new Set(this.props.cards.map(card => card.id)),
      areas: [{
        ordered: [...this.props.cards],
        id_to_pos: id_to_pos(this.props.cards),
      }],
      id_to_area: id_to_cns(this.props.cards, 0),
      selected: new Set(),
      prev_start: null,
      prev_stop: null,
      multidrag: null,
    };

    this.onSelect = this.onSelect.bind(this);
    this.onDragStart = this.onDragStart.bind(this);
    this.onDragEnd = this.onDragEnd.bind(this);
  }

  componentDidMount() {
    window.addEventListener('click', this.onClickOut.bind(this));
    window.addEventListener('touchend', this.onClickOut.bind(this));
  }

  /////////////////////////////////////////////////////////////////////////////

  /*
   * make a deep copy of `state`
   */
  static copyState(state: PlayArea.State): PlayArea.State {
    return {
      id_set: new Set(...state.id_set),
      areas: state.areas.map(({ordered, id_to_pos}) => ({
        ordered: [...ordered],
        id_to_pos: {...id_to_pos},
      })),
      id_to_area: {...state.id_to_area},
      selected: new Set(...state.selected),
      prev_start: state.prev_start,
      prev_stop: state.prev_stop,
      multidrag: state.multidrag,
    }
  }

  /*
   * whether `state` is up-to-date for `props`
   */
  static checkSync(
    state: PlayArea.State,
    props: PlayArea.Props
  ): boolean {
    return props.cards.length === state.id_set.size &&
           props.cards.every(card => state.id_set.has(card.id));
  }

  /*
   * return a new State from `state` and updated `props`
   */
  static updateForProps(
    state: PlayArea.State,
    props: PlayArea.Props
  ): PlayArea.State {
    if (PlayArea.checkSync(state, props)) return state;
    state = PlayArea.copyState(state);

    // new cards are easy; just stuff them at the end of the hand area
    for (let card of props.cards) {
      if (state.id_set.has(card.id)) continue;

      state.id_set.add(card.id);
      state.areas[0].ordered.push(card);
      state.areas[0].id_to_pos[card.id] = state.areas[0].ordered.length - 1;
      state.id_to_area[card.id] = 0;
    }

    const props_ids = new Set(props.cards.map(card => card.id));
    const removed_ids = new Set(
      [...state.id_set].filter(id => !props_ids.has(id))
    );
    if (removed_ids.size === 0) return state;

    for (let id of removed_ids) {
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
    for (let area of state.areas) {
      const prev_len = area.ordered.length;
      area.ordered = area.ordered.filter(card => !removed_ids.has(card.id));

      if (area.ordered.length !== prev_len) {
        area.id_to_pos = id_to_pos(area.ordered);
      }
    }
    //state.areas = state.areas.filter(area => area.ordered.length > 0);

    return state;
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
      state = PlayArea.updateForProps(state, props);

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
  onClickOut(ev: React.MouseEvent | React.TouchEvent) {
    if (ev.defaultPrevented) return;
    this.deselectAll();
  }

  onDragStart(start: DragStart) {
    if (!this.state.selected.has(start.draggableId)) {
      this.deselectAll();
    }
    if (PlayArea.checkSync(this.state, this.props) &&
        this.state.selected.size <= 1) {
      return;
    }
    // cards were added or removed, or we need to trigger multi-drag rendering
    this.setState((state, props): PlayArea.State => {
      let pile = PlayArea
        .filter(state, card => state.selected.has(card.id))
        .map(card => card.cb);

      return {
        ...PlayArea.updateForProps(state, props),
        multidrag: {id: start.draggableId, pile}
      };
    });
  }

  onDragEnd(result: DropResult) {
    const { source: src, destination: dst } = result;

    if (!dst || result.reason === 'CANCEL') {
      this.setState({multidrag: null});
      return;
    }

    this.setState((state, props): PlayArea.State => {
      state = PlayArea.updateForProps(state, props);

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

      return {
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
      };
    });
  };

  deselectAll() {
    this.setState({
      selected: new Set(),
      prev_start: null,
      prev_stop: null,
    });
  }

  render() {
    const state = PlayArea.updateForProps(this.state, this.props);

    return (
      <DragDropContext
        onDragStart={this.onDragStart}
        onDragEnd={this.onDragEnd}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'row',
          }}>
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
            <NextArea
              key={this.state.areas.length}
              droppableId={'' + this.state.areas.length}
            />
          </div>
          <CardArea
            droppableId="0"
            cards={state.areas[0].ordered}
            selected={state.selected}
            multidrag={state.multidrag}
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
  cards: CardID[];
};

export type State = {
  // set of all card ids managed by this PlayArea
  id_set: Set<string>;
  // card areas; 0 is the Hand, [1:] are the PlayPiles
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
};

}
