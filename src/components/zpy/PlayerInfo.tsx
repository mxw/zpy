/*
 * infobox about a player in a ZPY game
 *
 * for player P, this includes:
 *   - P's dynamically-selected avatar
 *   - P's nickname
 *   - is P this game's owner?
 *   - is P host?
 *   - P's team affiliation
 *   - is it P's turn?
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { ZPY } from 'lib/zpy/zpy.ts'

import { hash_code } from 'utils/string.ts'

import { strict as assert} from 'assert'


export class PlayerInfo extends React.Component<
  PlayerInfo.Props,
  PlayerInfo.State
> {
  constructor(props: PlayerInfo.Props) {
    super(props);
  }

  render() {
    const pr = this.props;
    const avatar_id = hash_code(`${pr.user.id}:${pr.user.nick}`) % 78 + 1;

    let div_class = ["player-info"];
    if (pr.current) div_class.push("current");

    const host = !pr.host ? null :
      <img
        key="host"
        className="host"
        src="/static/png/icons/crown.png"
      />;

    return <div className={div_class.join(' ')}>
      {host}
      <img
        key="avatar"
        className="avatar"
        src={`/static/png/avatars/${avatar_id}.png`}
      />
      <div className="nick">{pr.user.nick}</div>
    </div>;
  }
}

export namespace PlayerInfo {

export type Props = {
  phase: ZPY.Phase;
  user: P.User;

  owner: boolean;
  ready: boolean;
  current: boolean;
  host: boolean;
  team: null | 'host' | 'atk';
};

export type State = {
};

}
