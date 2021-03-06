/*
 * assertion wrapper
 */

import assert_ from 'assert'

export default function assert(
  cond: boolean,
  msg?: string,
  ...args: any[]
) {
  if (msg) console.assert(cond, msg, ...args);
  assert_(cond);
}
