import type { NextFunction, Request, Response } from 'express'

/**
 * Wrapper for route handlers that funnels errors to next() for the error
 * middleware. Catches both async rejections (via .catch) and synchronous throws
 * (via try/catch), so the guarantee holds independent of Express's own error
 * forwarding. Accepts async or sync handlers.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => unknown) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      Promise.resolve(fn(req, res, next)).catch(next)
    } catch (err) {
      next(err)
    }
  }
}
