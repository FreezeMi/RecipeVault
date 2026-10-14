import bcrypt from 'bcrypt';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/db';

// The API tests write to the database. Refuse to run against anything but a local database
// (e.g. the production Neon URL in backend/.env) unless explicitly allowed.
const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname;
  } catch {
    return '';
  }
})();
if (!['localhost', '127.0.0.1', 'postgres'].includes(dbHost) && process.env.ALLOW_REMOTE_TEST_DB !== '1') {
  throw new Error(
    `Refusing to run API tests against non-local database host "${dbHost}". ` +
      'Point DATABASE_URL at a local test database, or set ALLOW_REMOTE_TEST_DB=1 to override.',
  );
}

export { app, prisma };

export const TEST_PASSWORD = 'TestPassword123!';

/** Creates a throwaway user. Uses a low bcrypt cost to keep tests fast. */
export async function createTestUser(prefix: string) {
  const email = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(TEST_PASSWORD, 4) },
  });
  return { id: user.id, email };
}

/** Logs in and returns the session cookie to send with authenticated requests. */
export async function login(email: string, password = TEST_PASSWORD): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed with status ${res.status}`);
  const cookie = res.headers['set-cookie']?.[0];
  if (!cookie) throw new Error('Login did not set a cookie');
  return cookie.split(';')[0]!;
}
