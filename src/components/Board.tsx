import * as React from "react"

import * as Eng from "trivial-engine.ts"

import { Card } from "components/Card.tsx"

export const Board = (props: {state: Eng.ClientState}) => {
  return <div style={{position: "relative"}} >
    {
      props.state.cards.map((card: Eng.Card) =>  {
        return <Card
                 card={card.card}
                 width={100}
                 x={card.x}
                 y={card.y}
                 position={"absolute"} />
      })
    }
  </div>
}

