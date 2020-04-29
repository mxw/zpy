/*
 * complete ZPY board
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { CardBase, Suit, Rank } from 'lib/zpy/cards.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { EngineCallbacks } from 'components/zpy/common.ts'
import { RoundInfo } from 'components/zpy/RoundInfo.tsx'
import { PlayArea } from 'components/zpy/PlayArea.tsx'

import { strict as assert} from 'assert'


export class Board extends React.Component<Board.Props, Board.State> {
  constructor(props: Board.Props) {
    super(props);
  }

  render() {
    const zpy = this.props.zpy;

    return (
      <div className="board">
        <RoundInfo
          key="roundinfo"
          me={this.props.me}
          zpy={zpy}
          users={this.props.users}
        />
        <PlayArea
          key={zpy.round} // reset on every round
          me={this.props.me}
          phase={zpy.phase}
          zpy={zpy}
          funcs={this.props.funcs}
        />
      </div>
    );
  }
}

export namespace Board {

export type Props = {
  me: P.User;
  zpy: ZPYEngine.State;
  users: P.User[];

  funcs: EngineCallbacks<any>;
};

export type State = {};

}
