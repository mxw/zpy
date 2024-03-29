/*
 * toplevel ZPY game component
 *
 * handles initial configuration, player join/part, and the client protocol,
 * then delegates the rest to Board
 */
import * as React from 'react'
import ReactModal = require('react-modal');

import * as P from 'protocol/protocol'
import { GameId } from 'server/server'
import { GameClient } from 'protocol/client'

import { ZPY } from 'lib/zpy/zpy'
import * as ZPYEngine from 'lib/zpy/engine'

import { Client, EngineCallbacks } from 'components/zpy/common'
import { Help } from 'components/zpy/Help'
import { Board } from 'components/zpy/Board'
import { LogArea } from 'components/zpy/LogArea'
import { Reveal } from 'components/zpy/Reveal'
import { ErrorMessage } from 'components/zpy/ErrorMessage'

import * as options from 'options'
import assert from 'utils/assert'

import 'styles/zpy/zpy.scss'


const err_duration_ms = 5000;

ReactModal.setAppElement('#zpy');

export class Game extends React.Component<Game.Props, Game.State> {
  constructor(props: Game.Props) {
    super(props);

    this.onClose = this.onClose.bind(this);
    this.onReset = this.onReset.bind(this);

    this.attempt = this.attempt.bind(this);
    this.subscribeReset = this.subscribeReset.bind(this);
    this.subscribeUpdate = this.subscribeUpdate.bind(this);
    this.queueError = this.queueError.bind(this);

    this.onClickDoor = this.onClickDoor.bind(this);
    this.onClickPage = this.onClickPage.bind(this);
    this.closeReveal = this.closeReveal.bind(this);

    this.state = {
      client: null,
      done_reason: null,

      next_err_id: 0,
      pending_error: null,
      reveal_effects: [],
      log_open: false,

      reset_subs: [],
      update_subs: [],
    };
  }

  componentDidMount() {
    this.ensureClient();
  }

  componentWillUnmount() {
    console.log('game unmounted...');
    this.state.client.close();
  }

  ensureClient(): Client {
    if (this.state.client !== null) return this.state.client;

    const client: Client = new GameClient(
      ZPYEngine,
      this.props.path,
      this.props.id,
      this.props.nick,
    );
    client.onClose = this.onClose;
    client.onReset = this.onReset;
    client.onUpdate = this.onUpdate.bind(this, null);

    this.setState({client});
    return client;
  }

  /////////////////////////////////////////////////////////////////////////////

  /*
   * queue up effects that require a reveal of information
   *
   * surely one slot is enough, you cry!  as it turns out, it's possible that
   * someone just hangs out on the "reveal kitty" view until the host replaces
   * the kitty, calls friends, attempts a fly, and it's rejected---in which
   * case we want to show the reject_fly reveal afterwards.
   */
  enqueueReveal(effect: ZPYEngine.Effect, state: ZPYEngine.ClientState) {
    switch (effect.kind) {
      case 'install_host':
        if (state.winning_bid() !== null) return;
      case 'reject_fly': break;
      case 'finish': break;
      default: return;
    }
    this.setState((state, props) => ({
      reveal_effects: [...state.reveal_effects, effect]
    }));
  }

  closeReveal() {
    this.setState((state, props) => ({
      reveal_effects: state.reveal_effects.slice(1)
    }));
  }

  renderReveal() {
    const effect = this.state.reveal_effects[0] ?? null;

    return <ReactModal
      isOpen={this.state.reveal_effects.length > 0}
      onRequestClose={this.closeReveal}
      contentLabel="revealed"
      className="reveal-modal-content"
      overlayClassName="reveal-modal-overlay"
    >
      <Reveal effect={effect} client={this.state.client} />
    </ReactModal>;
  }

  renderError() {
    const error = this.state.pending_error;
    if (error === null) return;

    setTimeout(() => {
      this.setState((state, props) => {
        if (error.id === state.pending_error?.id) {
          return {pending_error: null};
        }
      });
    }, err_duration_ms);

    return <ErrorMessage
      key={error.id}
      error={error.ue}
      timeout={err_duration_ms}
    />;
  }

  /////////////////////////////////////////////////////////////////////////////

  onClose(client: Client, reason: null | string) {
    if (reason !== null) {
      // non-null reason means we were booted
      this.setState({client: null, done_reason: `kicked: ${reason}`});
    } else {
      this.setState({client: null});
    }
  }

  onReset(client: Client) {
    if (client.state.phase === ZPY.Phase.INIT &&
        !client.state.players.includes(client.me.id)) {
      const err = client.attempt({
        kind: 'add_player',
        args: [client.me.id],
      });
    }
    this.setState({client, done_reason: 'the game has ended'});

    for (let callback of this.state.reset_subs) {
      callback(client.state);
    }
  }

  onUpdate<T>(
    cb: null | ((effect: ZPYEngine.Effect, ctx?: T) => void),
    client: Client,
    command: P.Command<ZPYEngine.Effect>,
    ctx?: T,
  ) {
    this.setState({client});

    if (command.kind === 'engine') {
      for (let callback of this.state.update_subs) {
        callback(command.effect);
      }
      cb?.(command.effect, ctx);

      this.enqueueReveal(command.effect, client.state);
    }
  }

  queueError(ue: ZPYEngine.UpdateError) {
    this.setState((state, props) => ({
      next_err_id: state.next_err_id + 1,
      pending_error: {id: state.next_err_id, ue},
    }));
  }

