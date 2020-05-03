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

  // websocket url
  readonly sock_url: string;

  // exponential backoff delay for reconnecting the websocket; in milliseconds
  reconnect_delay: number = 125;

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

  // the client engine state; null iff status is "pending-reset"
  state: null | ClientState = null;

  // all users on the server; empty iff status is "pending-reset"
  users: P.User[] = [];

  // this client's user; null iff status is "pending-reset"
  me: null | P.User = null;

  // our user's last known nick
  nick: string;

  // the next unused transaction id
  next_tx: P.TxID = 0;

  // update requests that are outstanding, along with callbacks to be invoked
  // upon their completion
  pending: Record<P.TxID, {
    predicted: boolean;
    ctx: any,
    onUpdate: null | ((
      cl: GameClient<
        Config, Intent, State, Action,
        ClientState, Effect, UpdateError, Eng
      >,
      cm: P.Command<Effect>,
      ctx: any
    ) => void);
    onReject: null | ((
      cl: GameClient<
        Config, Intent, State, Action,
        ClientState, Effect, UpdateError, Eng
      >,
      ue: UpdateError,
      ctx: any
    ) => void);
  }> = {};

  // callbacks for react
  onClose: null | ((cl: this) => void);
  onReset: null | ((cl: this) => void);
  onUpdate: null | ((cl: this, cm: P.Command<Effect>) => void);

  /*
   * connect to :url_pref/:game_id with the appropriate engine
   */
  constructor(
    engine: Eng,
    url_pref: string,
    game_id: string,
    nick: string,
  ) {
    this.engine = engine;

    const ws = document.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.sock_url = `${ws}//${document.location.host}/${url_pref}/${game_id}/`;
    this.nick = nick;

    this.connect();
  }

  connect() {
    this.socket = new WebSocket(this.sock_url);
    this.status = "pending-reset";

    this.socket.onopen = () => {
      // on connect we must send hello
      this.socket.send(JSON.stringify(
        P.RequestHello.encode({
          verb: "req:hello",
          nick: this.nick,
        })
      ));
    };

    this.socket.onclose = (e: CloseEvent) => {
      this.status = "pending-reset";
      this.state = null;
      this.users = null;
      this.me = null;

      if (e.code === 1000) return;

      setTimeout(() => {
        // exponential backoff
        this.reconnect_delay *= 2;
        this.connect();
      }, this.reconnect_delay);
    };

    this.socket.onmessage = (ev: MessageEvent) => {
      const payload = JSON.parse(ev.data);

      const ServerMessage = P.ServerMessage(
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
            this.reconnect_delay = 125;
            this.state = msg.state;
            this.users = msg.who;
            this.status = "sync";
            this.onReset?.(this);
            break;

          case "update": {
            assert(this.state !== null);
            assert(this.status === "pending-update" ||
                   this.status === "sync");

            this.update(msg.tx, msg.command);
            break;
          }

          case "reject":
            assert(this.state !== null);
            assert(this.status === "pending-update" ||
                   this.status === "sync");

            const cb = this.pending[msg.tx];
            cb?.onReject?.(this, msg.reason, cb?.ctx);
            delete this.pending[msg.tx];
            break;
        }
      },
      (e: any) => console.error(P.draw_error(e), payload));
    }
  }

  close() {
    this.socket.close(1000);
  }

  /*
   * process an update message from the server
   */
  update(tx: null | P.TxID, command: P.Command<Effect>) {
    if (tx !== null &&
        tx in this.pending &&
        this.pending[tx].predicted) {
      // don't bother processing this update if we predicted it
      delete this.pending[tx];
      return;
    }

    if (command.kind === 'protocol') {
      const pa: P.ProtocolAction = command.effect;

      switch (pa.verb) {
        case 'user:join':
          this.users.push(pa.who);
          break;
        case 'user:rejoin':
          // this does nothing because currently parts never occur
          break;
        case 'user:part':
          this.users = this.users.filter(u => u.id !== pa.id);
          break;
        case 'user:nick':
          const user = this.users.find(u => u.id === pa.who.id);
          if (user) this.nick = user.nick = pa.who.nick;
          break;
      }
    }

    const result = this.engine.apply_client(this.state, command, this.me);

    if (isOK(result)) {
      this.state = result.ok;
      this.status === "sync";

      if (tx in this.pending) {
        const cb = this.pending[tx];
        cb?.onUpdate?.(this, command, cb?.ctx);
        delete this.pending[tx];
      } else {
        // invoke the toplevel onUpdate for tx-less updates (typically protocol
        // actions)
        this.onUpdate?.(this, command);
      }
      return;
    }
    console.error(result.err);
    assert(false);
  }

  /*
   * attempt to carry out an intent
   *
   * onUpdate and onReject are invoked whenever the effect of `intent` is
   * applied, which might be immediately (if we can predict it), or will
   * otherwise be when the server replies back
   */
  attempt(
    intent: Intent,
    onUpdate: (cl: this, cm: P.Command<Effect>, ctx: any) => void = null,
    onReject: (cl: this, ue: UpdateError, ctx: any) => void = null,
    ctx?: any,
  ) {
    // TODO we could queue updates locally if we're desynced
    // but it's not necessary for ZPY--it's easier to pretend it can't happen
    assert(this.status === "sync");
    assert(this.state !== null);

    const tx = this.next_tx++;
    const predicted = this.engine.predict(this.state, intent, this.me);

    if (predicted === null) {
      this.status === "pending-update"
    } else if (isErr(predicted)) {
      return onReject?.(this, predicted.err, ctx);
    } else {
      assert(isOK(predicted));

      this.state = predicted.ok.state;
      onUpdate?.(this, {
        kind: 'engine',
        effect: predicted.ok.effect
      }, ctx);
    }

    this.pending[tx] = {
      predicted: (predicted !== null),
      ctx, onUpdate, onReject
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
