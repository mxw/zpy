/*
 * a single card, converting a ZPY CardBase to a UI Card
 */
import * as React from "react"

import { CardBase, Suit, Rank } from 'lib/zpy/cards'

import { CardImage } from "components/zpy/CardImage"


export class Card extends React.Component<Card.Props> {
  constructor(props: Card.Props) {
    super(props);
  }

  render() {
    const {card, width, selected = false, style, ...more} = this.props;

    const suit = ((suit: Suit) => {
      switch (suit) {
        case Suit.CLUBS: return 'c';
        case Suit.DIAMONDS: return 'd';
        case Suit.SPADES: return 's';
        case Suit.HEARTS: return 'h';
        case Suit.TRUMP: return 'j';
      }
    })(card.suit);

    const rank = ((rank: Rank) => {
      switch (rank) {
        case Rank.J: return 'j';
        case Rank.Q: return 'q';
        case Rank.K: return 'k';
        case Rank.A: return '1';
        case Rank.S: return 'a';
        case Rank.B: return 'b';
        default: return '' + rank
      }
    })(card.rank);

    return <CardImage
      card={suit + rank}
      width={width}
      style={selected ? {
        ...style,
        boxShadow: "0px 0px 4px 4px rgba(63, 191, 170, 0.7)",
      } : style}
      {...more}
    />;
  }
}

export namespace Card {

export type Props = {
  card: CardBase;
  width: number;
  selected?: boolean;
  [more: string]: any;
};

}
