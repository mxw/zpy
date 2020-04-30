/*
 * all score metadata, including ranks and points
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { CardBase } from 'lib/zpy/cards.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import { State as Z } from 'lib/zpy/engine.ts'

import { strict as assert} from 'assert'


export class ScoreInfo extends React.Component<ScoreInfo.Props, {}> {
  constructor(props: ScoreInfo.Props) {
    super(props);
  }

  render() {
    return <div className="score-info">
    </div>;
  }
}

export namespace ScoreInfo {

export type Props = {
  phase: ZPY.Phase;
  user: P.User;

  rank_meta: Z['ranks'][P.UserID];
  points: Z['points'][P.UserID];
};

}
