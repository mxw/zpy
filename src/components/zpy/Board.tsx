/*
 * complete ZPY board
 */
import * as React from 'react'

import * as P from 'protocol/protocol'
import { GameId } from 'server/server'

import { CardBase, Suit, Rank } from 'lib/zpy/cards'
import { ZPY } from 'lib/zpy/zpy'
import * as ZPYEngine from 'lib/zpy/engine'

import { EngineCallbacks } from 'components/zpy/common'
import { RoundInfo } from 'components/zpy/RoundInfo'
import { PlayArea } from 'components/zpy/PlayArea'

import * as options from 'options'

import assert from 'utils/assert'


export class Board extends React.Component<Board.Props, Board.State> {
  constructor(props: Board.Props) {
    super(props);
  }

  render() {
    const zpy = this.props.zpy;

    return (
      <div className="board">
        <RoundInfo
          key="round-info"
          gid={this.props.gid}
          me={this.props.me}
          zpy={zpy}
          users={this.props.users}
          funcs={this.props.funcs}
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
  gid: GameId;
  me: P.User;
  zpy: ZPYEngine.State;
  users: P.User[];

  funcs: EngineCallbacks<any>;
};

export type State = {};

}
