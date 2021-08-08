/*
 * non-interactive informational portion of the ZPY board
 */
import * as React from 'react'

import * as P from 'protocol/protocol'
import { GameId } from 'server/server'

import { CardBase, Suit } from 'lib/zpy/cards'
import { ZPY } from 'lib/zpy/zpy'
import { State as Z } from 'lib/zpy/engine'

import { EngineCallbacks } from 'components/zpy/common'
import { ActionInfo } from 'components/zpy/ActionInfo'
import { PlayerInfo } from 'components/zpy/PlayerInfo'
import { ScoreInfo } from 'components/zpy/ScoreInfo'

import assert from 'utils/assert'


class Column extends React.Component<Column.Props, {}> {
  constructor(props: Column.Props) {
    super(props);
  }

  render() {
    const pr = this.props;

    const classes = ["player-column"];
    if (pr.current) classes.push("current");

    return <div className={classes.join(' ')}>
      <PlayerInfo
        me={pr.me}
        gid={pr.gid}
        phase={pr.phase}
        user={pr.user}
        owner={pr.owner}
        ready={pr.ready}
        current={pr.current}
        host={pr.host}
        team={pr.team}
      />
      <ActionInfo
        phase={pr.phase}
        user={pr.user}
        tr={pr.tr}
        bids={pr.bids}
        bidder={pr.bidder}
        play={pr.play}
        ready={pr.ready}
        leader={pr.leader}
        winning={pr.winning}
        lead={pr.lead}
      />
      <ScoreInfo
        me={pr.me}
        phase={pr.phase}
        user={pr.user}
        rank_meta={pr.rank_meta}
        points={pr.points}
        hide_pts={pr.hide_pts}
        funcs={pr.funcs}
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

  renderTeamScore() {
    const zpy = this.props.zpy;

    if (zpy.phase === ZPY.Phase.INIT ||
        zpy.phase === ZPY.Phase.FINISH ||
        zpy.phase === ZPY.Phase.WAIT) {
      return null;
    }
    if (zpy.joins !== zpy.nfriends) return null;

    const points = zpy.team_point_total('attacking');
    const thresh = zpy.ndecks * 20;

    return <div className="team-score">
      attacking team has {points} points. next threshold is
      at {(Math.floor(points / thresh) + 1) * thresh} points.
    </div>;
  }

  renderTrumpIndicator() {
    const zpy = this.props.zpy;
    if (zpy.tr === null) return null;

    const suitname = Suit[zpy.tr.suit].toLowerCase();

    return <div
      key="trump-indicator"
      className="trump-indicator-wrapper"
    >
      <div
        className={`trump-indicator ${suitname}`}
        aria-label="current trump"
        data-balloon-pos="left"
      >
        {zpy.tr.toString()}
      </div>
    </div>;
  }

  renderFriendIndicator() {
    const zpy = this.props.zpy;
    if (zpy.friends.length === 0) return null;

    const friends = zpy.friends.map(({card, nth, tally}) => {
      const ord_str = `${nth}º`;
      const card_str = card.toString();
      const key = `${ord_str} ${card_str}`;
      const suitname = Suit[card.suit].toLowerCase();

      const classes = ["friend"];
      if (tally === 0) classes.push("found");

      return <div key={key} className={classes.join(' ')}>
        {ord_str} <span className={suitname}>{card_str}</span>
      </div>;
    });

    return <div
      key="friend-indicator"
      className="friend-indicator-wrapper"
    >
      <div
        className="friend-indicator"
        aria-label="host's friends"
        data-balloon-pos="down"
      >
        {friends}
      </div>
    </div>;
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

    return <div className="round-container">
      <div className="round">
        {ordered.map(uid => uid in users ? // users and players may be desync'd
          <Column
            key={uid}
            me={this.props.me}
            gid={this.props.gid}
            phase={zpy.phase}
            user={users[uid]}
            owner={uid === zpy.owner}
            ready={zpy.consensus.has(uid)}
            current={
              zpy.is_current(uid) &&
              // we maintain the current player across PREPARE and KITTY in the
              // event of no-bid free-for-all draws, but we shouldn't display
              // anyone as current during those phases
              zpy.phase !== ZPY.Phase.PREPARE &&
              zpy.phase !== ZPY.Phase.KITTY
            }
            tr={zpy.tr}
            host={uid === zpy.host}
            team={
              zpy.host_team.has(uid) ? 'host' :
              zpy.atk_team.has(uid) ? 'attacking' : null
            }
            rank_meta={zpy.ranks[uid]}
            bids={zpy.bids.filter(({player}) => uid === player)}
            bidder={uid === zpy.winning_bid()?.player}
            points={zpy.points[uid] ?? null}
            leader={uid === zpy.leader}
            winning={uid === zpy.winning}
            lead={zpy.lead}
            play={zpy.plays[uid] ?? null}
            hide_pts={
              zpy.host_team.has(uid) &&
              !!(zpy.rules.info & ZPY.HiddenInfoRule.HIDE_PTS)
            }
            funcs={this.props.funcs}
          /> : null
        )}
        {this.renderTrumpIndicator()}
        {this.renderFriendIndicator()}
      </div>
      {this.renderTeamScore()}
    </div>;
  }
}

export namespace RoundInfo {

export type Props = {
  gid: GameId;
  me: P.User;
  zpy: Z;
  users: P.User[];

  funcs: EngineCallbacks<any>;
};

}
