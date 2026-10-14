import { afterEach, describe, expect, test, vi } from 'vitest';
import { api, ApiError, authApi, getCachedRecipes, setUnauthorizedHandler } from '../../services/api';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe('api client', () => {
  test('sends credentials and builds filter query strings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await api.getRecipes({ search: ' pasta ', tag: 'Dinner', favorite: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toMatch(/\/recipes\?search=pasta&tags=Dinner&favorite=true$/);
    expect(init.credentials).toBe('include');
  });

  test('surfaces the server error message and validation details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Title is required.', details: ['Title is required.', 'x'] }, 400)));

    const error = await api.createRecipe({} as never).catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Title is required.');
    expect(error.details).toEqual(['Title is required.', 'x']);
  });

  test('reports network failures with a friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.getRecipe(1)).rejects.toThrow('Unable to reach the server');
  });

  test('calls the unauthorized handler on 401s, except for login', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ error: 'Unauthorized' }, 401))));

    await expect(api.deleteRecipe(1)).rejects.toThrow('Unauthorized');
    expect(handler).toHaveBeenCalledTimes(1);

    await expect(authApi.login('a@b.c', 'x')).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('writes invalidate the cached recipe lists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => Promise.resolve(jsonResponse(url.includes('favorite') ? { id: 1 } : []))),
    );

    await api.getRecipes({});
    expect(getCachedRecipes({})).toEqual([]);

    await api.toggleFavorite(1);
    expect(getCachedRecipes({})).toBeUndefined();
  });
});
