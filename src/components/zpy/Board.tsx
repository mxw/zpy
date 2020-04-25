/*
 * complete ZPY board
 */
import * as React from 'react'

import { CardBase, Suit, Rank } from 'lib/zpy/cards.ts'

import { PlayArea } from 'components/zpy/PlayArea.tsx'

import { strict as assert} from 'assert'


export class Board extends React.Component<Board.Props, Board.State> {
  constructor(props: Board.Props) {
    super(props);
  }

  render() {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <PlayArea
          cards={[
            {cb: new CardBase(Suit.DIAMONDS, Rank.K), id: '0'},
            {cb: new CardBase(Suit.DIAMONDS, Rank.A), id: '1'},
            {cb: new CardBase(Suit.SPADES, 4), id: '2'},
            {cb: new CardBase(Suit.SPADES, 7), id: '3'},
            {cb: new CardBase(Suit.HEARTS, Rank.Q), id: '4'},
            {cb: new CardBase(Suit.HEARTS, Rank.Q), id: '5'},
            {cb: new CardBase(Suit.TRUMP, Rank.B), id: '6'},
          ]}
        />
      </div>
    );
  }
}

export namespace Board {

export type Props = {};
export type State = {};

}
