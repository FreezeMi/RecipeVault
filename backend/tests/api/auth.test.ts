import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test('Authentication API', async (t) => {
  const testEmail = `testuser_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  let userId: string;

  // Setup: create a test user
  t.before(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
      },
    });
    userId = user.id;
  });

  // Teardown: remove the test user
  t.after(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });

  await t.test('POST /api/auth/login should fail with incorrect credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'wrongpassword'
    });
    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.error, 'Invalid email or password.');
  });

  await t.test('POST /api/auth/login should succeed and return a cookie', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword
    });
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.user.email, testEmail);
    assert.ok(response.headers['set-cookie'], 'Should set a cookie');
  });

  await t.test('GET /api/auth/me should return authenticated false when not logged in', async () => {
    const response = await request(app).get('/api/auth/me');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.authenticated, false);
  });
});

