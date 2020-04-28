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

import { strict as assert} from 'assert'


export class PlayerInfo extends React.Component<
  PlayerInfo.Props,
  PlayerInfo.State
> {
  constructor(props: PlayerInfo.Props) {
    super(props);
  }

  render() {
    const avatar_url = "";

    return <div className="player-info">
      <img
        className="avatar"
        src={avatar_url}
      />
      <div className="nick">{this.props.user.nick}</div>
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
