import * as React from "react"

import { CardBase, Suit, Rank } from 'lib/zpy/cards.ts'

import { Card as UICard, CardProps as UICardProps } from "components/Card.tsx"


export class ZPYCard extends React.Component<ZPYCard.Props> {
  constructor(props: ZPYCard.Props) {
    super(props);
  }

  render() {
    let suit = ((suit: Suit) => {
      switch (suit) {
        case Suit.CLUBS: return 'c';
        case Suit.DIAMONDS: return 'd';
        case Suit.SPADES: return 's';
        case Suit.HEARTS: return 'h';
        case Suit.TRUMP: return 'j';
      }
    })(this.props.card.suit);

    let rank = ((rank: Rank) => {
      switch (rank) {
        case Rank.J: return 'j';
        case Rank.Q: return 'q';
        case Rank.K: return 'k';
        case Rank.A: return '1';
        case Rank.S: return 'a';
        case Rank.B: return 'b';
        default: return '' + rank
      }
    })(this.props.card.rank);

    return <UICard
      card={suit + rank}
      width={this.props.width}
      x={this.props.x}
      y={this.props.y}
      position={this.props.position}
      style={this.props.selected ? {
        boxShadow: "0px 0px 4px 4px rgba(63, 191, 170, 0.7)",
      } : {}}
    />;
  }
}

export namespace ZPYCard {

export type Props = {
  card: CardBase;
  width: number;
  x: number;
  y: number;
  position: "absolute" | "fixed" | "relative";
  selected: boolean;
};

}
