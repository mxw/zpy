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
 * session inactivity allowace, in ms
 */
export const session_expiry: number = 1000 * 60 * 60 * 24 * 365; // 1 year

/*
 * game inactivity allowance, in ms
 */
export const game_expiry: number = 1000 * 60 * 60; // 1 hour

/*
 * server websocket ping interval, in ms
 */
export const ping_interval: number = 1000 * 30; // 30 seconds

/*
 * client initial reconnect delay, in ms
 */
export const reconnect_delay: number = 500; // 0.5 seconds

/*
 * maximum number of players a game can support
 */
export const max_players: number = 14;
