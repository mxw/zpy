import * as React from "react";
import * as ReactDOM from "react-dom";
import {BrowserRouter as Router, Switch, Route} from "react-router-dom";

import { SessionProvider } from "./components/providers/SessionProvider.tsx"
import { Home } from "./components/Home.tsx";

ReactDOM.render(
  <SessionProvider>
    <Router>
      "hello"
      <Switch>
        <Route path="/">
          <Home/>
        </Route>
      </Switch>
    </Router>
  </SessionProvider>,
  document.getElementById("example")
);
