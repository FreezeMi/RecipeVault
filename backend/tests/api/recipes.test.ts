import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, prisma, createTestUser, login } from '../helpers';

// Every recipe created here carries this marker so the suite only ever touches its own rows.
const RUN = `zzTest${Date.now()}`;

const recipePayload = (overrides: Record<string, unknown> = {}) => ({
  title: `${RUN} Pancakes`,
  description: 'Fluffy',
  tags: ['Breakfast', 'Dessert'],
  prepTime: 10,
  cookTime: 15,
  servings: 4,
  imageUrl: 'https://example.com/pancakes.jpg',
  sourceUrl: 'https://example.com/recipe',
  ingredients: [{ quantity: '2', unit: 'cups', name: 'flour' }],
  instructions: ['Mix', 'Fry'],
  notes: 'Serve warm',
  isFavorite: false,
  ...overrides,
});

test('Recipes API', async (t) => {
  const user = await createTestUser('recipes');
  const cookie = await login(user.email);
  const auth = (req: request.Test) => req.set('Cookie', cookie);

  t.after(async () => {
    await prisma.recipe.deleteMany({ where: { title: { startsWith: RUN } } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  let recipeId = 0;

  await t.test('GET /api/recipes returns an array', async () => {
    const res = await request(app).get('/api/recipes');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  await t.test('write endpoints require authentication', async () => {
    const checks = [
      request(app).post('/api/recipes').send(recipePayload()),
      request(app).put('/api/recipes/1').send(recipePayload()),
      request(app).delete('/api/recipes/1'),
      request(app).patch('/api/recipes/1/favorite'),
      request(app).post('/api/recipes/upload').send([]),
      request(app).get('/api/system/db-status'),
    ];
    for (const res of await Promise.all(checks)) assert.equal(res.status, 401);
  });

  await t.test('POST creates a recipe and persists every field, including sourceUrl', async () => {
    const res = await auth(request(app).post('/api/recipes')).send(recipePayload());
    assert.equal(res.status, 201);
    recipeId = res.body.id;
    assert.equal(res.body.sourceUrl, 'https://example.com/recipe');
    assert.deepEqual(JSON.parse(res.body.tags), ['Breakfast', 'Dessert']);
    assert.deepEqual(JSON.parse(res.body.instructions), ['Mix', 'Fry']);
  });

  await t.test('POST rejects invalid payloads with 400 and details', async () => {
    const noTitle = await auth(request(app).post('/api/recipes')).send(recipePayload({ title: '' }));
    assert.equal(noTitle.status, 400);
    assert.equal(noTitle.body.error, 'Title is required.');

    const xss = await auth(request(app).post('/api/recipes')).send(recipePayload({ sourceUrl: 'javascript:alert(1)' }));
    assert.equal(xss.status, 400);
    assert.ok(Array.isArray(xss.body.details));

    const nan = await auth(request(app).post('/api/recipes')).send(recipePayload({ servings: 'lots' }));
    assert.equal(nan.status, 400);
  });

  await t.test('POST rejects a fractional or out-of-range serving count', async () => {
    for (const servings of [2.5, 0, 1001]) {
      const res = await auth(request(app).post('/api/recipes')).send(recipePayload({ servings }));
      assert.equal(res.status, 400, `servings: ${servings}`);
      assert.equal(res.body.error, 'servings must be a whole number between 1 and 1000.');
    }
  });

  await t.test('ingredient quantities round-trip exactly, and reading a recipe never changes it', async () => {
    const ingredients = [
      { quantity: '1 1/2', unit: 'cups', name: 'flour' },
      { quantity: '½', unit: 'tsp', name: 'salt' },
      { quantity: '3-4', unit: 'tbsp', name: 'oil' },
      { quantity: '2,5', unit: 'dl', name: 'milk' },
      { quantity: 'a pinch', unit: '', name: 'nutmeg' },
      { quantity: '', unit: '', name: 'butter for frying' },
    ];
    // No tags, so the tag-filter test below still only finds the main recipe.
    const created = await auth(request(app).post('/api/recipes')).send(
      recipePayload({ title: `${RUN} Crepes`, tags: [], servings: 6, ingredients }),
    );
    assert.equal(created.status, 201);

    const first = await request(app).get(`/api/recipes/${created.body.id}`);
    const second = await request(app).get(`/api/recipes/${created.body.id}`);
    assert.deepEqual(JSON.parse(first.body.ingredients), ingredients);
    assert.equal(first.body.servings, 6);
    assert.equal(second.body.updatedAt, created.body.updatedAt);
  });

  await t.test('GET /:id returns the recipe; bad or unknown ids are handled', async () => {
    const res = await request(app).get(`/api/recipes/${recipeId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.title, `${RUN} Pancakes`);

    assert.equal((await request(app).get('/api/recipes/abc')).status, 400);
    assert.equal((await request(app).get('/api/recipes/2147483647')).status, 404);
  });

  await t.test('PUT accepts empty number fields (form sends "") and clears them', async () => {
    const res = await auth(request(app).put(`/api/recipes/${recipeId}`)).send(
      recipePayload({ prepTime: '', cookTime: '', servings: '', sourceUrl: '' }),
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.prepTime, null);
    assert.equal(res.body.cookTime, null);
    assert.equal(res.body.servings, null);
    assert.equal(res.body.sourceUrl, null);
  });

  await t.test('PUT/DELETE on a missing recipe return 404, not 500', async () => {
    const put = await auth(request(app).put('/api/recipes/2147483647')).send(recipePayload());
    assert.equal(put.status, 404);
    const del = await auth(request(app).delete('/api/recipes/2147483647'));
    assert.equal(del.status, 404);
  });

  await t.test('search is case-insensitive and tag filtering matches whole tags', async () => {
    const search = await request(app).get('/api/recipes').query({ search: RUN.toUpperCase() });
    assert.ok(search.body.some((r: { id: number }) => r.id === recipeId));

    const byTag = await request(app).get('/api/recipes').query({ search: RUN, tags: 'Dessert' });
    assert.deepEqual(byTag.body.map((r: { id: number }) => r.id), [recipeId]);

    // "Dess" is a substring of a tag but not a tag itself.
    const partial = await request(app).get('/api/recipes').query({ search: RUN, tags: 'Dess' });
    assert.deepEqual(partial.body, []);
  });

  await t.test('translations round-trip, and an update that leaves them out keeps them', async () => {
    const nl = {
      title: `Poffertjes ${RUN}`,
      description: 'Kleine pannenkoekjes',
      ingredients: [{ quantity: '250', unit: 'g', name: 'boekweitmeel' }],
      instructions: ['Beslag maken', 'Bakken'],
      notes: null,
    };
    // No tags and not a favorite, so the tag and favorite filter tests still only find the main recipe.
    const fields = { title: `${RUN} Mini Pancakes`, tags: [] };
    const created = await auth(request(app).post('/api/recipes')).send(recipePayload({ ...fields, language: 'en', translations: { nl } }));
    assert.equal(created.status, 201);
    assert.equal(created.body.language, 'en');
    assert.deepEqual(JSON.parse(created.body.translations), { nl });

    // The current form doesn't send language or translations; saving it must not wipe them.
    const updated = await auth(request(app).put(`/api/recipes/${created.body.id}`)).send(recipePayload({ ...fields, description: 'Tiny' }));
    assert.equal(updated.status, 200);
    assert.equal(updated.body.description, 'Tiny');
    assert.equal(updated.body.translations, created.body.translations);

    // Recipes are found by their translated text too.
    const search = await request(app).get('/api/recipes').query({ search: `poffertjes ${RUN}` });
    assert.deepEqual(search.body.map((r: { id: number }) => r.id), [created.body.id]);

    const cleared = await auth(request(app).put(`/api/recipes/${created.body.id}`)).send(recipePayload({ ...fields, translations: null }));
    assert.equal(cleared.body.translations, null);
  });

  await t.test('existing and new recipes default to English without translations', async () => {
    const res = await request(app).get(`/api/recipes/${recipeId}`);
    assert.equal(res.body.language, 'en');
    assert.equal(res.body.translations, null);
  });

  await t.test('favorite toggles and the favorite filter follows', async () => {
    const on = await auth(request(app).patch(`/api/recipes/${recipeId}/favorite`));
    assert.equal(on.status, 200);
    assert.equal(on.body.isFavorite, true);

    const favs = await request(app).get('/api/recipes').query({ search: RUN, favorite: 'true' });
    assert.deepEqual(favs.body.map((r: { id: number }) => r.id), [recipeId]);

    const off = await auth(request(app).patch(`/api/recipes/${recipeId}/favorite`));
    assert.equal(off.body.isFavorite, false);
  });

  await t.test('upload imports backups, skips duplicates (case-insensitive) and counts invalid rows', async () => {
    const backup = [
      {
        // Backup files carry JSON-string fields exactly as the API returns them.
        title: `${RUN} Restored Soup`,
        tags: '["Soup"]',
        ingredients: JSON.stringify([{ quantity: '1', unit: 'l', name: 'water' }]),
        instructions: JSON.stringify(['Boil water']),
        imageUrl: 'javascript:alert(1)',
        createdAt: '2024-01-01T00:00:00.000Z',
        isFavorite: true,
      },
      { title: `${RUN} restored soup  ` }, // duplicate within the same file
      { title: `${RUN} PANCAKES` }, // duplicate of an existing recipe
      { description: 'no title' },
      'not an object',
    ];

    const first = await auth(request(app).post('/api/recipes/upload')).send(backup);
    assert.equal(first.status, 201);
    assert.deepEqual(first.body, { success: true, count: 1, skipped: 2, invalid: 2 });

    const restored = await prisma.recipe.findFirst({ where: { title: `${RUN} Restored Soup` } });
    assert.ok(restored);
    assert.equal(restored.imageUrl, null, 'unsafe URL dropped on restore');
    assert.equal(restored.isFavorite, true);
    assert.equal(restored.createdAt.toISOString(), '2024-01-01T00:00:00.000Z');

    const second = await auth(request(app).post('/api/recipes/upload')).send(backup);
    assert.equal(second.body.count, 0);
  });

  await t.test('upload restores language and translations, dropping only the unusable ones', async () => {
    const translations = JSON.stringify({ en: { title: 'Pea soup', instructions: ['Simmer'] } });
    const backup = [
      { title: `${RUN} Erwtensoep`, language: 'nl', translations, instructions: '["Sudderen"]' },
      { title: `${RUN} Broken Translation`, translations: { nl: { title: '' }, fr: { title: 'Soupe' } } },
    ];

    const res = await auth(request(app).post('/api/recipes/upload')).send(backup);
    assert.deepEqual(res.body, { success: true, count: 2, skipped: 0, invalid: 0 });

    const soup = await prisma.recipe.findFirst({ where: { title: `${RUN} Erwtensoep` } });
    assert.equal(soup?.language, 'nl');
    assert.deepEqual(JSON.parse(soup!.translations!), {
      en: { title: 'Pea soup', description: null, ingredients: [], instructions: ['Simmer'], notes: null },
    });

    const broken = await prisma.recipe.findFirst({ where: { title: `${RUN} Broken Translation` } });
    assert.equal(broken?.language, 'en');
    assert.equal(broken?.translations, null);
  });

  await t.test('upload accepts backups larger than the default 100kb body limit', async () => {
    const big = Array.from({ length: 60 }, (_, i) => ({
      title: `${RUN} Bulk ${i}`,
      instructions: JSON.stringify(['x'.repeat(4000)]),
    }));
    const res = await auth(request(app).post('/api/recipes/upload')).send(big);
    assert.equal(res.status, 201);
    assert.equal(res.body.count, 60);
  });

  await t.test('upload rejects a non-array body', async () => {
    const res = await auth(request(app).post('/api/recipes/upload')).send({ title: 'x' });
    assert.equal(res.status, 400);
  });

  await t.test('malformed JSON gets a JSON 400 instead of an HTML error page', async () => {
    const res = await auth(request(app).post('/api/recipes'))
      .set('Content-Type', 'application/json')
      .send('{"title": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Malformed JSON body');
  });

  await t.test('cross-site writes from untrusted origins are rejected (CSRF)', async () => {
    const res = await auth(request(app).post('/api/recipes'))
      .set('Origin', 'https://evil.example')
      .send(recipePayload());
    assert.equal(res.status, 403);

    const trusted = await auth(request(app).patch(`/api/recipes/${recipeId}/favorite`)).set('Origin', 'http://localhost:5173');
    assert.equal(trusted.status, 200);
  });

  await t.test('responses carry security headers', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  await t.test('db-status is available to the admin', async () => {
    const res = await auth(request(app).get('/api/system/db-status'));
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.isOkay, 'boolean');
  });

  await t.test('DELETE with a malformed id returns 400', async () => {
    const res = await auth(request(app).delete('/api/recipes/abc'));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Invalid recipe id');
  });

  await t.test('DELETE removes the recipe and leaves the others alone', async () => {
    const ownRecipes = () => prisma.recipe.count({ where: { title: { startsWith: RUN } } });
    const before = await ownRecipes();

    const res = await auth(request(app).delete(`/api/recipes/${recipeId}`));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
    assert.equal((await request(app).get(`/api/recipes/${recipeId}`)).status, 404);
    assert.equal(await ownRecipes(), before - 1);
  });

  await t.test('unknown API routes return JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Not found');
  });
});
