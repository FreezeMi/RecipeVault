import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import RecipeList from '../../components/RecipeList';
import { ToastProvider } from '../../components/Toast';
import * as AuthContext from '../../components/AuthContext';
import { api, ApiError } from '../../services/api';
import { setLanguage } from '../../lib/i18n';
import type { Recipe } from '../../types';

vi.mock('../../components/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../services/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return { ...actual, getCachedRecipes: () => undefined, api: { getRecipes: vi.fn(), toggleFavorite: vi.fn() } };
});

const recipe = (id: number, overrides: Partial<Recipe> = {}): Recipe => ({
  id,
  title: `Recipe ${id}`,
  description: null,
  tags: '[]',
  prepTime: null,
  cookTime: null,
  servings: null,
  imageUrl: null,
  sourceUrl: null,
  ingredients: '[]',
  instructions: '[]',
  notes: null,
  language: 'en',
  translations: null,
  isFavorite: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const renderList = (authenticated = false) => {
  vi.mocked(AuthContext.useAuth).mockReturnValue({ authenticated } as never);
  return render(
    <ToastProvider>
      <RecipeList />
    </ToastProvider>,
  );
};

beforeEach(() => {
  vi.mocked(api.getRecipes).mockReset();
  vi.mocked(api.toggleFavorite).mockReset();
  window.history.replaceState(null, '', '/');
});

test('loads recipes using the filters from the URL', async () => {
  window.history.replaceState(null, '', '/?q=soup&tag=Dinner&fav=1');
  vi.mocked(api.getRecipes).mockResolvedValue([recipe(1)]);
  renderList();

  expect(await screen.findByRole('link', { name: 'Recipe 1' })).toBeInTheDocument();
  expect(api.getRecipes).toHaveBeenCalledWith({ search: 'soup', tag: 'Dinner', favorite: true }, expect.any(AbortSignal));
  expect(screen.getByRole('searchbox', { name: 'Search recipes' })).toHaveValue('soup');
  expect(screen.getByRole('button', { name: 'Dinner' })).toHaveAttribute('aria-pressed', 'true');
});

test('clicking a tag chip updates the URL and refetches', async () => {
  vi.mocked(api.getRecipes).mockResolvedValue([]);
  renderList();
  await screen.findByText('Your vault is empty');

  fireEvent.click(screen.getByRole('button', { name: 'Pasta' }));

  await waitFor(() => expect(window.location.search).toBe('?tag=Pasta'));
  await waitFor(() => expect(api.getRecipes).toHaveBeenLastCalledWith({ search: '', tag: 'Pasta', favorite: false }, expect.any(AbortSignal)));
  expect(await screen.findByText('No recipes found')).toBeInTheDocument();
});

test('shows an error with a working retry', async () => {
  vi.mocked(api.getRecipes).mockRejectedValueOnce(new ApiError(0, 'Unable to reach the server.')).mockResolvedValueOnce([recipe(1)]);
  renderList();

  expect(await screen.findByText('Unable to reach the server.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('link', { name: 'Recipe 1' })).toBeInTheDocument();
});

test('favorite toggles optimistically and rolls back on failure', async () => {
  vi.mocked(api.getRecipes).mockResolvedValue([recipe(1)]);
  let reject: (error: Error) => void = () => {};
  vi.mocked(api.toggleFavorite).mockReturnValueOnce(new Promise((_, r) => (reject = r)));
  renderList(true);

  const button = await screen.findByRole('button', { name: 'Add Recipe 1 to favorites' });
  fireEvent.click(button);
  expect(screen.getByRole('button', { name: 'Remove Recipe 1 from favorites' })).toHaveAttribute('aria-pressed', 'true');

  reject(new Error('Failed to update favorite.'));
  expect(await screen.findByRole('button', { name: 'Add Recipe 1 to favorites' })).toHaveAttribute('aria-pressed', 'false');
  expect(await screen.findByText('Failed to update favorite.')).toBeInTheDocument();
});

test('visitors do not see management controls', async () => {
  vi.mocked(api.getRecipes).mockResolvedValue([recipe(1)]);
  renderList(false);
  await screen.findByRole('link', { name: 'Recipe 1' });
  expect(screen.queryByRole('link', { name: /New recipe/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /favorites$/ })).not.toBeInTheDocument();
});

test('Dutch tag chips still filter by the stored English tag name', async () => {
  setLanguage('nl');
  vi.mocked(api.getRecipes).mockResolvedValue([]);
  renderList();
  await screen.findByText('Je kluis is leeg');

  fireEvent.click(screen.getByRole('button', { name: 'Diner' }));

  await waitFor(() => expect(window.location.search).toBe('?tag=Dinner'));
  expect(api.getRecipes).toHaveBeenLastCalledWith({ search: '', tag: 'Dinner', favorite: false }, expect.any(AbortSignal));
  expect(screen.getByRole('button', { name: 'Diner' })).toHaveAttribute('aria-pressed', 'true');
});

test('switching language keeps the filters and does not refetch', async () => {
  window.history.replaceState(null, '', '/?q=soup&tag=Dinner');
  vi.mocked(api.getRecipes).mockResolvedValue([recipe(1)]);
  renderList();
  await screen.findByRole('link', { name: 'Recipe 1' });

  act(() => setLanguage('nl'));

  expect(screen.getByRole('searchbox', { name: 'Recepten zoeken' })).toHaveValue('soup');
  expect(screen.getByRole('button', { name: 'Diner' })).toHaveAttribute('aria-pressed', 'true');
  expect(window.location.search).toBe('?q=soup&tag=Dinner');
  expect(api.getRecipes).toHaveBeenCalledTimes(1);
});
