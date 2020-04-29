/*
 * ZPY homepage: set username and create games
 */
import * as React from "react"
import { Redirect } from 'react-router-dom';
import axios from "axios"

import { GameId } from 'server/server.ts'

import 'styles/zpy/zpy.scss'


export class Home extends React.Component<{}, Home.State> {
  constructor(props: {}) {
    super(props);

    this.state = {game_id: null};
  }

  render() {
    if (this.state.game_id === null) {
      (async () => {
        const response = await axios.post('/api/new_game');
        this.setState((state, props) => ({...state, game_id: response.data}));
      })();
      return <div>waiting</div>;
    }

    return <Redirect push to={`/zpy/${this.state.game_id}`}/>;
  }
}

export namespace Home {

export type State = {
  game_id: null | GameId;
};

}
