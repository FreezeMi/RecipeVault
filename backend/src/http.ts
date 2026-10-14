import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { config } from './config';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
  }
}

export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // The API only ever serves JSON, so nothing may be loaded or framed from its responses.
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defense. The session cookie must be SameSite=None in production (frontend and API
 * live on different sites), so browsers attach it to cross-site requests. Browsers always
 * send an Origin header on cross-origin state-changing requests, so rejecting unknown
 * origins blocks forged requests from other sites.
 */
export const requireTrustedOrigin = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (SAFE_METHODS.has(req.method) || !origin || config.allowedOrigins.includes(origin)) {
    next();
    return;
  }
  res.status(403).json({ error: 'Origin not allowed' });
};

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
};

// Express 5 forwards rejected promises from async handlers here automatically.
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.details ? { error: err.message, details: err.details } : { error: err.message });
    return;
  }

  const bodyError = err as { type?: string; status?: number };
  if (bodyError?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }
  if (bodyError?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body is too large' });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
};
