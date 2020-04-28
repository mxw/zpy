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
  attempt: (
    intent: ZPYEngine.Intent,
    onUpdate: (effect: ZPYEngine.Effect, ctx?: T) => void,
    onReject: (ue: ZPYEngine.UpdateError, ctx?: T) => void,
    ctx?: T,
  ) => void;

  subscribeReset: (
    callback: (state: ZPYEngine.ClientState) => void
  ) => void;
};

/*
 * drag-n-drop card identifier
 */
export type CardID = {
  cb: CardBase,
  id: string
};
