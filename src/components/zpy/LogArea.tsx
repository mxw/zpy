/*
 * game log area
 */
import * as React from 'react'

import * as P from 'protocol/protocol'

import { ZPY } from 'lib/zpy/zpy'
import * as ZPYEngine from 'lib/zpy/engine'

import { EngineCallbacks } from 'components/zpy/common'

import * as options from 'options'
import assert from 'utils/assert'


export class LogArea extends React.Component<LogArea.Props, LogArea.State> {
  constructor(props: LogArea.Props) {
    super(props);

    this.onUpdate = this.onUpdate.bind(this);

    this.state = {log: []};

    this.props.funcs.subscribeUpdate(this.onUpdate);
  }

  onUpdate(effect: ZPYEngine.Effect) {
    if (
      !!(this.props.zpy.rules.info & ZPY.HiddenInfoRule.HIDE_PLAY) && (
        effect.kind === 'observe_lead' ||
        effect.kind === 'observe_follow'
      )
    ) {
      return;
    }
    this.setState((state, props) => ({
      log: [
        ...state.log,
        ZPYEngine.describe_effect(
          effect,
          props.zpy,
          props.users,
          {nick_only: true}
        )
      ]
    }));
  }

  render() {
    const visibility = this.props.hidden ? 'hidden' : 'visible';

    return <div className={`log-container ${visibility}`}>
      <div className="log-title">
        game log
      </div>
      <div className="log">
        {this.state.log.map((msg, i) =>
          <p key={'' + i}>{msg}</p>
        )}
      </div>
    </div>
  }
}

export namespace LogArea {

export type Props = {
  zpy: ZPYEngine.State;
  users: P.User[];
  hidden: boolean;

  funcs: EngineCallbacks<any>;
};

export type State = {
  log: string[];
};

}
