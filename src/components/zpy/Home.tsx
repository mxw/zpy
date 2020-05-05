/*
 * ZPY homepage: set username and create games
 */
import * as React from "react"
import { Redirect } from 'react-router-dom';
import axios from "axios"

import { GameId } from 'server/server.ts'

import 'styles/zpy/home.scss'


export class Home extends React.Component<{}, Home.State> {
  constructor(props: {}) {
    super(props);

    this.state = {
      pending: false,
      game_id: null
    };
  }

  renderNewGameButton() {
    if (this.state.pending) {
      return <div className="create-game waiting">waiting...</div>;
    }

    return <div
      className="create-game"
      onClick={async () => {
        const response = await axios.post('/api/new_game');
        this.setState((state, props) => ({...state, game_id: response.data}));
      }}
    >
      new game
    </div>;
  }

  render() {
    if (this.state.game_id !== null) {
      return <Redirect push to={`/zpy/${this.state.game_id}`} />;
    }
    return <div className="home">
      <div className="logo">
        <img
          className="tractor-icon"
          src="/static/png/icons/tractor.png"
        />
      </div>
      <div className="main">
        <p>click here to create a game:</p>
        {this.renderNewGameButton()}
        <p>you can share the URL of the game to invite friends</p>
      </div>
      <div className="about">
        <p>
          ZPY is an online implementation of the Chinese playing card game
          "zhao peng you", a.k.a. "找朋友", "finding friends", "拖拉机", or
          "tractor".  it is the fluid partnership variant of the game
          outlined <a href="https://en.wikipedia.org/wiki/Sheng_ji">here</a>.
        </p>
        <p>
          ZPY was made by <a href="https://github.com/mxw/">max wang</a>.
        </p>
        <p>
          ZPY is currently in <b><i>beta</i></b>, so expect occasional
          disruptions as issues are fixed live.
        </p>
      </div>
    </div>;
  }
}

export namespace Home {

export type State = {
  pending: boolean;
  game_id: null | GameId;
};

}
