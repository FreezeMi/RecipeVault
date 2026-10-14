import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, prisma, createTestUser, login, TEST_PASSWORD } from '../helpers';

test('Authentication API', async (t) => {
  const user = await createTestUser('auth');

  t.after(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  await t.test('login fails with incorrect credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrongpassword' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid email or password.');
  });

  await t.test('login gives the same answer for unknown accounts', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid email or password.');
  });

  await t.test('login rejects non-string credentials with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: '' }, password: ['x'] });
    assert.equal(res.status, 400);
  });

  await t.test('login succeeds, sets an httpOnly cookie, and is case-insensitive on email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: user.email.toUpperCase(), password: TEST_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, user.email);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    assert.match(cookie, /^token=/);
    assert.match(cookie, /HttpOnly/i);
  });

  await t.test('/me reports unauthenticated without a cookie or with a forged one', async () => {
    const anonymous = await request(app).get('/api/auth/me');
    assert.deepEqual(anonymous.body, { authenticated: false });

    const forged = await request(app).get('/api/auth/me').set('Cookie', 'token=not-a-jwt');
    assert.deepEqual(forged.body, { authenticated: false });
  });

  await t.test('/me returns the user for a valid session', async () => {
    const cookie = await login(user.email);
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    assert.equal(res.body.authenticated, true);
    assert.equal(res.body.user.email, user.email);
    assert.equal(res.body.user.passwordHash, undefined, 'never leaks the hash');
  });

  await t.test('logout revokes the session server-side', async () => {
    const cookie = await login(user.email);
    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    assert.equal(logout.status, 200);

    // Replaying the old cookie must no longer work.
    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    assert.equal(me.body.authenticated, false);
  });

  await t.test('change-password validates input and the current password', async () => {
    const cookie = await login(user.email);

    const unauthenticated = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'AnotherPassword123!' });
    assert.equal(unauthenticated.status, 401);

    const tooShort = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'short' });
    assert.equal(tooShort.status, 400);

    const wrongCurrent = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'not-the-password', newPassword: 'AnotherPassword123!' });
    assert.equal(wrongCurrent.status, 400);
    assert.equal(wrongCurrent.body.error, 'Current password is incorrect.');
  });

  await t.test('change-password updates the password and signs out every session', async () => {
    const newPassword = 'BrandNewPassword456!';
    const cookieA = await login(user.email);
    const cookieB = await login(user.email);

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookieA)
      .send({ currentPassword: TEST_PASSWORD, newPassword });
    assert.equal(res.status, 200);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookieB);
    assert.equal(me.body.authenticated, false, 'other devices are signed out');

    await login(user.email, newPassword);
    const oldPassword = await request(app).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    assert.equal(oldPassword.status, 401);
  });
});
