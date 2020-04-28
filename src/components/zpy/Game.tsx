/*
 * toplevel ZPY game component
 *
 * handles initial configuration, player join/part, and the client protocol,
 * then delegates the rest to Board
 */
import * as React from 'react'

import { GameId } from 'server/server.ts'
import { GameClient } from 'protocol/client.ts'
import * as P from 'protocol/protocol.ts'

import * as ZPYEngine from 'lib/zpy/engine.ts'

import { Board } from 'components/zpy/Board.tsx'

import { strict as assert} from 'assert'


export type Client = GameClient<
  ZPYEngine.Config,
  ZPYEngine.Intent,
  ZPYEngine.State,
  ZPYEngine.Action,
  ZPYEngine.ClientState,
  ZPYEngine.Effect,
  ZPYEngine.UpdateError,
  typeof ZPYEngine
>;

export class Game extends React.Component<Game.Props, Game.State> {
  constructor(props: Game.Props) {
    super(props);

    this.onClose = this.onClose.bind(this);
    this.onReset = this.onReset.bind(this);
    this.attempt = this.attempt.bind(this);

    this.state = {client: null};
  }

  componentDidMount() {
    this.ensureClient();
  }
  componentDidUpdate() {
    this.ensureClient();
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

  onClose(client: Client) {
    this.setState({client: null});
  }

  onReset(client: Client) {
    if (!client.state.players.includes(client.me.id)) {
      const err = client.attempt({
        kind: 'add_player',
        args: [client.me.id],
      });
    }
    this.setState({client});
  }

  onUpdate<T>(
    cb: null | ((effect: ZPYEngine.Effect, ctx: T) => void),
    client: Client,
    command: P.Command<ZPYEngine.Effect>,
    ctx?: T,
  ) {
    if (command.kind === 'engine') {
      cb?.(command.effect, ctx);
    }
    console.log('onUpdate');
    this.setState({client});
  }

  onReject<T>(
    cb: null | ((ue: ZPYEngine.UpdateError, ctx: T) => void),
    client: Client,
    ue: ZPYEngine.UpdateError,
    ctx?: T,
  ) {
    cb?.(ue, ctx);
    this.setState({client});
  }

  attempt(
    intent: ZPYEngine.Intent,
    ctx: any,
    onUpdate: (effect: ZPYEngine.Effect, ctx: any) => void,
    onReject: (ue: ZPYEngine.UpdateError, ctx: any) => void,
  ) {
    this.state.client.attempt(
      intent,
      this.onUpdate.bind(this, onUpdate),
      this.onReject.bind(this, onReject),
      ctx
    );
  }

  render() {
    const client = this.state.client;

    if (client === null) {
      return <div className="done">
        the game has ended
      </div>;
    }
    if (client.state === null) return null;

    return <Board
      me={client.me}
      zpy={client.state}
      users={client.users}
      attempt={this.attempt}
    />;
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
};

}
