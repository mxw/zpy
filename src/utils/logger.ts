/*
 * logger definition
 */

import * as W from 'winston'

const console_transport = new W.transports.Console({
  format: W.format.combine(
    W.format.colorize(),
    W.format.simple(),
  ),
});

const log = W.createLogger({
  level: 'info',
  format: W.format.combine(
    W.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    W.format.errors({
      stack: true
    }),
    W.format.json(),
  ),
  transports: [
    console_transport,
  ],
});

export default log;
