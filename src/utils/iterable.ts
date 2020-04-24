/*
 * Iterable utilities.
 */

export function choose<T>(iterable: Iterable<T>): null | T {
  for (let item of iterable) return item;
  return null;
}
