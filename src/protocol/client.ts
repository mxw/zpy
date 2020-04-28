import {isOK, isErr} from "utils/result.ts"

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

  // the client engine state; null iff status is "pending-reset"
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
  status: "pending-reset" | "sync" | "pending-update" | "disconnect";

  // all users on the server; empty iff status is "pending-reset"
  users: P.User[] = [];

  // this client's user; null iff status is "pending-reset"
  me: null | P.User = null;

  // the next unused transaction id
  next_tx: P.TxID = 0;

  // update requests that are outstanding
  pending: Record<P.TxID, {
    intent: Intent;
    predicted: boolean
    eff: null | Effect; // null iff predicted is false
  }> = {};

  onClose: null | ((cl: this) => void);
  onReset: null | ((cl: this) => void);
  onUpdate: null | ((cl: this, e: Effect | P.ProtocolAction) => void);

  // connect to the given gameId with the appropriate engine
  constructor(
    engine: Eng,
    url_pref: string,
    game_id: string,
    nick: string,
  ) {
    this.engine = engine;
    this.socket = new WebSocket(
      `ws://${document.location.host}/${url_pref}/${game_id}/`
    );
    this.status = "pending-reset";

    this.socket.onopen = () => {
      // on connect we must send hello
      this.socket.send(JSON.stringify(
        P.RequestHello.encode({
          verb: "req:hello",
          nick: nick,
        })
      ));
    };

    this.socket.onmessage = (ev: MessageEvent) => {
      let payload = JSON.parse(ev.data);

      let ServerMessage = P.ServerMessage(
        this.engine.ClientState(this.state),
        this.engine.Effect(this.state),
        this.engine.UpdateError
      );

      P.on_decode(ServerMessage, payload, (
        msg: P.ServerMessage<ClientState, Effect, UpdateError>
      ) => {
        switch (msg.verb) {
          case "hello":
            this.me = msg.you;
            this.socket.send(JSON.stringify(
              P.RequestReset.encode({
                verb: "req:reset"
              })
            ));
            break;

          case "bye":
            this.socket.close();
            this.onClose?.(this);
            break

          case "reset":
            this.state = msg.state;
            this.status = "sync";
            this.users = msg.who;
            this.onReset?.(this);
            break;

          case "update": {
            assert(this.state !== null);
            assert(this.status === "pending-update" ||
                   this.status === "sync");

            if (msg.tx !== null && msg.tx in this.pending) {
              let pending = this.pending[msg.tx];
              delete this.pending[msg.tx];
              if (pending.predicted) {
                // don't bother processing this update if we predicted it
                break;
              }
            }

            let result = this.engine.apply_client(
              this.state,
              msg.effect.eff,
              this.me
            );

            if (isErr(result)) {
              console.error(result.err);
              assert(false);
            } else {
              assert(isOK(result));
              this.state = result.ok;
              this.status === "sync";
              this.onUpdate?.(this, msg.effect.eff);
            }
            break;
          }
        }
      });
    }
  }

  // attempt to carry out an intent; synchronizing this state w/ the server
  attempt(intent: Intent): null | UpdateError {
    // TODO we could queue updates locally if we're desynced
    // but it's not necessary for ZPY--it's easier to pretend it can't happen
    assert(this.status === "sync");
    assert(this.state !== null);

    const tx = this.next_tx++;
    const predicted = this.engine.predict(this.state, intent, this.me);

    if (predicted === null) {
      this.status === "pending-update"
    } else if (isErr(predicted)) {
      return predicted.err;
    } else {
      assert(isOK(predicted));

      this.state = predicted.ok.state;
      this.onUpdate?.(this, predicted.ok.effect);
    }

    this.pending[tx] = {
      predicted: (predicted !== null),
      intent: intent,
      eff: (predicted as null | {ok: {effect: Effect}})?.ok?.effect
    };

    const RequestUpdate = P.RequestUpdate(this.engine.Intent(this.state));

    this.socket.send(JSON.stringify(
      RequestUpdate.encode({
        verb: "req:update",
        tx: tx,
        intent: intent,
      })
    ));
  }
}
