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

describe('serving size', () => {
  const soup: Recipe = {
    ...recipe,
    servings: 2,
    ingredients: JSON.stringify([
      { quantity: '1', unit: 'l', name: 'stock' },
      { quantity: '1/2', unit: 'cup', name: 'cream' },
      { quantity: 'a pinch', unit: '', name: 'nutmeg' },
      { quantity: '', unit: '', name: 'salt to taste' },
    ]),
  };

  const renderWith = async (overrides: Partial<Recipe> = {}) => {
    vi.mocked(api.getRecipe).mockResolvedValue({ ...soup, ...overrides });
    await renderDetail();
  };
  const selector = () => screen.getByRole('group', { name: 'Servings' });
  const more = () => fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
  const fewer = () => fireEvent.click(screen.getByRole('button', { name: 'Fewer servings' }));

  test("starts at the recipe's own serving count with amounts as written", async () => {
    await renderWith();
    expect(selector()).toHaveTextContent('2 servings');
    expect(screen.getByText('As written in the recipe')).toBeInTheDocument();
    expect(screen.getByText('1 l')).toBeInTheDocument();
    expect(screen.getByText('1/2 cup')).toBeInTheDocument();
  });

  test('scales numeric amounts and leaves the rest as written', async () => {
    await renderWith();
    more();

    expect(selector()).toHaveTextContent('3 servings');
    expect(screen.getByText('1.5 l')).toBeInTheDocument();
    expect(screen.getByText('¾ cup')).toBeInTheDocument();
    expect(screen.getByText('a pinch')).toBeInTheDocument();
    expect(screen.getByText('salt to taste')).toBeInTheDocument();
    expect(screen.getByText(/Scaled from 2/)).toBeInTheDocument();
    expect(screen.getByText("Some amounts couldn't be adjusted and are shown as written.")).toBeInTheDocument();
  });

  test('stops at 1 serving', async () => {
    await renderWith();
    fewer();
    fewer();

    expect(selector()).toHaveTextContent(/^1 serving$/);
    expect(screen.getByRole('button', { name: 'Fewer servings' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('0.5 l')).toBeInTheDocument();
    expect(screen.getByText('¼ cup')).toBeInTheDocument();
  });

  test('stops at 12 servings', async () => {
    await renderWith();
    for (let i = 0; i < 15; i++) more();

    expect(selector()).toHaveTextContent('12 servings');
    expect(screen.getByRole('button', { name: 'More servings' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('6 l')).toBeInTheDocument();
    expect(screen.getByText('3 cups')).toBeInTheDocument();
  });

  test('Reset goes back to the amounts as written', async () => {
    await renderWith();
    more();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to 2 servings' }));

    expect(selector()).toHaveTextContent('2 servings');
    expect(screen.getByText('1 l')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't be adjusted/)).not.toBeInTheDocument();
  });

  test('a recipe for more than 12 can step down to 12 and back to its own yield', async () => {
    await renderWith({ servings: 24, ingredients: '[{"quantity":"24","unit":"","name":"cookies"}]' });
    fewer();
    const cookies = () => screen.getByRole('checkbox').closest('label');
    expect(selector()).toHaveTextContent('12 servings');
    expect(cookies()).toHaveTextContent('12 cookies');

    more();
    expect(selector()).toHaveTextContent('24 servings');
    expect(cookies()).toHaveTextContent('24 cookies');
    expect(screen.getByRole('button', { name: 'More servings' })).toHaveAttribute('aria-disabled', 'true');
  });

  test('is hidden without a serving count', async () => {
    await renderWith({ servings: null });
    expect(screen.queryByRole('group', { name: 'Servings' })).not.toBeInTheDocument();
  });

  test('is hidden when no amount can be scaled', async () => {
    await renderWith({ ingredients: '["2 eggs", {"quantity":"a pinch","unit":"","name":"salt"}]' });
    expect(screen.queryByRole('group', { name: 'Servings' })).not.toBeInTheDocument();
  });
});
