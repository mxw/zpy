/*
 * game persistence
 */

import * as pg from 'pg'

import assert from 'utils/assert.ts'
import log from 'utils/logger.ts'

import format = require('pg-format');
export { format };

export const pool = new pg.Pool();

export const ensure_init = async () => {
  try {
    await pool.query(`
CREATE TABLE IF NOT EXISTS sessions (
  id uuid NOT NULL,
  token char(128) NOT NULL,
  PRIMARY KEY (id)
)`
    );
    await pool.query(`
CREATE TABLE IF NOT EXISTS games (
  id uuid NOT NULL,
  config json NOT NULL,
  owner uuid NOT NULL,
  state json NOT NULL,
  ts timestamptz NOT NULL,
  PRIMARY KEY (id)
)`
    );
    await pool.query(`
CREATE TABLE IF NOT EXISTS participation (
  game uuid NOT NULL,
  principal uuid NOT NULL,
  uid int NOT NULL,
  nick varchar(64) NOT NULL,
  PRIMARY KEY (game, principal),
  FOREIGN KEY (game) REFERENCES games (id) ON DELETE CASCADE
)`
    );
    await pool.query(`
CREATE TABLE IF NOT EXISTS effect_log (
  game uuid NOT NULL,
  effect_id int NOT NULL,
  effect json NOT NULL,
  PRIMARY KEY (game, effect_id),
  FOREIGN KEY (game) REFERENCES games (id) ON DELETE CASCADE
)`
    );
  } catch (err) {
    log.error('db initialization failed: ', err);
    return;
  }
};
