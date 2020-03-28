/*
 * General utilities.
 */

/*
 * Fill an array with `n` copies of `val`, or val() if `val` is a function.
 */
export function array_fill<T>(n: number, val: T): T[] {
  let a : T[] = [];
  a.length = n;
  if (val instanceof Function) {
    a.fill(val());
  } else {
    a.fill(val);
  }
  return a;
}

/*
 * Color text.
 */
export namespace ansi {
  export const BLACK = '\u001b[30m';
  export const RED = '\u001b[31m';
  export const GREEN = '\u001b[32m';
  export const YELLOW = '\u001b[33m';
  export const BLUE = '\u001b[34m';
  export const MAGENTA = '\u001b[35m';
  export const CYAN = '\u001b[36m';
  export const WHITE = '\u001b[37m';
  export const RESET = '\u001b[0m';
}
