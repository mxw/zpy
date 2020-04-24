import * as React from "react"

import { CardBase, Suit, Rank } from 'lib/zpy/cards.ts'

import { Card as UICard, CardProps as UICardProps } from "components/Card.tsx"


export class ZCard extends React.Component<ZCard.Props> {
  constructor(props: ZCard.Props) {
    super(props);
  }

  render() {
    const {card, width, selected, style, ...more} = this.props;

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

    return <UICard
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

export namespace ZCard {

export type Props = {
  card: CardBase;
  width: number;
  selected: boolean;
  [more: string]: any;
};

}
