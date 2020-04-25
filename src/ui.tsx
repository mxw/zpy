import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {BrowserRouter as Router, Switch, Route} from 'react-router-dom';

import { Home } from 'components/Home.tsx';

ReactDOM.render(
  <Router>
    <Switch>
      <Route path="/">
        <Home/>
      </Route>
    </Switch>
  </Router>,
  document.getElementById("example")
);
