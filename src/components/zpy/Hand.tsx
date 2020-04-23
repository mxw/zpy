import * as React from "react"

import { CardBase, Card, Suit, Rank } from 'lib/zpy/cards.ts'

import { ZCard } from "components/zpy/Card.tsx"

import { strict as assert} from 'assert'


export class ZHand extends React.Component<ZHand.Props, ZHand.State> {
  constructor(props: ZHand.Props) {
    super(props);
    this.state = this.new_state();
  }

  private new_state(): ZHand.State {
    return {
      order_to_id: this.props.cards.map((_, i: number) => i),
      id_to_order: this.props.cards.map((_, i: number) => i),
      selected: new Set(),
      last_start: -1,
    };
  }

  private fixup_state(): ZHand.State {
    let n = this.state.order_to_id.length;
    assert(n === this.state.id_to_order.length);

    if (this.props.cards.length === n) {
      return this.state;
    }
    if (this.props.cards.length < n) {
      // this should never happen
      return this.new_state();
    }
    return {
      ...this.state,
      order_to_id: this.props.cards.map(
        (_, i) => i < this.state.order_to_id.length
          ? this.state.order_to_id[i] : i
      ),
      id_to_order: this.props.cards.map(
        (_, i) => i < this.state.id_to_order.length
          ? this.state.id_to_order[i] : i
      ),
    };
  }

  /*
   * select or deselect a card (or range of cards).
   */
  onClick(idx: number, odx: number, ev: MouseEvent) {
    if (this.state.id_to_order[idx] !== odx) {
      // the card was moved; don't toggle selection
      return;
    }
    // synthetic events won't persist into the setState() callback
    let {metaKey, shiftKey} = ev;

    this.setState((state, props): any => {
      assert(state.last_start === -1 ||
             state.selected.has(state.last_start));

      if (state.last_start === -1 || metaKey) {
        // either an initial selection or a continued selection
        let selected = new Set(state.selected);
        if (selected.has(idx)) {
          selected.delete(idx)
          return {selected, last_start: -1};
        }
        selected.add(idx);
        return {selected, last_start: idx};
      }

      if (!shiftKey) {
        return (state.selected.size === 1 && state.selected.has(idx)
          // only this card selected; toggle selection
          ? {selected: new Set(), last_start: -1}
          // fresh selection; override existing selection with this card
          : {selected: new Set([idx]), last_start: idx}
        );
      }
      // range selection
      let last_odx = state.id_to_order[state.last_start];
      let first = Math.min(odx, last_odx);
      let last = Math.max(odx, last_odx);

      let selected = new Set(state.selected);

      for (let o = first; o <= last; ++o) {
        selected.add(state.order_to_id[o]);
      }
      return {selected};
    });
  }

  render() {
    return <div
      style={{position: 'relative'}}
    >
      {this.props.cards.map(
        (card, idx) => card === null ? null : <ZCard
          key={idx}
          card={card}
          width={100}
          x={40 + idx * 20}
          y={40}
          position={'absolute'}
          selected={this.state.selected.has(idx)}
          onClick={
            this.onClick.bind(this, idx, this.state.id_to_order[idx] ?? idx)
          }
        />
      ).filter(zc => zc !== null)}
    </div>;
  }
}

export namespace ZHand {

export type Props = {
  // for each round, cards are identified by their insertion order
  cards: (null | CardBase)[];
};

export type State = {
  // insertion ids in user-sorted order; odx => idx
  order_to_id: number[];
  // ordered position of each card; idx => odx
  id_to_order: number[];
  // currently selected card ids
  selected: Set<number>;
  // last card id to start being selected; -1 for none
  last_start: number;
};

}
