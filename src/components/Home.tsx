import * as React from "react"
import axios from "axios"

import { GameUI } from "components/sandbox/GameUI.tsx"

import { CardBase, Suit, Rank } from 'lib/zpy/cards.ts'
import { ZCard } from 'components/zpy/Card.tsx'
import { ZHand } from 'components/zpy/Hand.tsx'

export const Home = (props: {}) => {
  return <ZHand
    cards={[
      new CardBase(Suit.HEARTS, Rank.Q),
      new CardBase(Suit.HEARTS, Rank.Q),
      new CardBase(Suit.SPADES, 4),
      new CardBase(Suit.TRUMP, Rank.B),
    ]}
  />;

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
