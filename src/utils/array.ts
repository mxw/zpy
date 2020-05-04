/*
 * Array utilities.
 */

/*
 * Fill an array with `n` copies of `val`, or val() if `val` is a function.
 */
export function array_fill<T>(
  n: number,
  val: T | (() => T)
): T[] {
  const a : T[] = [];
  a.length = n;
  if (val instanceof Function) {
    a.fill(val());
  } else {
    a.fill(val);
  }
  return a;
}

/*
 * Do a Fisher-Yates shuffle on `arr`, both modifying it and returning it.
 */
export function array_shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; --i) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/*
 * Functional map for objects.
 */
export function o_map<O, K extends keyof O, R>(
  o: O,
  fn: (k: string, v: O[K]) => R,
) {
  return Object.keys(o).map((k: string) => fn(k, o[k as K]));
}
