import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { withRouter, BrowserRouter as Router, Switch, Route } from 'react-router-dom';

import * as Session from 'server/session.ts';

import { WithSession } from 'components/zpy/WithSession.tsx';
import { Home } from 'components/zpy/Home.tsx';
import { Game } from 'components/zpy/Game.tsx';

import * as cookie from 'utils/cookie.ts'

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
        <WithSession>
          <Home/>
        </WithSession>
      </Route>
      <Route
        path={`/zpy/:game_id(${escape_backslashes(Session.regex.source)})`}
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
  document.getElementById("example")
);
