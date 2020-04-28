/*
 * a fanned-out, non-interactive pile of cards
 */
import * as React from "react"

import { CardBase } from 'lib/zpy/cards.ts'

import { rem_per_px } from "components/zpy/CardImage.tsx"
import { Card } from "components/zpy/Card.tsx"


export class CardFan extends React.Component<CardFan.Props> {
  constructor(props: CardFan.Props) {
    super(props);
  }

  render() {
    const {pile, ...props} = this.props;

    const fit_width =
      // length of all card clips, plus 1px for border
      ((props.width * (props.xclip ?? 1) + 1) * pile.length) +
      // padding of the last card, plus 1px for border
      props.width * (1 - (props.xclip ?? 1)) + 1;

    return <div style={{
      display: 'flex',
      minWidth: `${fit_width * rem_per_px}rem`,
    }}>
      {pile.map((cb, i) => <Card key={i} card={cb} {...props} />)}
    </div>;
  }
}

export namespace CardFan {

export type Props = {
  width: number;
  selected?: boolean;
  xclip?: number;
  pile: CardBase[];
  [more: string]: any;
};

}
