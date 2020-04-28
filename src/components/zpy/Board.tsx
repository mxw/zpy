/*
 * complete ZPY board
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { CardBase, Suit, Rank } from 'lib/zpy/cards.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { RoundState } from 'components/zpy/RoundState.tsx'
import { PlayArea } from 'components/zpy/PlayArea.tsx'

import { strict as assert} from 'assert'


export class Board extends React.Component<Board.Props, Board.State> {
  constructor(props: Board.Props) {
    super(props);
  }

  render() {
    return (
      <div className="board">
        <RoundState zpy={this.props.zpy} users={this.props.users} />
        <PlayArea
          phase={ZPY.Phase.KITTY}
          tr={this.props.zpy.tr}
          hand={[
            {cb: new CardBase(Suit.DIAMONDS, Rank.K), id: '0'},
            {cb: new CardBase(Suit.DIAMONDS, Rank.A), id: '1'},
            {cb: new CardBase(Suit.SPADES, 4), id: '2'},
            {cb: new CardBase(Suit.SPADES, 7), id: '3'},
            {cb: new CardBase(Suit.HEARTS, Rank.Q), id: '4'},
            {cb: new CardBase(Suit.HEARTS, Rank.Q), id: '5'},
            {cb: new CardBase(Suit.TRUMP, Rank.B), id: '6'},
          ]}
          kitty={[
            {cb: new CardBase(Suit.CLUBS, 10), id: '7'},
            {cb: new CardBase(Suit.CLUBS, 2), id: '8'},
          ]}
        />
      </div>
    );
  }
}

export namespace Board {

export type Props = {
  zpy: ZPYEngine.State;
  users: P.User[];
};
export type State = {};

}
