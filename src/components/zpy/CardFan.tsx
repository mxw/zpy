/*
 * a fanned-out, non-interactive pile of cards
 */
import * as React from "react"

import { CardBase } from 'lib/zpy/cards.ts'

import { ZCard } from "components/zpy/Card.tsx"


export class CardFan extends React.Component<CardFan.Props> {
  constructor(props: CardFan.Props) {
    super(props);
  }

  render() {
    const {pile, ...props} = this.props;

    const scale = (mult: number) => props.width * (props.clip ?? 1) * mult;

    return <div style={{
      display: 'flex',
      width: scale(pile.length + 2),
    }}>
      {pile.map((cb, i) => <ZCard key={i} card={cb} {...props} />)}
    </div>;
  }
}

export namespace CardFan {

export type Props = {
  width: number;
  selected: boolean;
  clip?: number;
  pile: CardBase[];
  [more: string]: any;
};

}
