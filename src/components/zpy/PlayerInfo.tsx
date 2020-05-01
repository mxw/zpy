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

import * as P from 'protocol/protocol.ts'

import { ZPY } from 'lib/zpy/zpy.ts'

import { isWindows } from 'components/utils/platform.ts'

import { hash_code } from 'utils/string.ts'

import { strict as assert} from 'assert'


export class PlayerInfo extends React.Component<
  PlayerInfo.Props,
  PlayerInfo.State
> {
  node: HTMLDivElement;
  nicksize: HTMLDivElement;

  constructor(props: PlayerInfo.Props) {
    super(props);

    this.onClickOut = this.onClickOut.bind(this);
    this.onDblClick = this.onDblClick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);

    this.state = {
      nick: this.props.user.nick,
      editing: false,
      nick_width: null,
    };
  }

  componentDidMount() {
    window.addEventListener('click', this.onClickOut);
    window.addEventListener('touchend', this.onClickOut);
  }

  componentWillUnmount() {
    window.removeEventListener('click', this.onClickOut);
    window.removeEventListener('touchend', this.onClickOut);
  }

  /////////////////////////////////////////////////////////////////////////////

  componentDidUpdate(
    prevProps: PlayerInfo.Props,
    prevState: PlayerInfo.State
  ) {
    this.updateWidth();
  }

  onClickOut(
    ev: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent
  ) {
    if (ev.defaultPrevented) return;
    if ('button' in ev && ev.button !== 0) return;

    if (this.node?.contains(ev.target as Node)) return;

    this.setState((state, props) => ({
      nick: state.nick.trim(),
      editing: false,
    }));
  }

  /*
   * transition the nick display into edit mode
   */
  onDblClick(ev: React.MouseEvent | React.TouchEvent) {
    if (ev.defaultPrevented) return;
    if ('button' in ev && ev.button !== 0) return;

    // can only edit our own name
    if (this.props.me.id !== this.props.user.id) return;

    if (this.state.editing) return;

    ev.preventDefault();
    this.setState({editing: true});
  }

  /*
   * capture ctrl-A and Enter behaviors on the nick edit input
   */
  onKeyDown(ev: React.KeyboardEvent) {
    if (ev.defaultPrevented) return;

    const metaKey = isWindows() ? ev.ctrlKey : ev.metaKey;

    if (ev.key === 'a' && metaKey) {
      // we need to thread a message through to the PlayArea's keydown event
      // handler in order to prevent the card selection behavior (while
      // retaining the default input text-selection behavior)
      const native_ev = ev.nativeEvent;
      const ne = native_ev as (typeof native_ev & {preventPlayArea: boolean});
      ne.preventPlayArea = true;
      return;
    }

    if (ev.key !== 'Enter') return;
    ev.preventDefault();

    const nick = this.state.nick.trim();

    (async () => {
      const response = await axios.post(
        '/api/set_nick',
        JSON.stringify({nick}),
        {headers: {'Content-Type': 'application/json'}}
      );
      if (!response.data) console.error('failed to set nickname');
    })();

    this.setState({nick, editing: false});
  }

  /*
   * update the width of the nick-edit input and re-render
   *
   * we use a hidden, absolute-positioned element which just contains the input
   * value text to determine the appropriate size
   *
   * ref: https://github.com/JedWatson/react-input-autosize/blob/master/src/AutosizeInput.js
   */
  updateWidth() {
    const width = this.nicksize?.scrollWidth;
    if (!width) return; // including if 0

    if (width !== this.state.nick_width) {
      this.setState({nick_width: width});
    }
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

  renderNick() {
    if (!this.state.editing) {
      return <div
        key="nick"
        className="nick"
        onDoubleClick={this.onDblClick}
      >
        {this.state.nick}
      </div>;
    }

    return <>
      <input
        className="nick-edit"
        type="text"
        value={this.state.nick}
        style={{width: this.state.nick_width ?? "auto"}}
        onChange={ev => this.setState({nick: ev.target.value})}
        onKeyDown={this.onKeyDown}
      />
      <div
        ref={node => this.nicksize = node}
        className="nick-size"
        style={{
          visibility: "hidden",
          whiteSpace: "pre",
          position: "absolute",
        }}
      >
        {this.state.nick}
      </div>
    </>;
  }

  renderTeamIcon() {
    const icon = (() => {
      if (this.props.team === 'host') return 'castle';
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
      Math.abs(hash_code(`${pr.user.id}:${this.state.nick}`)) % 78 + 1;

    let div_class = ["player-info"];
    if (pr.current) div_class.push("current");

    return <div
      ref={node => this.node = node}
      className={div_class.join(' ')}
    >
      {this.renderHostIcon()}
      <img
        key="avatar"
        className="avatar"
        src={`/static/png/avatars/${avatar_id}.png`}
      />
      {this.renderNick()}
      {this.renderTeamIcon()}
    </div>;
  }
}

export namespace PlayerInfo {

export type Props = {
  me: P.User;
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
  editing: boolean;
  nick_width: null | number;
};

}
