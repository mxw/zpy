/*
 * types and helpers that can be shared by both client and server
 */

export type SessionID = string;

export interface Session {
  id: SessionID;
  token: string;
}

export const session_regex =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
