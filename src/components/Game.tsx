import * as React from "react"

import { GameClient } from "protocol/client.ts"
import * as CardEngine from "trivial-engine.ts"
import { Board } from "components/Board.tsx"

export const Game = (props: {gameId: string}) => {

  let [client, resetClient] = React.useState(null)
  let [gameState, setGameState] = React.useState(null)

  if (client === null) {
    let client = new GameClient(CardEngine, props.gameId);
    let resync = () => {
      setGameState(client.state);
    }
    client.onUpdate = resync;
    client.onReset = resync;

    resetClient(client);
  }

  if (gameState === null) {
    return <div>waiting</div>;
  } else {
    return <Board state={gameState}/>
  }
}
