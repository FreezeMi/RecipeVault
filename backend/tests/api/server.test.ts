import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test('API Endpoints', async (t) => {
  const testEmail = `testadmin_${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  let userId: string;
  let authCookie: string;

  t.before(async () => {
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
      },
    });
    userId = user.id;

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword
    });
    authCookie = loginRes.headers['set-cookie']?.[0] || '';
  });

  t.after(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.recipe.deleteMany({
      where: { title: { startsWith: 'Test Uploaded Recipe' } }
    }).catch(() => {});
    await prisma.$disconnect();
  });

  // Test GET /api/recipes
  await t.test('GET /api/recipes should return a list of recipes', async () => {
    const response = await request(app).get('/api/recipes');
    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(response.body), 'Response should be an array');
  });

  // Test POST /api/recipes without auth
  await t.test('POST /api/recipes should fail if unauthenticated', async () => {
    const response = await request(app).post('/api/recipes').send({
      title: 'Test Recipe'
    });
    // Assuming requireAuth returns 401 when not logged in
    assert.strictEqual(response.status, 401);
  });
  
  await t.test('POST /api/recipes/upload should fail if unauthenticated', async () => {
    const response = await request(app).post('/api/recipes/upload').send([]);
    assert.strictEqual(response.status, 401);
  });

  await t.test('POST /api/recipes/upload should create recipes and skip duplicates', async () => {
    const uniqueTitle = `Test Uploaded Recipe ${Date.now()}`;
    const recipesToUpload = [
      {
        title: uniqueTitle,
        ingredients: JSON.stringify([{ quantity: '1', unit: 'cup', name: 'water' }]),
        instructions: JSON.stringify(['Boil water'])
      }
    ];

    // First upload
    const response1 = await request(app)
      .post('/api/recipes/upload')
      .set('Cookie', authCookie)
      .send(recipesToUpload);
    assert.strictEqual(response1.status, 201);
    assert.strictEqual(response1.body.success, true);
    assert.strictEqual(response1.body.count, 1);

    // Second upload (should skip as duplicate)
    const response2 = await request(app)
      .post('/api/recipes/upload')
      .set('Cookie', authCookie)
      .send(recipesToUpload);
    assert.strictEqual(response2.status, 201);
    assert.strictEqual(response2.body.success, true);
    assert.strictEqual(response2.body.count, 0);
  });
});

