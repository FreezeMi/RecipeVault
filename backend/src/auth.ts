import express, { Request, Response, NextFunction, CookieOptions } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from './db';
import { config } from './config';
import { PASSWORD_RULES } from './validation';

const router = express.Router();

const COOKIE_NAME = 'token';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BCRYPT_COST = 12;
const MAX_EMAIL_LENGTH = 254;

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  // The frontend and API are deployed on different sites in production, which requires SameSite=None.
  // CSRF is mitigated by the Origin check in http.ts.
  sameSite: config.isProduction ? 'none' : 'lax',
  path: '/',
};

// Compared against when the email is unknown, so response timing doesn't reveal which accounts exist.
const dummyHash = bcrypt.hash(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

const readSessionId = (token: unknown): string | null => {
  if (typeof token !== 'string' || token === '') return null;
  try {
    const decoded = jwt.verify(token, config.sessionSecret, { algorithms: ['HS256'] });
    return typeof decoded === 'object' && typeof decoded.sessionId === 'string' ? decoded.sessionId : null;
  } catch {
    return null;
  }
};

const resolveSession = async (req: Request): Promise<{ sessionId: string; user: AuthUser } | null> => {
  const sessionId = readSessionId(req.cookies?.[COOKIE_NAME]);
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;

  return { sessionId: session.id, user: session.user };
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const session = await resolveSession(req);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.user = session.user;
  req.sessionId = session.sessionId;
  next();
};

const isValidPassword = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 1024;

router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || !email.trim() || email.length > MAX_EMAIL_LENGTH || !isValidPassword(password)) {
    res.status(400).json({ error: 'Invalid email or password.' });
    return;
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
  });

  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !passwordMatches) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const now = new Date();
  const [, session] = await prisma.$transaction([
    // Opportunistic cleanup so expired sessions don't accumulate.
    prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: now } } }),
    prisma.session.create({
      data: { userId: user.id, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) },
    }),
  ]);

  const token = jwt.sign({ userId: user.id, sessionId: session.id }, config.sessionSecret, {
    algorithm: 'HS256',
    expiresIn: Math.floor(SESSION_TTL_MS / 1000),
  });

  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });
  res.json({ user: { id: user.id, email: user.email } });
});

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const sessionId = readSessionId(req.cookies?.[COOKIE_NAME]);
  if (sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
  }
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ success: true });
});

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const session = await resolveSession(req);
  res.json(session ? { authenticated: true, user: session.user } : { authenticated: false });
});

router.post('/change-password', authLimiter, requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body ?? {};

  if (!isValidPassword(currentPassword) || typeof newPassword !== 'string') {
    res.status(400).json({ error: 'Current and new password are required.' });
    return;
  }
  if (newPassword.length < PASSWORD_RULES.minLength) {
    res.status(400).json({ error: `New password must be at least ${PASSWORD_RULES.minLength} characters.` });
    return;
  }
  if (Buffer.byteLength(newPassword) > PASSWORD_RULES.maxBytes) {
    res.status(400).json({ error: `New password must be at most ${PASSWORD_RULES.maxBytes} bytes.` });
    return;
  }

  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  // Update the password and sign out every device in one atomic step.
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);

  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ success: true, message: 'Password changed. Please log in again.' });
});

export default router;
