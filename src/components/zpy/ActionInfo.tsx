/*
 * display for players' game actions: bids, plays, and readys
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { Play } from 'lib/zpy/trick.ts'
import { ZPY } from 'lib/zpy/zpy.ts'
import { State as Z } from 'lib/zpy/engine.ts'

import { strict as assert} from 'assert'


export class ActionInfo extends React.Component<
  ActionInfo.Props,
  ActionInfo.State
> {
  constructor(props: ActionInfo.Props) {
    super(props);
  }

  render() {
    return <div className="action-info">
    </div>;
  }
}

export namespace ActionInfo {

export type Props = {
  phase: ZPY.Phase;
  user: P.User;

  bids: Z['bids'];
  play: Z['plays'][P.UserID];

  ready: boolean;
  leader: boolean;
  winning: boolean;
};

export type State = {
};

}
