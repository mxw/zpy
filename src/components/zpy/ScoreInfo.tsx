/*
 * all score metadata, including ranks and points
 */
import * as React from 'react'

import * as P from 'protocol/protocol'

import { Rank, rank_to_string } from 'lib/zpy/cards'
import { ZPY } from 'lib/zpy/zpy'
import { State as Z } from 'lib/zpy/engine'

import { Editable } from 'components/common/Editable'
import { EngineCallbacks } from 'components/zpy/common'
import { Card } from 'components/zpy/Card'

import assert from 'utils/assert'


const card_width = 48;
const clip_pct = 0.25;

export class ScoreInfo extends React.Component<
  ScoreInfo.Props,
  ScoreInfo.State
> {
  constructor(props: ScoreInfo.Props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);

    this.state = {rank: props.rank_meta.rank}
  }

  /////////////////////////////////////////////////////////////////////////////

  componentDidUpdate() {
    if (this.props.phase === ZPY.Phase.DRAW &&
        this.state.rank !== this.props.rank_meta.rank) {
      this.setState({rank: this.props.rank_meta.rank});
    }
  }

  rank(): Rank {
    return this.props.me.id === this.props.user.id
      ? this.state.rank
      : this.props.rank_meta.rank;
  }

  renderRankValue() {
    if (
      this.props.me.id !== this.props.user.id || (
        this.props.phase !== ZPY.Phase.INIT &&
        this.props.phase !== ZPY.Phase.WAIT
      )
    ) {
      return <div className="rank-value">
        {rank_to_string(this.rank())}
      </div>;
    }
    return <Editable
      init={rank_to_string(this.rank())}
      className="rank-value"
      onSubmit={this.onSubmit}
    />;
  }

  onSubmit(rank_str: string): string {
    rank_str = rank_str.trim().toUpperCase();

    const rank = ((): Rank => {
      switch (rank_str) {
        case '1': return Rank.A;

        case '2': case '3': case '4':
        case '5': case '6': case '7':
        case '8': case '9': case '10':
          return parseInt(rank_str);

        case 'j': case 'J': return Rank.J;
        case 'q': case 'Q': return Rank.Q;
        case 'k': case 'K': return Rank.K;
        case 'a': case 'A': return Rank.A;
        case 'w': case 'W': return Rank.B;

        default: break;
      }
      return null;
    })();
    if (rank === null) return rank_to_string(this.rank());

    this.props.funcs.attempt(
      {kind: 'set_rank', args: [this.props.me.id, rank]},
      null, null
    );
    this.setState({rank});
    return rank_str;
  }

  /////////////////////////////////////////////////////////////////////////////

  renderRank() {
    const r = this.props.rank_meta;

    return <div className="rank">
      <div>
        rank:&nbsp;{this.renderRankValue()}
      </div>
      <div>
        last host: {r.last_host !== null ? rank_to_string(r.last_host) : "∅"}
      </div>
    </div>;
  }

  renderPoints() {
    if (this.props.phase === ZPY.Phase.INIT ||
        this.props.points === null) {
      return null;
    }
    const total = !this.props.hide_pts
      ? this.props.points.reduce((total, cb) => total + cb.point_value(), 0)
      : '?';

    return <div
      className="points"
      aria-label={`${total} points`}
      data-balloon-pos="up"
    >
      {[5, 10, Rank.K].map(rank => {
        const points = this.props.points.filter(cb => cb.rank === rank);
        if (points.length === 0) return null;

        return <div
          className="point-column"
          key={'' + rank}
        >
          {this.props.hide_pts ? null : points.map(
            (cb, i) => <Card
              key={'' + i}
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
  me: P.User;
  phase: ZPY.Phase;
  user: P.User;

  rank_meta: Z['ranks'][P.UserID];
  points: null | Z['points'][P.UserID];
  hide_pts: boolean;

  funcs: EngineCallbacks<any>;
};

export type State = {
  rank: Rank;
};

}
