import * as CardEngine from "lib/sandbox/engine.ts"
import { GameClient } from "protocol/client.ts"

export type State = CardEngine.ClientState;
export type Client = GameClient<
  CardEngine.Config,
  CardEngine.Intent,
  CardEngine.State,
  CardEngine.Action,
  CardEngine.ClientState,
  CardEngine.Effect,
  CardEngine.UpdateError,
  typeof CardEngine
>;


export function createGame(gameId: string): Client {
  return new GameClient(CardEngine, gameId);
}

