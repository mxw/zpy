import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { withRouter, BrowserRouter as Router, Switch, Route } from 'react-router-dom';

import * as Session from 'server/session.ts';

import { Home } from 'components/zpy/Home.tsx';
import { Game } from 'components/zpy/Game.tsx';

import { escape_backslashes } from 'utils/string.ts';

ReactDOM.render(
  <Router>
    <Switch>
      <Route exact path="/">
        <Home/>
      </Route>
      <Route
        path={`/zpy/:game_id(${escape_backslashes(Session.regex.source)})`}
        render={({match}) =>
          <Game
            path="zpy"
            id={match.params.game_id}
            nick="strong sad"
          />
        }
      />
    </Switch>
  </Router>,
  document.getElementById("example")
);
