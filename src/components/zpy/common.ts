/*
 * common types and utilities shared by ZPY game components.
 */
import { GameClient } from 'protocol/client.ts'

import { CardBase } from "lib/zpy/cards.ts"
import * as Engine from "lib/zpy/engine.ts"

export type Client = GameClient<
  Engine.Config,
  Engine.Intent,
  Engine.State,
  Engine.Action,
  Engine.ClientState,
  Engine.Effect,
  Engine.UpdateError,
  typeof Engine
>;
export type ZPY = Engine.ClientState;

/*
 * drag-n-drop card identifier
 */
export type CardID = {
  cb: CardBase,
  id: string
};
