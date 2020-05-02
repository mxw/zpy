/*
 * String utilities.
 */

/*
 * color text
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

/*
 * convert every \ to \\
 */
export function escape_backslashes(s: string): string {
  return s.replace(/\\/g, '\\\\');
}

/*
 * simple, extremely non-cryptographic numeric hash
 */
export function hash_code(s: string): number {
  let h = 0;
  for (var i = 0; i < s.length; ++i) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return h;
}

/*
 * stringify a number with an nth suffix
 */
export function nth_suffixed(n: number): string {
  const two_digits = n % 100;

  if (two_digits === 11 ||
      two_digits === 12 ||
      two_digits === 13) {
    return `${n}th`;
  }

  const one_digit = n % 10;

  if (one_digit === 1) return `${n}st`;
  if (one_digit === 2) return `${n}nd`;
  if (one_digit === 3) return `${n}rd`;
  return `${n}th`;
}

/*
 * return a plural suffix based on `count`
 */
export function plural(
  count: number,
  if_plural: string = 's',
  if_singular: string = '',
): string {
  return count === 1 ? if_singular : if_plural;
}
