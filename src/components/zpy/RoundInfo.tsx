/*
 * non-interactive informational portion of the ZPY board
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { CardBase, Suit } from 'lib/zpy/cards.ts'
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

    let classes = ["player-column"];
    if (pr.current) classes.push("current");

    return <div className={classes.join(' ')}>
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
        tr={pr.tr}
        bids={pr.bids}
        play={pr.play}
        ready={pr.ready}
        leader={pr.leader}
        winning={pr.winning}
        lead={pr.lead}
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

export class RoundInfo extends React.Component<RoundInfo.Props, {}> {
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

    const trump_indicator = (() => {
      if (zpy.tr === null) return null;

      const suitname = Suit[zpy.tr.suit].toLowerCase();

      return <div
        key="trump-indicator"
        className={`trump-indicator ${suitname}`}
      >
        {zpy.tr.toString()}
      </div>
    })();

    return <div className="round">
      {ordered.map(uid =>
        <Column
          key={uid}
          phase={zpy.phase}
          user={users[uid]}
          owner={uid === zpy.owner}
          ready={zpy.consensus.has(uid)}
          current={uid === zpy.players[zpy.current]}
          tr={zpy.tr}
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
          lead={zpy.lead}
          play={zpy.plays[uid] ?? null}
        />
      )}
      {trump_indicator}
    </div>;
  }
}

export namespace RoundInfo {

export type Props = {
  me: P.User;
  zpy: Z;
  users: P.User[];
};

}
