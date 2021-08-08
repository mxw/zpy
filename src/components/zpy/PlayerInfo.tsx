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
import axios from "axios"

import * as P from 'protocol/protocol'
import { GameId } from 'server/server'

import { ZPY } from 'lib/zpy/zpy'

import { Editable } from 'components/common/Editable'

import { hash_code } from 'utils/string'

import * as options from 'options'
import assert from 'utils/assert'


export class PlayerInfo extends React.Component<
  PlayerInfo.Props,
  PlayerInfo.State
> {
  constructor(props: PlayerInfo.Props) {
    super(props);

    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    this.state = {nick: props.user.nick};
  }

  /////////////////////////////////////////////////////////////////////////////

  /*
   * our nick---use the locally-edited one for ourselves, and the
   * client-maintained one for everyone else
   */
  nick(): string {
    return this.props.me.id === this.props.user.id
      ? this.state.nick
      : this.props.user.nick;
  }

  /*
   * constrain nickname edits
   */
  onChange(nick: string, prev: string): string {
    nick = nick.substring(0, options.nick_limit);
    this.setState({nick});
    return nick;
  }

  /*
   * commit a nickname update
   */
  onSubmit(nick: string): string {
    nick = nick.trim();

    (async () => {
      const response = await axios.post(
        '/api/set_nick',
        JSON.stringify({nick}),
        {headers: {'Content-Type': 'application/json'}}
      );
      if (!response.data) console.error('failed to set nickname');
    })();

    this.setState({nick});
    return nick;
  }

  /////////////////////////////////////////////////////////////////////////////

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

  renderSelfIcon() {
    const pr = this.props;
    if (pr.me.id !== pr.user.id) return null;

    const food_id =
      Math.abs(hash_code(`${pr.gid}:${this.nick()}`)) % 58 + 1;

    return <div key="self" className="self-wrapper">
      <div aria-label="this is you!" data-balloon-pos="down-left">
        <img
          className="self"
          src={`/static/png/food/${food_id}.png`}
        />
      </div>
    </div>;
  }

  renderNick() {
    if (this.props.me.id !== this.props.user.id) {
      return <div className="nick">{this.nick()}</div>;
    }
    return <Editable
      init={this.nick()}
      className="nick"
      onChange={this.onChange}
      onSubmit={this.onSubmit}
    />;
  }

  renderTeamIcon() {
    const icon = (() => {
      if (this.props.team === 'host') return 'crown';
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
    const avatar_id =
      Math.abs(hash_code(`${pr.gid}:${this.nick()}`)) % 78 + 1;

    const div_class = ["player-info"];
    if (pr.current) div_class.push("current");
    if (pr.me.id === pr.user.id) div_class.push("me");

    return <div className={div_class.join(' ')}>
      {this.renderHostIcon()}
      <img
        key="avatar"
        className="avatar"
        src={`/static/png/avatars/${avatar_id}.png`}
      />
      {this.renderSelfIcon()}
      {this.renderNick()}
      {this.renderTeamIcon()}
    </div>;
  }
}

export namespace PlayerInfo {

export type Props = {
  me: P.User;
  gid: GameId;
  phase: ZPY.Phase;
  user: P.User;

  owner: boolean;
  ready: boolean;
  current: boolean;
  host: boolean;
  team: null | 'host' | 'attacking';
};

export type State = {
  nick: string;
};

}
