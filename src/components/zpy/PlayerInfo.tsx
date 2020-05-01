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


export class PlayerInfo extends React.Component<PlayerInfo.Props, {}> {
  constructor(props: PlayerInfo.Props) {
    super(props);
  }

  renderHostIcon() {
    if (!this.props.host) return null;

    return <div key="host" className="host-wrapper">
      <div aria-label="current host" data-balloon-pos="down-left">
        <img
          className="host"
          src="/static/png/icons/crown.png"
        />
      </div>
    </div>;
  }

  renderTeamIcon() {
    const icon = (() => {
      if (this.props.team === 'host') return 'top-hat';
      if (this.props.team === 'attacking') return 'kitchen-knife';
      return null;
    })();
    if (icon === null) return null;

    return <div key="team" className="team-wrapper">
      <div aria-label={`${this.props.team} team`} data-balloon-pos="down">
        <img
          className="team"
          src={`/static/png/icons/${icon}.png`}
        />
      </div>
    </div>;
  }

  render() {
    const pr = this.props;
    const avatar_id = hash_code(`${pr.user.id}:${pr.user.nick}`) % 78 + 1;

    let div_class = ["player-info"];
    if (pr.current) div_class.push("current");

    return <div className={div_class.join(' ')}>
      {this.renderHostIcon()}
      <img
        key="avatar"
        className="avatar"
        src={`/static/png/avatars/${avatar_id}.png`}
      />
      <div key="nick" className="nick">{pr.user.nick}</div>
      {this.renderTeamIcon()}
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
  team: null | 'host' | 'attacking';
};

}
