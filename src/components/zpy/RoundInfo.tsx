/*
 * interactive play portion of the ZPY board
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { CardBase } from 'lib/zpy/cards.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import { State as Z } from 'lib/zpy/engine.ts'

import { ActionInfo } from 'components/zpy/ActionInfo.tsx'
import { PlayerInfo } from 'components/zpy/PlayerInfo.tsx'
import { ScoreInfo } from 'components/zpy/ScoreInfo.tsx'

import { strict as assert} from 'assert'


class Column extends React.Component<Column.Props, {}> {
  constructor(props: Column.Props) {
    super(props);
  }

  render() {
    const pr = this.props;

    return <div className="player-column">
      <PlayerInfo
        key="player"
        phase={pr.phase}
        user={pr.user}
        owner={pr.owner}
        ready={pr.ready}
        current={pr.current}
        host={pr.host}
        team={pr.team}
      />
      <ActionInfo
        key="action"
        phase={pr.phase}
        user={pr.user}
        bids={pr.bids}
        play={pr.play}
        ready={pr.ready}
        leader={pr.leader}
        winning={pr.winning}
      />
      <ScoreInfo
        key="score"
        phase={pr.phase}
        user={pr.user}
        rank_meta={pr.rank_meta}
        points={pr.points}
      />
    </div>;
  }
}

namespace Column {

export type Props = PlayerInfo.Props & ActionInfo.Props & ScoreInfo.Props;

}

///////////////////////////////////////////////////////////////////////////////

export class RoundInfo extends React.Component<
  RoundInfo.Props,
  RoundInfo.State
> {
  constructor(props: RoundInfo.Props) {
    super(props);
  }

  render() {
    const zpy = this.props.zpy;

    const users = Object.fromEntries(this.props.users.map(u => [u.id, u]));
    const ordered = zpy.host !== null
      ? [
        ...zpy.players.slice(zpy.order[zpy.host]),
        ...zpy.players.slice(0, zpy.order[zpy.host]),
      ]
      : zpy.players;

    return <div className="round">
      {ordered.map(uid =>
        <Column
          key={uid}
          phase={zpy.phase}
          user={users[uid]}
          owner={uid === zpy.owner}
          ready={zpy.consensus.has(uid)}
          current={uid === zpy.current}
          host={uid === zpy.host}
          team={
            zpy.host_team.has(uid) ? 'host' :
            zpy.atk_team.has(uid) ? 'atk' : null
          }
          rank_meta={zpy.ranks[uid]}
          bids={zpy.bids.filter(({player}) => uid === player)}
          points={zpy.points[uid]}
          leader={uid === zpy.leader}
          winning={uid === zpy.winning}
          play={zpy.plays[uid]}
        />
      )}
    </div>;
  }
}

export namespace RoundInfo {

export type Props = {
  zpy: Z;
  users: P.User[];
};

export type State = {
};

}
