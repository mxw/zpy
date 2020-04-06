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
  nextTxId: P.TxId = 0;

  // update requests that are outstanding
  pending: Record<P.TxId, {
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
      let tServerMessage = P.tServerMessage(
        this.engine.tClientState,
        this.engine.tEffect,
        this.engine.tUpdateError
      );

      if (!tServerMessage.is(payload)) return;

      switch (payload.verb) {
        case "hello":
          this.me = payload.you;
          this.socket.send(JSON.stringify({
            verb: "req:reset"
          }));
          break;
        case "bye":
          this.socket.close();
          this.onClose?.(this);
          break
        case "reset":
          this.state = payload.state;
          this.waitState = "sync";
          this.users = payload.who;
          this.onReset?.(this);
          break;
        case "update": {
          assert(this.state !== null);
          assert(this.waitState === "pending-update" ||
                 this.waitState === "sync");
          if (payload.tx !== null && payload.tx in this.pending) {
            let pending = this.pending[payload.tx];
            delete this.pending[payload.tx];
            if (pending.predicted) {
              // don't bother processing this update if we predicted it
              break;
            }
          }
          this.manifest(payload.effect);
          break;
        }
      }
    }
  }

  // process an effect either as predicted or as the server instructs
  manifest(effect: Effect | P.ProtocolAction) {
    let result = this.engine.apply_client(
      this.state,
      effect
    );

    if (this.engine.tUpdateError.is(result)) {
      console.error(result);
      assert(false);
    } else {
      this.state = result;
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

    let txId = this.nextTxId;
    this.nextTxId += 1;
    let predicted = this.engine.predict(this.state, intent);

    if (this.engine.tUpdateError.is(predicted)) {
      console.error(predicted)
      assert(false);
      return
    } else if (predicted === null) {
      this.waitState === "pending-update"
    } else {
      this.manifest(predicted);
    }

    this.pending[txId] = {
      predicted: (predicted !== null),
      intent: intent,
      eff: predicted
    };

    this.socket.send(JSON.stringify({
      verb: "req:update",
      tx: txId,
      intent: intent,
    }));
  }
}
