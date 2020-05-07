/*
 * wrapper around all routeable components which ensures that a session has
 * been established
 */
import * as React from "react"
import axios from "axios"

import { SessionID } from 'server/types.ts'


export class WithSession extends React.Component<
  WithSession.Props,
  WithSession.State
> {
  constructor(props: WithSession.Props) {
    super(props);

    this.state = {session_id: null};
  }

  render() {
    if (this.state.session_id === null) {
      (async () => {
        const response = await axios.get('/api/session');
        this.setState({session_id: response.data});
      })();
      return null;
    }
    return this.props.children;
  }
}

export namespace WithSession {

export type Props = {
  children?: any;
};

export type State = {
  session_id: null | SessionID;
};

}
