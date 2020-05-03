/*
 * special action area for choosing friends
 *
 * renders as zpy.ndecks instances of a full deck's worth of cards (minus
 * illegal friend calls) piled on top of each other
 */
import * as React from 'react'

import { CardBase, TrumpMeta, Suit, Rank, gen_deck } from 'lib/zpy/cards.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { Card } from 'components/zpy/Card.tsx'

import { nth_suffixed } from 'utils/string.ts'

import assert from 'utils/assert.ts'


const card_width = 80;
const clip_pct = 0.25;

export class FriendSelector extends React.Component<FriendSelector.Props, {}> {
  constructor(props: FriendSelector.Props) {
    super(props);
  }

  render() {
    const deck = [...gen_deck()].filter(cb => (
      cb.rank !== Rank.S &&
      cb.rank !== Rank.B &&
      cb.rank !== this.props.tr.rank
    ));

    let classes = ["friend-selector-container"];
    if (this.props.tr.rank === Rank.B) classes.push("fsc-trump");

    return <div className={classes.join(' ')}>
      {this.props.selected.map((fr, i) =>
        <div
          key={'' + i}
          aria-label={`${nth_suffixed(i + 1)} played`}
          data-balloon-pos="left"
        >
          <div
            key={'' + i}
            className="friend-selector-unit"
          >
            {deck.map(cb => {
              const key = cb.toString();
              return <div
                key={key}
                onClick={ev => this.props.onSelect(cb, i, ev)}
              >
                <Card
                  card={cb}
                  width={card_width}
                  xclip={clip_pct}
                  yclip={clip_pct}
                  selected={key in fr}
                />
              </div>;
            })}
          </div>
        </div>
      )}
    </div>;
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
