/*
 * toplevel ZPY game component
 *
 * handles initial configuration, player join/part, and the client protocol,
 * then delegates the rest to Board
 */
import * as React from 'react'

import { GameId } from 'server/server.ts'
import { GameClient } from 'protocol/client.ts'

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

    this.state = { client: new GameClient(ZPYEngine, props.path, props.id) };
  }

  render() {
    return <Board/>;
  }
}

export namespace Game {

export type Props = {
  id: GameId;
  path: string;
};

export type State = {
  client: Client;
};

}
