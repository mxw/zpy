/*
 *
 */
import * as React from 'react'

import { CardBase, TrumpMeta, Suit, Rank, gen_deck } from 'lib/zpy/cards.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { Card } from 'components/zpy/Card.tsx'

import { strict as assert} from 'assert'


const card_width = 64;
const clip_pct = 0.25;

export class FriendSelector extends React.Component<FriendSelector.Props, {}> {
  constructor(props: FriendSelector.Props) {
    super(props);
  }

  render() {
    const deck = [...gen_deck()].filter(cb => (
      cb.rank !== Rank.S &&
      cb.rank !== Rank.B &&
      (cb.suit !== this.props.tr.suit || cb.rank !== this.props.tr.rank)
    ));

    return this.props.selected.map((selected, i) =>
      <div
        key={i}
        className="friend-selector-unit"
      >
        {deck.map(cb => {
          const key = cb.toString();
          return <Card
            key={key}
            card={cb}
            width={card_width}
            xclip={clip_pct}
            yclip={clip_pct}
            selected={key in selected}
          />;
        })}
      </div>
    );
  }
}

export namespace FriendSelector {

export type Props = {
  tr: TrumpMeta;
  selected: Record<string, [CardBase, number]>[];
  onSelect: (
    cb: CardBase,
    nth: number,
    ev: React.MouseEvent | React.TouchEvent
  ) => void;
};

}
