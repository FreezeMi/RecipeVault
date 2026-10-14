import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import authRouter, { requireAuth } from './auth';
import recipesRouter from './recipes';
import { getDbStatus } from './dbCheck';
import { errorHandler, notFoundHandler, requireTrustedOrigin, securityHeaders } from './http';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

app.use(securityHeaders);

// Unauthenticated liveness probe for the hosting platform; deliberately avoids the database.
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(requireTrustedOrigin);
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  }),
);

// Backups can be large; everything else gets a tight limit. The first parser to run wins.
app.use('/api/recipes/upload', express.json({ limit: '15mb' }));
app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/recipes', recipesRouter);

app.get('/api/system/db-status', requireAuth, (_req: Request, res: Response) => {
  res.json(getDbStatus());
});

app.use('/api', notFoundHandler);
app.use(errorHandler);

export default app;
