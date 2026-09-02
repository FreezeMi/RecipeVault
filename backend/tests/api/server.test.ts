import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../../src/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test('API Endpoints', async (t) => {
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
  
  // Clean up
  await prisma.$disconnect();
});

