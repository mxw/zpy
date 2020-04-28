/*
 * interactive play portion of the ZPY board
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { CardBase } from 'lib/zpy/cards.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import { State as Z } from 'lib/zpy/engine.ts'

import { PlayerInfo } from 'components/zpy/PlayerInfo.tsx'

import { strict as assert} from 'assert'


export class Column extends React.Component<Column.Props, {}> {
  constructor(props: Column.Props) {
    super(props);
  }

  render() {
    const pr = this.props;

    return <div className="player-column">
      <PlayerInfo
        phase={pr.phase}
        user={pr.user}
        owner={pr.owner}
        ready={pr.ready}
        current={pr.current}
        host={pr.host}
        team={pr.team}
      />
    </div>;
  }
}

export namespace Column {

export type Props = PlayerInfo.Props & {
  rank_meta: Z['ranks'][P.UserID];

  kitty: CardBase[];
  bids: Z['bids'];

  tr: Z['tr'];
  points: Z['points'][P.UserID];

  leader: boolean;
  play: Z['plays'][P.UserID];
  winning: boolean;
};

export type State = {
};

}

///////////////////////////////////////////////////////////////////////////////

export class RoundState extends React.Component<
  RoundState.Props,
  RoundState.State
> {
  constructor(props: RoundState.Props) {
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
          kitty={zpy.kitty}
          bids={zpy.bids.filter(({player}) => uid === player)}
          tr={zpy.tr}
          points={zpy.points[uid]}
          leader={uid === zpy.leader}
          play={zpy.plays[uid]}
          winning={uid === zpy.winning}
        />
      )}
    </div>;
  }
}

export namespace RoundState {

export type Props = {
  zpy: Z;
  users: P.User[];
};

export type State = {
};

}
