import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express'

// AD-10: Centralized error handler — all errors produce { success: false, error: string }
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const message = err instanceof Error ? err.message : 'Internal server error'
  const status = (err as { status?: number }).status ?? 500
  res.status(status).json({ success: false, error: message })
}
