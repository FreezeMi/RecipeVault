import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

const DEV_SESSION_SECRET = 'insecure-development-secret-do-not-use-in-production';

const resolveSessionSecret = (): string => {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) {
    if (isProduction && secret.length < 32) {
      console.warn('[config] SESSION_SECRET is shorter than 32 characters. Use a long random value in production.');
    }
    return secret;
  }
  if (isProduction) {
    throw new Error('SESSION_SECRET must be set in production.');
  }
  if (nodeEnv !== 'test') {
    console.warn('[config] SESSION_SECRET is not set; using an insecure development secret.');
  }
  return DEV_SESSION_SECRET;
};

// FRONTEND_URL may hold a comma-separated list (e.g. production + preview deployments).
const stripTrailingSlashes = (origin: string) => {
  let end = origin.length;
  while (end > 0 && origin[end - 1] === '/') end--;
  return origin.slice(0, end);
};

const parseOrigins = (value: string | undefined): string[] =>
  (value ?? 'http://localhost:5173')
    .split(',')
    .map(origin => stripTrailingSlashes(origin.trim()))
    .filter(Boolean);

// Express "trust proxy" setting. Render (and most PaaS hosts) sit behind one proxy hop,
// which is required for correct client IPs in rate limiting and for secure cookies.
const parseTrustProxy = (value: string | undefined): boolean | number | string => {
  if (value === undefined || value === '') return isProduction ? 1 : false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const asNumber = Number(value);
  return Number.isInteger(asNumber) ? asNumber : value;
};

export const config = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT) || 3001,
  sessionSecret: resolveSessionSecret(),
  allowedOrigins: parseOrigins(process.env.FRONTEND_URL),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
} as const;
