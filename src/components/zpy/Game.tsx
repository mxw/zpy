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

    const client: Client = new GameClient(ZPYEngine, props.path, props.id);
    client.onClose  = this.onClose  = this.onClose.bind(this);
    client.onReset  = this.onReset  = this.onReset.bind(this);
    client.onUpdate = this.onUpdate = this.onUpdate.bind(this);

    this.state = {client};
  }

  onClose(client: Client) {
    this.setState({client: null});
  }
  onReset(client: Client) {
    this.setState({client});
  }
  onUpdate(client: Client, effect: ZPYEngine.Effect | P.ProtocolAction) {
    this.setState({client});
  }

  render() {
    if (this.state.client === null) {
      return <div className="done">
        the game has ended
      </div>;
    }
    return <Board/>;
  }
}

export namespace Game {

export type Props = {
  id: GameId;
  path: string;
};

export type State = {
  client: null | Client;
};

}
