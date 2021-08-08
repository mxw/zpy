/*
 * interactive splay of cards
 */
import * as React from "react"
import {
  Draggable, DraggableProvided, DraggableStateSnapshot,
  Droppable, DroppableProvided, DroppableStateSnapshot,
} from 'react-beautiful-dnd'

import { CardBase, Suit, Rank } from 'lib/zpy/cards'

import { CardID } from "components/zpy/common"
import { CardShape } from "components/zpy/CardImage"
import { Card } from "components/zpy/Card"
import { CardFan } from "components/zpy/CardFan"

import assert from 'utils/assert'


export const card_width = 100;
const clip_pct = 0.25;

///////////////////////////////////////////////////////////////////////////////

export class Area extends React.Component<Area.Props, {}> {
  constructor(props: Area.Props) {
    super(props);
  }

  render() {
    const classes = ["cardarea", ...(this.props.classes ?? [])].join(' ');

    return <Droppable
      droppableId={this.props.droppableId}
      direction="horizontal"
    >
      {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
        <div
          ref={provided.innerRef}
          className={classes}
          {...provided.droppableProps}
        >
          {this.props.children}
          {provided.placeholder}
        </div>
      )}
    </Droppable>;
  }
}

export namespace Area {

export type Props = {
  droppableId: string;
  classes?: string[];
  children?: any;
};

}

///////////////////////////////////////////////////////////////////////////////

export class EmptyArea extends React.Component<EmptyArea.Props, {}> {
  constructor(props: EmptyArea.Props) {
    super(props);
  }

  render() {
    const text = this.props.text ?? 'click or drag cards to put them here';

    return <Area classes={["empty"]} {...this.props}>
      <CardShape
        width={card_width}
        style={{
          backgroundColor: 'lightgrey',
          border: 'solid grey 1px',
        }}
      >
        <div className="cardarea-text">{text}</div>
      </CardShape>
    </Area>;
  }
}

export namespace EmptyArea {

export type Props = {
  droppableId: string;
  text?: null | string;
};

}

///////////////////////////////////////////////////////////////////////////////

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

export class CardArea extends React.Component<CardArea.Props, {}> {
  constructor(props: CardArea.Props) {
    super(props);
  }

  render() {
    if (this.props.cards.length === 0) {
      return <EmptyArea droppableId={this.props.droppableId} />;
    }

    return <Area droppableId={this.props.droppableId}>
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
              onClick={ev => this.props.onClick(id, ev)}
            >
              {(() => {
                if (this.props.multidrag?.id === id) {
                  return <CardFan
                    width={card_width}
                    xclip={clip_pct}
                    selected={this.props.selected.has(id)}
                    pile={this.props.multidrag.pile}
                  />;
                }
                const should_vanish = this.props.multidrag !== null &&
                                      this.props.selected.has(id);
                // the current rendering policy is to dim the cards that
                // are part of a multigrab.  it's possible to just have
                // them disappear completely (by returning null here), but
                // this causes slightly pathological drag behavior.
                //
                // to apply that policy anyway, get rid of the always-
                // passing true condition in onDragEnd()'s dst_index
                // conversion logic.
                return <Card
                  card={cb}
                  width={card_width}
                  xclip={clip_pct}
                  selected={this.props.selected.has(id) && !should_vanish}
                  dim={should_vanish ? 0.6 : null}
                />;
              })()}
            </div>
          )}
        </Draggable>
      ))}
    </Area>;
  }
}

export namespace CardArea {

type OnClickCard = (
  id: string,
  ev: React.MouseEvent | React.TouchEvent
) => void;

export type Props = {
  droppableId: string;
  cards: CardID[];
  selected: Set<string>;
  multidrag: null | {
    id: string;
    pile: CardBase[];
  };
  onClick: OnClickCard;
};

}
