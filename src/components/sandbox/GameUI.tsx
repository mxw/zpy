import * as React from "react"

import { GameClient } from "protocol/client.ts"
import * as CardEngine from "lib/sandbox/engine.ts"
import { Board } from "components/sandbox/Board.tsx"

import { Client, createGame } from "components/sandbox/game.ts"

export class GameUI extends React.Component<{gameId: string}, {client: null | Client}> {
  constructor(props: {gameId: string}) {
    super(props)
    this.state = {client: null};
  }

  render() {
    if (this.state.client === null) {
      let client = createGame(this.props.gameId);
      let resync = () => {
        this.forceUpdate();
      };
      client.onUpdate = resync;
      client.onReset = resync;
      this.setState({client});
    }

    if (this.state.client === null || this.state.client.state === null) {
      return <div>waiting</div>;
    } else {
      return <Board client={this.state.client} state={this.state.client.state}/>
    }
  }
}
