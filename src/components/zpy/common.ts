/*
 * common types and utilities shared by ZPY game components.
 */
import { GameClient } from 'protocol/client.ts'

import { CardBase } from "lib/zpy/cards.ts"
import * as ZPYEngine from "lib/zpy/engine.ts"


export type Client = GameClient<
  ZPYEngine.Config,
  ZPYEngine.Intent,
  ZPYEngine.State,
  ZPYEngine.Action,
  ZPYEngine.ClientState,
  ZPYEngine.Effect,
  ZPYEngine.UpdateError,
  typeof ZPYEngine
>;

/*
 * callback table threaded through the component hierarchy
 */
export type EngineCallbacks<T> = {
  /*
   * make a game action request to the server
   */
  attempt: (
    intent: ZPYEngine.Intent,
    onUpdate: null | ((effect: ZPYEngine.Effect, ctx?: T) => void),
    onReject: null | ((ue: ZPYEngine.UpdateError, ctx?: T) => void),
    ctx?: T,
  ) => void;

  /*
   * subscribe to server updates, including ones not initiated by our player
   */
  subscribeReset: (callback: (state: ZPYEngine.ClientState) => void) => void;
  subscribeUpdate: (callback: (effect: ZPYEngine.Effect) => void) => void;

  /*
   * queue up an error to be rendered, for UI action errors that simulate game
   * action errors
   */
  queueError: (ue: ZPYEngine.UpdateError) => void;
};

/*
 * drag-n-drop card identifier
 */
export type CardID = {
  cb: CardBase,
  id: string
};
