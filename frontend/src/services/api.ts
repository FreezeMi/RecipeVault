import type { DbStatus, Recipe, RecipeFilters, RecipeInput, UploadResult, User } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly details?: string[];

  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Registers a callback for 401s on authenticated calls (i.e. the session expired). */
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;
  signal?: AbortSignal;
  /** Fallback error message when the server doesn't provide one. */
  errorMessage: string;
  /** Don't treat a 401 as an expired session (login, session probe). */
  ignoreUnauthorized?: boolean;
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', json, signal, errorMessage, ignoreUnauthorized } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: json === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'Unable to reach the server. Check your connection and try again.');
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && !ignoreUnauthorized) unauthorizedHandler?.();
    const { error, details } = (body ?? {}) as { error?: unknown; details?: unknown };
    throw new ApiError(
      response.status,
      typeof error === 'string' && error ? error : errorMessage,
      Array.isArray(details) ? details.filter((d): d is string => typeof d === 'string') : undefined,
    );
  }

  return body as T;
}

export const toErrorMessage = (error: unknown, fallback = 'Something went wrong.') =>
  error instanceof Error && error.message ? error.message : fallback;

// Recipe lists are cached per query so that returning to the list (e.g. with Back) renders
// instantly; the list still revalidates in the background. Any write clears the cache.
const listCache = new Map<string, Recipe[]>();

export const recipeListKey = ({ search, tag, favorite }: RecipeFilters = {}) => {
  const query = new URLSearchParams();
  if (search?.trim()) query.set('search', search.trim());
  if (tag) query.set('tags', tag);
  if (favorite) query.set('favorite', 'true');
  return query.toString();
};

export const getCachedRecipes = (filters: RecipeFilters) => listCache.get(recipeListKey(filters));

const invalidating = <T>(promise: Promise<T>) =>
  promise.then(result => {
    listCache.clear();
    return result;
  });

export const api = {
  async getRecipes(filters: RecipeFilters = {}, signal?: AbortSignal): Promise<Recipe[]> {
    const key = recipeListKey(filters);
    const path = key ? `/recipes?${key}` : '/recipes';
    const recipes = await request<Recipe[]>(path, {
      signal,
      errorMessage: 'Failed to load recipes.',
    });
    listCache.set(key, recipes);
    return recipes;
  },

  getRecipe(id: number, signal?: AbortSignal): Promise<Recipe> {
    return request(`/recipes/${id}`, { signal, errorMessage: 'Failed to load recipe.' });
  },

  createRecipe(data: RecipeInput): Promise<Recipe> {
    return invalidating(request('/recipes', { method: 'POST', json: data, errorMessage: 'Failed to create recipe.' }));
  },

  updateRecipe(id: number, data: RecipeInput): Promise<Recipe> {
    return invalidating(request(`/recipes/${id}`, { method: 'PUT', json: data, errorMessage: 'Failed to update recipe.' }));
  },

  deleteRecipe(id: number): Promise<{ success: boolean }> {
    return invalidating(request(`/recipes/${id}`, { method: 'DELETE', errorMessage: 'Failed to delete recipe.' }));
  },

  toggleFavorite(id: number): Promise<Recipe> {
    return invalidating(request(`/recipes/${id}/favorite`, { method: 'PATCH', errorMessage: 'Failed to update favorite.' }));
  },

  uploadRecipes(recipes: unknown[]): Promise<UploadResult> {
    return invalidating(request('/recipes/upload', { method: 'POST', json: recipes, errorMessage: 'Failed to import recipes.' }));
  },

  getDbStatus(signal?: AbortSignal): Promise<DbStatus> {
    return request('/system/db-status', { signal, errorMessage: 'Failed to get database status.' });
  },
};

export const authApi = {
  login(email: string, password: string): Promise<{ user: User }> {
    return request('/auth/login', {
      method: 'POST',
      json: { email, password },
      errorMessage: 'Sign in failed.',
      ignoreUnauthorized: true,
    });
  },

  logout(): Promise<{ success: boolean }> {
    return request('/auth/logout', { method: 'POST', errorMessage: 'Sign out failed.', ignoreUnauthorized: true });
  },

  getMe(): Promise<{ authenticated: boolean; user?: User }> {
    return request('/auth/me', { errorMessage: 'Failed to check session.', ignoreUnauthorized: true });
  },

  changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
    return request('/auth/change-password', {
      method: 'POST',
      json: { currentPassword, newPassword },
      errorMessage: 'Failed to change password.',
    });
  },
};