  onReject<T>(
    cb: null | ((ue: ZPYEngine.UpdateError, ctx?: T) => void),
    client: Client,
    ue: ZPYEngine.UpdateError,
    ctx?: T,
  ) {
    if (options.debug) console.error(ue);

    if (ue instanceof ZPY.InvalidArgError) {
      // the UI should prevent these, so don't surface them to the user
      console.error(ue.toString());
    } else if (ue instanceof ZPY.OutOfTurnError) {
      // do nothing
    } else {
      // set this as the error to display to the user
      this.setState((state, props) => ({
        client,
        next_err_id: state.next_err_id + 1,
        pending_error: {id: state.next_err_id, ue},
      }));
    }

    cb?.(ue, ctx);
  }

  attempt(
    intent: ZPYEngine.Intent,
    onUpdate: null | ((effect: ZPYEngine.Effect, ctx?: any) => void),
    onReject: null | ((ue: ZPYEngine.UpdateError, ctx?: any) => void),
    ctx?: any,
  ) {
    this.state.client.attempt(
      intent,
      this.onUpdate.bind(this, onUpdate),
      this.onReject.bind(this, onReject),
      ctx
    );
  }

  subscribeReset(callback: (state: ZPYEngine.ClientState) => void) {
    this.setState((state, props) => ({
      reset_subs: [...state.reset_subs, callback]
    }));
  }
  subscribeUpdate(callback: (effect: ZPYEngine.Effect) => void) {
    this.setState((state, props) => ({
      update_subs: [...state.update_subs, callback]
    }));
  }

  funcs(): EngineCallbacks<any> {
    return {
      attempt: this.attempt,
      subscribeReset: this.subscribeReset,
      subscribeUpdate: this.subscribeUpdate,
      queueError: this.queueError,
    };
  }

  /////////////////////////////////////////////////////////////////////////////

  onClickDoor(ev: React.MouseEvent | React.TouchEvent) {
    if (ev.defaultPrevented) return;
    if ('button' in ev && ev.button !== 0) return;

    ev.preventDefault();

    const me = this.state.client.me.id;

    if (this.state.client.state.players.includes(me)) {
      this.attempt({kind: 'rm_player', args: [me]}, null, null);
    } else {
      this.attempt({kind: 'add_player', args: [me]}, null, null);
    }
  }

  renderDoor() {
    const me = this.state.client.me.id;
    const zpy = this.state.client.state;

    if (zpy.phase !== ZPY.Phase.INIT &&
        zpy.phase !== ZPY.Phase.WAIT) {
      return null;
    }
    const action = zpy.players.includes(me) ? 'leave' : 'join';

    return <div
      className={`door-wrapper ${action}`}
      onClick={this.onClickDoor}
    >
      <div aria-label={`${action} game`} data-balloon-pos="left">
        <img
          className="door-icon"
          src="/static/png/icons/door.png"
        />
      </div>
    </div>;
  }

  onClickPage(ev: React.MouseEvent | React.TouchEvent) {
    if (ev.defaultPrevented) return;
    if ('button' in ev && ev.button !== 0) return;

    ev.preventDefault();

    this.setState((state, props) => ({log_open: !state.log_open}));
  }

  renderLogToggle() {
    const tooltip = this.state.log_open
      ? 'hide game log'
      : 'show game log';

    const icon = this.state.log_open
      ? 'fast-forward-button'
      : 'fast-reverse-button';

    return <div
      className="page-wrapper"
      onClick={this.onClickPage}
    >
      <div aria-label={tooltip} data-balloon-pos="left">
        <img
          className="page-icon"
          src={`/static/png/icons/${icon}.png`}
        />
      </div>
    </div>;
  }

  renderGameLog() {
    return <LogArea
      key={this.state.client.state.round} // reset every round
      zpy={this.state.client.state}
      users={this.state.client.users}
      hidden={!this.state.log_open}
      funcs={this.funcs()}
    />;
  }

  /////////////////////////////////////////////////////////////////////////////

  render() {
    const client = this.state.client;

    if (client === null || client.state === null) {
      // null done_reason means we're trying to connect for the first time
      if (this.state.done_reason === null) return null;

      // we only get an onClose and reset the client if the server sent a
      // "bye", which means the game expired or we were kicked
      return <div className="done">{this.state.done_reason}</div>;
    }

    if (options.debug) {
      console.log({
        ...client.me,
        phase: ZPY.Phase[client.state.phase],
        users: client.users,
      });
    }

    return <>
      <div className="sidebar">
        <div className="sidebar-icons">
          <Help />
          {this.renderLogToggle()}
          {this.renderDoor()}
        </div>
        {this.renderGameLog()}
      </div>
      <Board
        gid={this.props.id}
        me={client.me}
        zpy={client.state}
        users={client.users}
        funcs={this.funcs()}
      />
      {this.renderReveal()}
      {this.renderError()}
    </>;
  }
}

export namespace Game {

export type Props = {
  id: GameId;
  nick: string;
  path: string;
};

export type State = {
  client: null | Client;
  // message to display on disconnect; null if connection was never established
  done_reason: null | string;

  next_err_id: number; // for tracking error message timeouts
  pending_error: null | {
    id: number;
    ue: ZPYEngine.UpdateError;
  };
  reveal_effects: ZPYEngine.Effect[];
  log_open: boolean;

  reset_subs: ((state: ZPYEngine.ClientState) => void)[];
  update_subs: ((effect: ZPYEngine.Effect) => void)[];
};

}
