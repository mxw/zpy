import * as React from "react"
import {
  DragDropContext,
  Draggable, DraggableProvided, DraggableStateSnapshot,
  Droppable, DroppableProvided, DroppableStateSnapshot,
  DragStart, DropResult,
} from 'react-beautiful-dnd'

import { CardBase } from 'lib/zpy/cards.ts'

import { ZHand } from "components/zpy/Hand.tsx"
import { isWindows } from "components/utils/platform.ts"

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
      ordered: [...this.props.cards],
      id_to_order: Object.fromEntries(
        this.props.cards.map((card, i) => [card.id, i])
      ),
      selected: new Set(),
      prev_start: null,
      prev_stop: null,
    };
  }

  componentDidMount() {
    window.addEventListener('click', this.onClickOut.bind(this));
    window.addEventListener('touchend', this.onClickOut.bind(this));
  }

  /*
   * handler for click and touch events to trigger selection behavior
   */
  onSelect(id: string, pos: number, ev: React.MouseEvent | React.TouchEvent) {
    // click is swallowed if a drag occurred
    if (ev.defaultPrevented) return;

    // left click only
    if ('button' in ev && ev.button !== 0) return;

    // synthetic events won't persist into the setState() callback
    const metaKey = isWindows() ? ev.ctrlKey : ev.metaKey;
    const {shiftKey} = ev;

    ev.preventDefault(); // bypass window handler

    this.setState((state, props): any => {
      assert(state.prev_start === null ||
             state.selected.has(state.prev_start));

      if (state.prev_start === null || metaKey) {
        // either an initial selection or a continued selection
        let selected = new Set(state.selected);
        return (selected.delete(id) // true if deletion occured
          ? {selected, prev_start: null}
          : {selected: selected.add(id), prev_start: id}
        );
      }

      if (shiftKey) {
        // range selection
        let selected = new Set(state.selected);

        const range_for = (prev_id: string) => {
          let prev_pos = state.id_to_order[prev_id];
          return [Math.min(pos, prev_pos), Math.max(pos, prev_pos)];
        };

        if (state.prev_stop !== null) {
          let [first, last] = range_for(state.prev_stop);
          for (let o = first; o <= last; ++o) {
            selected.delete(state.ordered[o].id);
          }
        }
        let [first, last] = range_for(state.prev_start);
        for (let o = first; o <= last; ++o) {
          selected.add(state.ordered[o].id);
        }
        return {
          selected,
          prev_start: state.prev_start,
          prev_stop: id,
        };
      }

      return (state.selected.size === 1 && state.selected.has(id)
        // only this card selected; toggle selection
        ? {selected: new Set(), prev_start: null}
        // fresh selection; override existing selection with this card
        : {selected: new Set([id]), prev_start: id}
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
  }

  onDragEnd(result: DropResult) {
    const { source: src, destination: dst } = result;
    if (!dst || result.reason === 'CANCEL') return;

    this.setState((state, props) => {
      //if (src.droppableId === dst.droppableId) {
        const ordered = reorder(state.ordered, src.index, dst.index);
        return {
          ordered,
          id_to_order: Object.fromEntries(
            ordered.map((card, i) => [card.id, i])
          ),
        }
      //}
    });
  };

  deselectAll() {
    this.setState({
      selected: new Set(),
      prev_start: null,
    });
  }

  render() {
    return <DragDropContext
      onDragEnd={this.onDragEnd.bind(this)}
    >
      <ZHand
        droppableId="hand"
        cards={[
          ...this.state.ordered,
          ...this.props.cards.slice(this.state.ordered.length)
        ]}
        selected={this.state.selected}
        onSelect={this.onSelect.bind(this)}
      />
    </DragDropContext>;
  }
}

export namespace PlayArea {

export type Props = {
  cards: {cb: CardBase, id: string}[];
};

export type State = {
  // card in sorted order; pos => id
  ordered: {cb: CardBase, id: string}[];
  // ordered position of each card; id => pos
  id_to_order: Record<string, number>;
  // currently selected card ids
  selected: Set<string>;
  // last card id to start being selected
  prev_start: null | string;
  // last card id to end a shift-select range
  prev_stop: null | string;
};

}
