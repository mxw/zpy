import * as React from "react"
import axios from "axios"

import { GameUI } from "components/sandbox/GameUI.tsx"

import { CardBase, Suit, Rank } from 'lib/zpy/cards.ts'
import { PlayArea } from 'components/zpy/PlayArea.tsx'

export const Home = (props: {}) => {
  return <PlayArea
    cards={[
      {cb: new CardBase(Suit.DIAMONDS, Rank.K), id: '0'},
      {cb: new CardBase(Suit.DIAMONDS, Rank.A), id: '1'},
      {cb: new CardBase(Suit.SPADES, 4), id: '2'},
      {cb: new CardBase(Suit.SPADES, 7), id: '3'},
      {cb: new CardBase(Suit.HEARTS, Rank.Q), id: '4'},
      {cb: new CardBase(Suit.HEARTS, Rank.Q), id: '5'},
      {cb: new CardBase(Suit.TRUMP, Rank.B), id: '6'},
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
