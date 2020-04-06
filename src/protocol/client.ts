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
  state: null | ClientState = null;
  waitState: "pending-reset" | "sync" | "pending-update" | "disconnect";
  users: P.User[] = [];
  me: null | P.User = null;
  nextTxId: P.TxId = 0;
  pending: Record<
    P.TxId,
    {
      intent: Intent,
      predicted: boolean,
      eff: null | Effect
    }
  > = {};

  onClose:  null | ((client: this) => void) = null;
  onUpdate: null | ((client: this, e: Effect | P.ProtocolAction) => void) = null;
  onReset:  null | ((client: this) => void) = null;

  constructor(engine: Eng, gameId: string) {
    this.engine = engine;
    this.socket = new WebSocket(
      "ws://" + document.location.host + "/game/" + gameId + "/"
    );
    this.waitState = "pending-reset";

    this.socket.onopen = () => {
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

      if (tServerMessage.is(payload)) {
        switch (payload.verb) {
          case "hello":
            this.me = payload.you;
            this.socket.send(JSON.stringify({
              verb: "req:reset"
            }));
            break;
          case "bye":
            this.socket.close();
            if (this.onClose !== null) {
              this.onClose(this);
            }
            break
          case "reset":
            this.state = payload.state;
            this.waitState = "sync";
            this.users = payload.who;
            if (this.onReset !== null) {
              this.onReset(this);
            }
            break;
          case "update": {
            assert(this.state !== null);
            if (payload.tx !== null && payload.tx in this.pending) {
              let pending = this.pending[payload.tx];
              delete this.pending[payload.tx];
              if (pending.predicted) {
                // don't bother processing this update if we predicted it
                break;
              }
            }
            this.processEffect(payload.effect);
            break;
          }
        }
      }
    }
  }

  processEffect(effect: Effect | P.ProtocolAction) {
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
      if (this.onUpdate !== null) {
        this.onUpdate(this, effect);
      }
    }
  }

  attempt(intent: Intent) {
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
      this.processEffect(predicted);
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
