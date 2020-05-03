/*
 * user-facing error messaging component
 */
import * as React from 'react'

import { ZPY } from 'lib/zpy/zpy.ts'
import * as ZPYEngine from 'lib/zpy/engine.ts'

import assert from 'utils/assert.ts'


export class ErrorMessage extends React.Component<ErrorMessage.Props, {}> {
  constructor(props: ErrorMessage.Props) {
    super(props);
  }

  errorString(): string {
    const ue = this.props.error;

    const kind = (() => {
      if (ue instanceof ZPY.BadPhaseError) return "invalid play";
      if (ue instanceof ZPY.InvalidArgError) return "invalid value";
      if (ue instanceof ZPY.DuplicateActionError) return "duplicate action";
      if (ue instanceof ZPY.WrongPlayerError) return "action not allowed";
      if (ue instanceof ZPY.OutOfTurnError) return "invalid play";
      if (ue instanceof ZPY.InvalidPlayError) return "invalid play";
      return "error";
    })();
    return !!ue.msg ? `${kind}: ${ue.msg}` : kind;
  }

  render() {
    const timeout = this.props.timeout / 1000;

    return <div
      className="error-wrapper"
      style={{
        animation: `fadeinout ${timeout}s linear 1 forwards`
      }}
    >
      <div className="error">
        {this.errorString()}
      </div>
    </div>;
  }
}

export namespace ErrorMessage {

export type Props = {
  error: ZPYEngine.UpdateError;
  timeout: number;  // in ms
};

}
