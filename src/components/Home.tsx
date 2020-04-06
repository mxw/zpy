import * as React from "react"
import axios from "axios"

import { Session } from "./context.ts"
import { Game } from "./Game.tsx"

export const Home = (props: {}) => {

  let session = React.useContext(Session);
  let [gameId, setGameId] = React.useState<string | null>(null);

  if (session === null) {
    return <div>waiting</div>
  };

  if (gameId === null) {
    axios.get("/api/activeGame")
         .then(response => {
           setGameId(response.data)
         });
    return <div>waiting</div>
  }

  return <Game gameId={gameId}/>
}
