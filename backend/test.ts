import test from 'node:test';
import assert from 'node:assert';

// We will do a basic test using fetch against the running server.
// To run this test, the server must be running.

const API_BASE = 'http://127.0.0.1:3001/api';

test('Recipe API CRUD', async (t) => {
  let createdRecipeId: number;

  await t.test('POST /api/recipes - Create a recipe', async () => {
    const res = await fetch(`${API_BASE}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Recipe',
        description: 'Test description',
        category: 'Snack',
        ingredients: [{ quantity: '1', unit: 'pcs', name: 'Test' }],
        instructions: ['Do this'],
      })
    });
    
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.title, 'Test Recipe');
    createdRecipeId = data.id;
  });

  await t.test('POST /api/recipes - Validation failure (no title)', async () => {
    const res = await fetch(`${API_BASE}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Test description',
      })
    });
    
    assert.strictEqual(res.status, 400);
  });

  await t.test('GET /api/recipes - Get all recipes', async () => {
    const res = await fetch(`${API_BASE}/recipes`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 1);
  });

  await t.test('GET /api/recipes/:id - Get a single recipe', async () => {
    const res = await fetch(`${API_BASE}/recipes/${createdRecipeId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.id, createdRecipeId);
    assert.strictEqual(data.title, 'Test Recipe');
  });

  await t.test('PUT /api/recipes/:id - Update a recipe', async () => {
    const res = await fetch(`${API_BASE}/recipes/${createdRecipeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Updated Test Recipe',
        description: 'Updated test description'
      })
    });
    
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.title, 'Updated Test Recipe');
  });

  await t.test('PATCH /api/recipes/:id/favorite - Toggle favorite', async () => {
    const res = await fetch(`${API_BASE}/recipes/${createdRecipeId}/favorite`, {
      method: 'PATCH'
    });
    
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.isFavorite, true);
  });

  await t.test('GET /api/recipes?search=test - Search for recipe', async () => {
    // Let's create a recipe to search for first
    const createRes = await fetch(`${API_BASE}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'UniqueSearchTerm Recipe',
        description: 'Test description',
        category: 'Dessert',
        ingredients: [{ quantity: '1', unit: 'pcs', name: 'Test' }],
        instructions: ['Do this'],
      })
    });
    const created = await createRes.json();
    const searchId = created.id;

    // Search for it
    const searchRes = await fetch(`${API_BASE}/recipes?search=UniqueSearchTerm`);
    assert.strictEqual(searchRes.status, 200);
    const searchData = await searchRes.json();
    assert.ok(searchData.some((r: any) => r.id === searchId));

    // Filter by category
    const catRes = await fetch(`${API_BASE}/recipes?category=Dessert`);
    assert.strictEqual(catRes.status, 200);
    const catData = await catRes.json();
    assert.ok(catData.every((r: any) => r.category === 'Dessert'));

    // Filter by favorite
    await fetch(`${API_BASE}/recipes/${searchId}/favorite`, { method: 'PATCH' });
    const favRes = await fetch(`${API_BASE}/recipes?favorite=true`);
    assert.strictEqual(favRes.status, 200);
    const favData = await favRes.json();
    assert.ok(favData.some((r: any) => r.id === searchId));
    assert.ok(favData.every((r: any) => r.isFavorite === true));

    // Clean up
    await fetch(`${API_BASE}/recipes/${searchId}`, { method: 'DELETE' });
  });

  await t.test('DELETE /api/recipes/:id - Delete a recipe', async () => {
    const res = await fetch(`${API_BASE}/recipes/${createdRecipeId}`, {
      method: 'DELETE'
    });
    
    assert.strictEqual(res.status, 200);
    
    const getRes = await fetch(`${API_BASE}/recipes/${createdRecipeId}`);
    assert.strictEqual(getRes.status, 404);
  });
});

