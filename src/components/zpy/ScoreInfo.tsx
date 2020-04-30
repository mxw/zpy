/*
 * all score metadata, including ranks and points
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { Rank, rank_to_string } from 'lib/zpy/cards.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import { State as Z } from 'lib/zpy/engine.ts'

import { Card } from 'components/zpy/Card.tsx'

import { strict as assert} from 'assert'


const card_width = 48;
const clip_pct = 0.25;

export class ScoreInfo extends React.Component<ScoreInfo.Props, {}> {
  constructor(props: ScoreInfo.Props) {
    super(props);
  }

  renderRank() {
    if (this.props.phase === ZPY.Phase.INIT) return null;

    const r = this.props.rank_meta;

    return <div className="rank">
      <div key="rank">
        rank: {rank_to_string(r.rank)}
      </div>
      <div key="last-host">
        last host: {r.last_host !== null ? rank_to_string(r.last_host) : "∅"}
      </div>
    </div>;
  }

  renderPoints() {
    if (this.props.phase === ZPY.Phase.INIT ||
        this.props.points === null) {
      return null;
    }

    return <div className="points">
      {[5, 10, Rank.K].map(rank => {
        const points = this.props.points.filter(cb => cb.rank === rank);
        if (points.length === 0) return null;

        return <div className="point-column">
          {points.map(
            cb => <Card
              card={cb}
              width={card_width}
              yclip={clip_pct}
            />
          )}
        </div>
      })}
    </div>;
  }

  render() {
    return <div className="score-info">
      {this.renderRank()}
      {this.renderPoints()}
    </div>;
  }
}

export namespace ScoreInfo {

export type Props = {
  phase: ZPY.Phase;
  user: P.User;

  rank_meta: Z['ranks'][P.UserID];
  points: null | Z['points'][P.UserID];
};

}
