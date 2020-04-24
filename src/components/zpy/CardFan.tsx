import * as React from "react"

import { CardBase } from 'lib/zpy/cards.ts'

import { ZCard } from "components/zpy/Card.tsx"


export class CardFan extends React.Component<CardFan.Props> {
  constructor(props: CardFan.Props) {
    super(props);
  }

  render() {
    const {tail, ...props} = this.props;

    const scale = (mult: number) => props.width * (props.clip ?? 1) * mult;

    return <div
      style={{
        display: 'flex',
        width: scale(tail.length + 2),
      }}
    >
      <ZCard {...props}/>
      {tail.map((cb, i) =>
        <ZCard
          {...props}
          card={cb}
        />
      )}
    </div>;
  }
}

export namespace CardFan {

export type Props = ZCard.Props & {
  clip?: number;
  // all cards past the first
  tail: CardBase[];
};

}
