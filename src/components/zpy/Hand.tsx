import * as React from "react"
import {
  Draggable, DraggableProvided, DraggableStateSnapshot,
  Droppable, DroppableProvided, DroppableStateSnapshot,
} from 'react-beautiful-dnd'

import { CardBase, Card, Suit, Rank } from 'lib/zpy/cards.ts'

import { ZCard } from "components/zpy/Card.tsx"

import { strict as assert} from 'assert'


const restyle = (
  style: React.CSSProperties,
  snapshot: DraggableStateSnapshot
): React.CSSProperties => {
  if (!snapshot.isDropAnimating) return style;
  return {
    ...style,
    transitionDuration: '0.1s',
  };
};

export class ZHand extends React.Component<ZHand.Props, {}> {
  constructor(props: ZHand.Props) {
    super(props);
  }

  render() {
    return <Droppable
      droppableId={this.props.droppableId}
      direction="horizontal"
    >
      {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          style={{
            display: 'flex',
            overflow: 'auto',
            padding: 10,
          }}
        >
          {this.props.cards.map(({cb, id}, pos) => (
            <Draggable
              key={id}
              draggableId={id}
              index={pos}
            >
              {(
                provided: DraggableProvided,
                snapshot: DraggableStateSnapshot
               ) => (
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  style={restyle({
                    outline: 'none', // avoid conflicting selection affordance
                    ...provided.draggableProps.style
                  }, snapshot)}
                  onClick={ev => this.props.onSelect(id, pos, ev)}
                >
                  <ZCard
                    card={cb}
                    width={100}
                    clip={0.25}
                    selected={this.props.selected.has(id)}
                  />
                </div>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>;
  }
}

export namespace ZHand {

export type Props = {
  droppableId: string;
  cards: {cb: CardBase, id: string}[];
  selected: Set<string>;
  onSelect: (
    id: string,
    pos: number,
    ev: React.MouseEvent | React.TouchEvent
  ) => void;
};

}
