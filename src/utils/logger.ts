/*
 * logger definition
 */

import * as W from 'winston'

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
  transports: [],
});

if (process.env.NODE_ENV === 'production') {
  log.add(new W.transports.Console());
} else {
  log.add(new W.transports.Console({
    format: W.format.combine(
      W.format.colorize(),
      W.format.simple(),
    ),
  }));
}

export default log;
