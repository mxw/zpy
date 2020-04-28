import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { withRouter, BrowserRouter as Router, Switch, Route } from 'react-router-dom';

import * as Session from 'server/session.ts';

import { Home } from 'components/zpy/Home.tsx';
import { Game } from 'components/zpy/Game.tsx';

import { escape_backslashes } from 'utils/string.ts';


class RouterDebugger_ extends React.Component {
  UNSAFE_componentWillUpdate(nextProps: any, nextState: any) {
    console.log('componentWillUpdate', nextProps, nextState);
  }
  componentDidUpdate(prevProps: any) {
    console.log('componentDidUpdate', prevProps);
  }
  render(): any { return null; }
}
const RouterDebugger = withRouter(RouterDebugger_ as any);


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
