/*
 * global options
 */

/*
 * debug level; 0 to disable
 */
export const debug: number = 1;

/*
 * maximum nickname length
 */
export const nick_limit: number = 23;

/*
 * game inactivity allowance, in ms
 */
export const game_expiry: number = 1000 * 60 * 30;

/*
 * server websocket ping interval, in ms
 */
export const ping_interval: number = 1000 * 30;
