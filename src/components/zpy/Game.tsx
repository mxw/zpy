/*
 * toplevel ZPY game component
 *
 * handles initial configuration, player join/part, and the client protocol,
 * then delegates the rest to Board
 */
import * as React from 'react'
import ReactModal = require('react-modal');

import * as P from 'protocol/protocol.ts'
import { GameId } from 'server/server.ts'
import { GameClient } from 'protocol/client.ts'

import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { Client, EngineCallbacks } from 'components/zpy/common.ts'
import { Help } from 'components/zpy/Help.tsx'
import { Board } from 'components/zpy/Board.tsx'
import { Reveal } from 'components/zpy/Reveal.tsx'
import { ErrorMessage } from 'components/zpy/ErrorMessage.tsx'

import * as options from 'options.ts'
import assert from 'utils/assert.ts'

import 'styles/zpy/zpy.scss'


ReactModal.setAppElement('#zpy');

export class Game extends React.Component<Game.Props, Game.State> {
  constructor(props: Game.Props) {
    super(props);

    this.onClose = this.onClose.bind(this);
    this.onReset = this.onReset.bind(this);

    this.attempt = this.attempt.bind(this);
    this.subscribeReset = this.subscribeReset.bind(this);
    this.subscribeUpdate = this.subscribeUpdate.bind(this);

    this.closeReveal = this.closeReveal.bind(this);

    this.state = {
      client: null,
      next_err_id: 0,
      pending_error: null,
      reveal_effects: [],
      reset_subs: [],
      update_subs: [],
    };
  }

  componentDidMount() {
    this.ensureClient();
  }
  componentDidUpdate() {
    this.ensureClient();
  }

  componentWillUnmount() {
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
    }, 5000);

    return <ErrorMessage key={error.id} error={error.ue} timeout={5000} />;
  }

  /////////////////////////////////////////////////////////////////////////////

  onClose(client: Client) {
    this.setState({client: null});
  }

  onReset(client: Client) {
    if (client.state.phase === ZPY.Phase.INIT &&
        !client.state.players.includes(client.me.id)) {
      const err = client.attempt({
        kind: 'add_player',
        args: [client.me.id],
      });
    }
    this.setState({client});

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
    onUpdate: (effect: ZPYEngine.Effect, ctx?: any) => void,
    onReject: (ue: ZPYEngine.UpdateError, ctx?: any) => void,
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

  /////////////////////////////////////////////////////////////////////////////

  render() {
    const client = this.state.client;

    if (client === null) {
      return <div className="done">
        the game has ended
      </div>;
    }
    if (client.state === null) return null;

    return <>
      <Help />
      <Board
        gid={this.props.id}
        me={client.me}
        zpy={client.state}
        users={client.users}
        funcs={{
          attempt: this.attempt,
          subscribeReset: this.subscribeReset,
          subscribeUpdate: this.subscribeUpdate,
        }}
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

  next_err_id: number; // for tracking error message timeouts
  pending_error: null | {
    id: number;
    ue: ZPYEngine.UpdateError;
  };
  reveal_effects: ZPYEngine.Effect[];

  reset_subs: ((state: ZPYEngine.ClientState) => void)[];
  update_subs: ((effect: ZPYEngine.Effect) => void)[];
};

}
