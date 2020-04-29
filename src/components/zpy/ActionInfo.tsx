/*
 * display for players' game actions: bids, plays, and readys
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { TrumpMeta, CardBase } from 'lib/zpy/cards.ts'
import { Card, Suit, Rank } from 'lib/zpy/cards.ts'
import { Play, Flight, Toss, Tractor } from 'lib/zpy/trick.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import { State as Z } from 'lib/zpy/engine.ts'

import { CardFan } from 'components/zpy/CardFan.tsx'

import { array_fill } from 'utils/array.ts'

import { strict as assert} from 'assert'


const card_width = 64;
const clip_pct = 0.25;

export class ActionInfo extends React.Component<ActionInfo.Props> {
  constructor(props: ActionInfo.Props) {
    super(props);
  }

  renderFan(key: string, cards: CardBase[]) {
    return <CardFan
      width={card_width}
      xclip={clip_pct}
      yclip={clip_pct}
      pile={cards}
    />;
  }

  renderBid() {
    if (this.props.phase < ZPY.Phase.DRAW ||
        this.props.phase > ZPY.Phase.PREPARE) {
      return null;
    }
    if (this.props.bids.length === 0) return null;

    const bid = this.props.bids[this.props.bids.length - 1];
    return <CardFan
      width={card_width}
      xclip={clip_pct}
      pile={array_fill(bid.n, bid.card)}
    />;
  }

  renderPlay() {
    if (this.props.phase < ZPY.Phase.LEAD ||
        this.props.phase > ZPY.Phase.FINISH) {
      return null;
    }
    const play = this.props.play;
    if (play === null) return null;

    const tr = this.props.tr;
    assert(tr !== null);

    const ts = play.ts();

    if (ts !== null) {
      return <CardFan
        width={card_width}
        xclip={clip_pct}
        pile={[...ts.gen_cards(tr)]}
      />;
    }
    const fl = play.fl();

    const tractors = fl.tractors
      .filter((t: Tractor) => t.count > 1)
      .map((t: Tractor, i: number) =>
        <CardFan
          key={'' + i}
          width={card_width}
          xclip={clip_pct}
          yclip={i === 0 ? 1 : clip_pct}
          pile={[...t.gen_cards(tr)]}
        />
      );

    const singles = fl.tractors
      .filter((t: Tractor) => t.count === 1)
      .map((t: Tractor) => t.card);

    if (singles.length > 0) {
      tractors.push(
        <CardFan
          key="singles"
          width={card_width}
          xclip={clip_pct * 1.5}
          yclip={tractors.length === 0 ? 1 : clip_pct * 1.5}
          pile={singles}
        />
      );
    }
    return tractors.reverse();
  }

  render() {
    return <div className="action-info">
      {this.renderBid()}
      {this.renderPlay()}
    </div>;
  }
}

export namespace ActionInfo {

export type Props = {
  phase: ZPY.Phase;
  user: P.User;

  tr: null | TrumpMeta;
  bids: Z['bids'];
  play: null | Z['plays'][P.UserID];

  ready: boolean;
  leader: boolean;
  winning: boolean;
};

}
