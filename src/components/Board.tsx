import * as React from "react"

import * as Eng from "trivial-engine.ts"

import { SendIntent } from "components/context.ts"
import { Card } from "components/Card.tsx"

export const Board = (props: {state: Eng.ClientState}) => {

  let sendIntent = React.useContext(SendIntent);
  let [visible, setVisible] = React.useState(false)

  const dragBegin = (c: Eng.Card, ev: DragEvent) => {
    sendIntent({
      verb: 'grab',
      target: c.id
    });
  };

  const dragEnd = (c: Eng.Card, ev: DragEvent) => {
    console.log(ev);
    sendIntent({
      verb: 'drop',
      target: c.id
    });
  };

  const dragMid = (c: Eng.Card, ev: DragEvent) => {

  };

  return <div style={{position: "relative"}} >
    {
      props.state.cards.map((card: Eng.Card) =>  {
        return <Card
                 key={card.id}
                 card={card.card}
                 width={100}
                 x={card.x}
                 y={card.y}
                 position={"absolute"}
                 draggable={true}
                 onDragStart={(ev: DragEvent) => dragBegin(card, ev)}
                 onDragEnd={(ev: DragEvent) => dragEnd(card, ev)}
        />
      })
    }
  </div>
}

