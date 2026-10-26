import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import RecipeDetail from '../../components/RecipeDetail';
import { ToastProvider } from '../../components/Toast';
import { api, ApiError } from '../../services/api';
import type { Recipe } from '../../types';

vi.mock('../../services/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: { getRecipe: vi.fn(), deleteRecipe: vi.fn(), toggleFavorite: vi.fn() },
  };
});

vi.mock('../../components/AuthContext', () => ({
  useAuth: () => ({ authenticated: true }),
}));

const recipe: Recipe = {
  id: 7,
  title: 'Soup',
  description: null,
  tags: '[]',
  prepTime: 5,
  cookTime: 10,
  servings: 2,
  imageUrl: null,
  sourceUrl: null,
  ingredients: '[{"quantity":"1","unit":"l","name":"stock"}]',
  instructions: '["Boil","Serve"]',
  notes: null,
  isFavorite: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const renderDetail = async () => {
  render(
    <ToastProvider>
      <RecipeDetail id={7} />
    </ToastProvider>,
  );
  await screen.findByRole('heading', { name: 'Soup' });
};

const openConfirmation = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  return screen.getByRole('alertdialog', { name: 'Delete this recipe?' });
};

beforeEach(() => {
  vi.mocked(api.getRecipe).mockReset().mockResolvedValue(recipe);
  vi.mocked(api.deleteRecipe).mockReset();
  window.history.replaceState(null, '', '/recipes/7');
});

describe('delete confirmation', () => {
  test('replaces the actions with a described confirmation and focuses Cancel', async () => {
    await renderDetail();
    const dialog = openConfirmation();

    expect(dialog).toHaveAccessibleDescription("It will be permanently removed from your vault. This can't be undone.");
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  test('Cancel closes it without deleting and returns focus to Delete', async () => {
    await renderDetail();
    openConfirmation();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteRecipe).not.toHaveBeenCalled();
  });

  test('Escape closes it without deleting', async () => {
    await renderDetail();
    fireEvent.keyDown(openConfirmation(), { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(api.deleteRecipe).not.toHaveBeenCalled();
  });

  test('Delete removes the recipe and returns to the list', async () => {
    vi.mocked(api.deleteRecipe).mockResolvedValueOnce({ success: true });
    await renderDetail();
    openConfirmation();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(api.deleteRecipe).toHaveBeenCalledWith(7);
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  test('a failed delete closes the confirmation and shows the error', async () => {
    vi.mocked(api.deleteRecipe).mockRejectedValueOnce(new ApiError(500, 'Server unavailable.'));
    await renderDetail();
    openConfirmation();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Server unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/recipes/7');
  });
});
