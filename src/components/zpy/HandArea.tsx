import * as React from "react"
import {
  Draggable, DraggableProvided, DraggableStateSnapshot,
  Droppable, DroppableProvided, DroppableStateSnapshot,
} from 'react-beautiful-dnd'

import { CardBase, Card, Suit, Rank } from 'lib/zpy/cards.ts'

import { CardID } from "components/zpy/common.ts"
import { ZCard } from "components/zpy/Card.tsx"
import { CardFan } from "components/zpy/CardFan.tsx"

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

export class HandArea extends React.Component<HandArea.Props, {}> {
  constructor(props: HandArea.Props) {
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
                  onClick={ev => this.props.onSelect(id, ev)}
                >
                  {(() => {
                    if (this.props.multidrag?.id === id) {
                      return <CardFan
                        width={100}
                        clip={0.25}
                        selected={this.props.selected.has(id)}
                        pile={this.props.multidrag.pile}
                      />;
                    }
                    let should_vanish = this.props.multidrag !== null &&
                                        this.props.selected.has(id);
                    // the current rendering policy is to dim the cards that
                    // are part of a multigrab.  it's possible to just have
                    // them disappear completely (by returning null here), but
                    // this causes slightly pathological drag behavior.
                    //
                    // to apply that policy anyway, get rid of the always-
                    // passing true condition in onDragEnd()'s dst_index
                    // conversion logic.
                    return <ZCard
                      card={cb}
                      width={100}
                      clip={0.25}
                      selected={this.props.selected.has(id) && !should_vanish}
                      dim={should_vanish ? 0.6 : null}
                    />;
                  })()}
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

export namespace HandArea {

export type Props = {
  droppableId: string;
  cards: CardID[];
  selected: Set<string>;
  multidrag: null | {
    id: string;
    pile: CardBase[];
  };
  onSelect: (id: string, ev: React.MouseEvent | React.TouchEvent) => void;
};

}
