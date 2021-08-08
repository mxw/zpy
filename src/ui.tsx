import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { withRouter, BrowserRouter as Router, Switch, Route } from 'react-router-dom';

import { session_regex } from 'server/types';

import { WithSession } from 'components/zpy/WithSession';
import { Home } from 'components/zpy/Home';
import { Game } from 'components/zpy/Game';

import * as cookie from 'utils/cookie'

import { escape_backslashes } from 'utils/string';


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
        <WithSession>
          <Home/>
        </WithSession>
      </Route>
      <Route
        path={`/zpy/:game_id(${escape_backslashes(session_regex.source)})`}
        render={({match}) =>
          <WithSession>
            <Game
              path="zpy"
              id={match.params.game_id}
              nick={
                cookie.parse(document.cookie).nick ??
                "unnamed friend"
              }
            />
          </WithSession>
        }
      />
    </Switch>
  </Router>,
  document.getElementById("zpy")
);
