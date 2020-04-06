import * as Protocol from "./protocol.ts"
import {Engine} from "./engine.ts"
import assert from "assert"

export class GameClient<Cfg, I, S, A, CS, E, UE, Eng extends Engine<Cfg, I, S, A, CS, E, UE>> {

  engine: Eng;
  socket: WebSocket;
  state: null | CS;
  waitState: "pending-reset" | "sync" | "pending-update" | "disconnect";
  users: Protocol.User[];
  me: null | Protocol.User;
  nextTxId: Protocol.TxId;
  pending: Record<Protocol.TxId, {intent: I, predicted: boolean, eff: null| E}>;

  onClose: null | ((client: this) => void);
  onUpdate: null | ((client: this, e: E | Protocol.ProtocolAction) => void);
  onReset: null | ((client: this) => void);

  constructor(engine: Eng, gameId: string) {
    this.engine = engine;
    this.socket = new WebSocket("ws://" + document.location.host + "/game/" + gameId + "/");
    this.state = null
    this.waitState = "pending-reset";
    this.pending = {};
    this.nextTxId = 0;
    this.me = null;
    this.onClose = null;
    this.onUpdate = null;
    this.onReset = null;

    this.socket.onopen = () => {
      this.socket.send(JSON.stringify({
        verb: "req:hello",
        nick: "jgriego"
      }));
    };

    this.socket.onmessage = (ev: MessageEvent) => {
      let payload = JSON.parse(ev.data);
      let tServerMessage = Protocol.tServerMessage(
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

  processEffect(effect: E | Protocol.ProtocolAction) {
    let result = this.engine.applyClient(
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

  attempt(intent: I) {
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
