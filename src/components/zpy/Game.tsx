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

    this.onClose  = this.onClose.bind(this);
    this.onReset  = this.onReset.bind(this);
    this.onUpdate = this.onUpdate.bind(this);

    this.state = {client: null};
  }

  componentDidMount() {
    const client: Client = new GameClient(
      ZPYEngine,
      this.props.path,
      this.props.id,
      this.props.nick,
    );
    client.onClose = this.onClose;
    client.onReset = this.onReset;
    client.onUpdate = this.onUpdate;

    this.setState({client});
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
      assert(err === null);
    }
    this.setState({client});
  }
  onUpdate(client: Client, effect: ZPYEngine.Effect | P.ProtocolAction) {
    this.setState({client});
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
