import { env } from './env.js'

/**
 * Build a fully-qualified link into the web frontend from `WEB_URL` + a path (+ optional query
 * params). Centralized so every transactional email constructs links consistently and no caller
 * has to reason about trailing slashes or query encoding.
 *
 * `path` is appended to WEB_URL's full path rather than resolved via `new URL(path, base)`: a
 * root-absolute second argument would discard any path prefix on WEB_URL (e.g. a '/app' subpath
 * mount), producing broken links. `path` must always begin with '/'. Any dynamic path segment
 * (e.g. a token) must be URL-encoded by the caller before being interpolated into `path`.
 */
export const buildUrl = (path: string, params?: Record<string, string>): string => {
  const base = env.WEB_URL.replace(/\/+$/, '')
  const url = new URL(`${base}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}
