/*
 * game message area
 */
import * as React from 'react'

import * as P from 'protocol/protocol.ts'

import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import { EngineCallbacks } from 'components/zpy/common.ts'

import * as options from 'options.ts'
import assert from 'utils/assert.ts'


export class MessageArea extends React.Component<
  MessageArea.Props,
  MessageArea.State
> {
  constructor(props: MessageArea.Props) {
    super(props);

    this.onUpdate = this.onUpdate.bind(this);

    this.state = {messages: []};

    this.props.funcs.subscribeUpdate(this.onUpdate);
  }

  onUpdate(effect: ZPYEngine.Effect) {
    this.setState((state, props) => ({
      messages: [
        ...state.messages,
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

    return <div className={`message-container ${visibility}`}>
      <div className="message-title">
        game log
      </div>
      <div className="messages">
        {this.state.messages.map((msg, i) =>
          <p key={'' + i}>{msg}</p>
        )}
      </div>
    </div>
  }
}

export namespace MessageArea {

export type Props = {
  zpy: ZPYEngine.State;
  users: P.User[];
  hidden: boolean;

  funcs: EngineCallbacks<any>;
};

export type State = {
  messages: string[];
};

}
