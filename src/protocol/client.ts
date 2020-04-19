import {isOk, isErr} from "utils/result.ts"

import * as P from "protocol/protocol.ts"
import {Engine} from "protocol/engine.ts"

import assert from "assert"

export class GameClient<
  Config,
  Intent,
  State,
  Action,
  ClientState,
  Effect,
  UpdateError,
  Eng extends Engine<
    Config,
    Intent,
    State,
    Action,
    ClientState,
    Effect,
    UpdateError
  >
> {
  engine: Eng;
  socket: WebSocket;

  // the client engine state; null iff waitState is "pending-reset"
  state: null | ClientState = null;

  // whether we are synchronized w/ the server.
  //
  // interpretation:
  //   - pending-reset: we are totally desynced and waiting for a reset reply
  //   - sync: we are up to date
  //   - pending-update: we are waiting for a reply to an update request, but
  //                     otherwise synchronized
  //   - disconnect: what it says on the tin
  //
  // legal transitions:
  //        +------------+--------------+
  //        |            |              |
  //        v            |              |
  //  pending-reset --> sync <--> pending-update --> disconnect
  //
  waitState: "pending-reset" | "sync" | "pending-update" | "disconnect";

  // all users on the server; empty iff waitState is "pending-reset"
  users: P.User[] = [];

  // this client's user; null iff waitState is "pending-reset"
  me: null | P.User = null;

  // the next unused transaction id
  next_tx: P.TxID = 0;

  // update requests that are outstanding
  pending: Record<P.TxID, {
    intent: Intent;
    predicted: boolean
    eff: null | Effect; // null iff predicted is false
  }> = {};

  // callbacks for react to use
  onClose: null | ((cl: this) => void) = null;
  onUpdate: null | ((cl: this, e: Effect | P.ProtocolAction) => void) = null;
  onReset: null | ((cl: this) => void) = null;

  // connect to the given gameId with the appropriate engine
  constructor(engine: Eng, gameId: string) {
    this.engine = engine;
    this.socket = new WebSocket(
      "ws://" + document.location.host + "/game/" + gameId + "/"
    );
    this.waitState = "pending-reset";

    this.socket.onopen = () => {
      // on connect we must send hello
      this.socket.send(JSON.stringify({
        verb: "req:hello",
        nick: "jgriego"
      }));
    };

    this.socket.onmessage = (ev: MessageEvent) => {
      let payload = JSON.parse(ev.data);

      let ServerMessage = P.ServerMessage(
        this.engine.ClientState,
        this.engine.Effect(this.state),
        this.engine.UpdateError
      );

      P.on_decode(ServerMessage, payload, (
        msg: P.ServerMessage<ClientState, Effect, UpdateError>
      ) => {
        switch (msg.verb) {
          case "hello":
            this.me = msg.you;
            this.socket.send(JSON.stringify({
              verb: "req:reset"
            }));
            break;
          case "bye":
            this.socket.close();
            this.onClose?.(this);
            break
          case "reset":
            this.state = msg.state;
            this.waitState = "sync";
            this.users = msg.who;
            this.onReset?.(this);
            break;
          case "update": {
            assert(this.state !== null);
            assert(this.waitState === "pending-update" ||
                   this.waitState === "sync");
            if (msg.tx !== null && msg.tx in this.pending) {
              let pending = this.pending[msg.tx];
              delete this.pending[msg.tx];
              if (pending.predicted) {
                // don't bother processing this update if we predicted it
                break;
              }
            }
            this.manifest(msg.effect.eff);
            break;
          }
        }
      });
    }
  }

  // process an effect either as predicted or as the server instructs
  manifest(effect: Effect | P.ProtocolAction) {
    let result = this.engine.apply_client(this.state, effect, this.me);

    if (isErr(result)) {
      console.error(result.err);
      assert(false);
    } else {
      this.state = result.ok;
      this.waitState === "sync";
      this.onUpdate?.(this, effect);
    }
  }

  // attempt to carry out an intent; synchronizing this state w/ the server
  attempt(intent: Intent) {
    // TODO we could queue updates locally if we're desynced
    // but it's not necessary for ZPY--it's easier to pretend it can't happen
    assert(this.waitState === "sync");
    assert(this.state !== null);

    let tx = this.next_tx++;
    let predicted = this.engine.predict(this.state, intent, this.me);

    if (predicted === null) {
      this.waitState === "pending-update"
    } else if (isErr(predicted)) {
      console.error(predicted.err)
      assert(false);
      return
    } else {
      this.manifest(predicted.ok);
    }

    this.pending[tx] = {
      predicted: (predicted !== null),
      intent: intent,
      eff: (predicted as null | {ok: Effect})?.ok
    };

    this.socket.send(JSON.stringify({
      verb: "req:update",
      tx: tx,
      intent: intent,
    }));
  }
}
