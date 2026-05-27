import type { NextFunction, Request, Response } from 'express'

/**
 * Wrapper for async route handlers to ensure errors are caught and passed to next()
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
