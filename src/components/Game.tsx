import * as React from "react"

import { GameClient } from "protocol/client.ts"
import { CounterEngine } from "trivial-engine.ts"

export const Game = (props: {gameId: string}) => {

  let [client, resetClient] = React.useState(null)
  let [gameState, setGameState] = React.useState(null)

  if (client === null) {
    let client = new GameClient(CounterEngine, props.gameId);
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

    let incr = () => {
      client.attempt("add");
    };

    return <div>
      {gameState}
      <button onClick={incr}>+1</button>
    </div>;
  }
}
