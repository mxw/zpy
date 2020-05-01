/*
 * Cookie utilities.
 */

/*
 * https://gist.github.com/rendro/525bbbf85e84fa9042c2#gistcomment-2784930
 */
export function parse(cookies: string): Record<string, string> {
  return cookies
    .split(';')
    .reduce<Record<string, string>>((res, c) => {
      const [key, val] = c.trim().split('=').map(decodeURIComponent)
      try {
        return Object.assign(res, { [key]: '' + JSON.parse(val) })
      } catch (e) {
        return Object.assign(res, { [key]: val })
      }
    }, {});
}
