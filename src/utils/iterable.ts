/*
 * Iterable utilities.
 */

export function choose<T>(iterable: Iterable<T>): null | T {
  for (let item of iterable) return item;
  return null;
}

export function* range(start: number, end: number): Generator<number, void> {
  for (let i = start; i < end; ++i) yield i;
}
