import express from "express"
import * as WebSocket from "ws"
import * as Http from "http"
import { GameServer } from "./server.ts"
import { CounterEngine } from "./trivial-engine.ts"
import * as Session from "./session.ts"
import CookieParser from "cookie-parser"

let app = express();

app.use('/static', express.static("assets"))
app.use('/static/js', express.static("dist/ui"))
app.use(CookieParser());
app.use(Session.middleware);

let server = Http.createServer(app);
let gs = new GameServer(CounterEngine, server);

var activeGame: string | null = null;

app.get('/', (req, res) => {
  let r = req as (typeof req & {session: Session.Session});
  res.send(activeGame);
});

server.listen(8080, () => {
  console.log("listening on port 8080");

  activeGame = gs.beginGame(undefined, "jgriego");
  console.log(activeGame);
})
