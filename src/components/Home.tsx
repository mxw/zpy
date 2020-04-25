import * as React from "react"
import axios from "axios"

import { GameUI } from "components/sandbox/GameUI.tsx"

import { Board } from 'components/zpy/Board.tsx'

export const Home = (props: {}) => {
  return <Board />;

  let [session, setSession] = React.useState<string | null>(null);
  let [gameId, setGameId] = React.useState<string | null>(null);

  if (session === null) {
    axios.get('/api/session')
         .then(response => {
           setSession(response.data);
         });
    return <div>waiting</div>
  }

  if (gameId === null) {
    axios.get("/api/activeGame")
         .then(response => {
           setGameId(response.data)
         });
    return <div>waiting</div>
  }

  return <GameUI gameId={gameId}/>
}
