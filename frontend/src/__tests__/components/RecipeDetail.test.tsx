import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import RecipeDetail from '../../components/RecipeDetail';
import { useAuth } from '../../components/AuthContext';
import { ToastProvider } from '../../components/Toast';
import { api, ApiError } from '../../services/api';
import { setLanguage } from '../../lib/i18n';
import type { Recipe } from '../../types';

vi.mock('../../services/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: { getRecipe: vi.fn(), deleteRecipe: vi.fn(), toggleFavorite: vi.fn() },
  };
});

vi.mock('../../components/AuthContext', () => ({ useAuth: vi.fn() }));

const signedIn = (authenticated: boolean) =>
  vi.mocked(useAuth).mockReturnValue({ authenticated } as ReturnType<typeof useAuth>);

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
  language: 'en',
  translations: null,
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
  vi.mocked(api.toggleFavorite).mockReset();
  signedIn(true);
  window.history.replaceState(null, '', '/recipes/7');
});

describe('loading and errors', () => {
  const renderPage = () =>
    render(
      <ToastProvider>
        <RecipeDetail id={7} />
      </ToastProvider>,
    );

  test('shows a loader until the recipe arrives', async () => {
    let resolve!: (value: Recipe) => void;
    vi.mocked(api.getRecipe).mockReturnValueOnce(new Promise(r => (resolve = r)));
    renderPage();

    expect(screen.getByText('Opening recipe…')).toBeInTheDocument();
    resolve(recipe);
    expect(await screen.findByRole('heading', { name: 'Soup' })).toBeInTheDocument();
    expect(screen.queryByText('Opening recipe…')).not.toBeInTheDocument();
  });

  test('a missing recipe says so without offering a retry', async () => {
    vi.mocked(api.getRecipe).mockRejectedValueOnce(new ApiError(404, 'Recipe not found'));
    renderPage();

    expect(await screen.findByText('This recipe could not be found.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to recipes' })).toHaveAttribute('href', '/');
  });

  test('other failures show the error and can be retried', async () => {
    vi.mocked(api.getRecipe).mockRejectedValueOnce(new ApiError(500, 'Server unavailable.'));
    renderPage();

    expect(await screen.findByText('Server unavailable.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Soup' })).toBeInTheDocument();
    expect(api.getRecipe).toHaveBeenCalledTimes(2);
  });
});

test('visitors can change the serving size but get no edit or delete actions', async () => {
  signedIn(false);
  await renderDetail();

  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
  expect(screen.getByText('1.5 l')).toBeInTheDocument();
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

  test('while deleting, both buttons are disabled and Escape is ignored', async () => {
    vi.mocked(api.deleteRecipe).mockReturnValueOnce(new Promise(() => {}));
    await renderDetail();
    const dialog = openConfirmation();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
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

  test('highlights adjusted amounts but not the ones shown as written', async () => {
    await renderWith();
    expect(screen.getByText('1 l')).not.toHaveClass('text-brand-700');

    more();
    expect(screen.getByText('1.5 l')).toHaveClass('text-brand-700');
    expect(screen.getByText('a pinch')).not.toHaveClass('text-brand-700');
  });

  test('changing the serving size never calls the API', async () => {
    await renderWith();
    more();
    fewer();
    fewer();

    expect(api.getRecipe).toHaveBeenCalledTimes(1);
    expect(api.toggleFavorite).not.toHaveBeenCalled();
    expect(api.deleteRecipe).not.toHaveBeenCalled();
  });

  test('checked ingredients stay checked when the serving size changes', async () => {
    await renderWith();
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);
    more();

    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
    expect(screen.getByText('1.5 l')).toBeInTheDocument();
  });

  test('the selected serving size survives toggling favorite', async () => {
    vi.mocked(api.toggleFavorite).mockResolvedValueOnce({ ...soup, isFavorite: true });
    await renderWith();
    more();
    fireEvent.click(screen.getByRole('button', { name: 'Add to favorites' }));

    expect(await screen.findByRole('button', { name: 'Favorite' })).toHaveAttribute('aria-pressed', 'true');
    expect(selector()).toHaveTextContent('3 servings');
    expect(screen.getByText('1.5 l')).toBeInTheDocument();
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

test('switching language keeps the selected servings and checked ingredients without refetching', async () => {
  await renderDetail();
  fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
  fireEvent.click(screen.getAllByRole('checkbox')[0]!);

  act(() => setLanguage('nl'));

  expect(screen.getByRole('heading', { name: 'Ingrediënten' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Personen' })).toHaveTextContent('3 personen');
  expect(screen.getByText('1.5 l')).toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
  expect(screen.getByRole('button', { name: 'Herstellen naar 2 personen' })).toBeInTheDocument();
  expect(api.getRecipe).toHaveBeenCalledTimes(1);
});

describe('languages', () => {
  const translated: Recipe = {
    ...recipe,
    notes: 'Serve hot',
    translations: JSON.stringify({
      nl: {
        title: 'Soep',
        description: 'Warm en romig',
        ingredients: [
          { quantity: '1', unit: 'teentje', name: 'knoflook' },
          { quantity: '1', unit: 'l', name: 'bouillon' },
        ],
        instructions: ['Koken', 'Opdienen'],
        notes: 'Heet serveren',
      },
    }),
  };

  const renderPage = async (heading: string) => {
    render(
      <ToastProvider>
        <RecipeDetail id={7} />
      </ToastProvider>,
    );
    return screen.findByRole('heading', { name: heading });
  };

  test('shows the Dutch translation in Dutch and scales it the Dutch way', async () => {
    setLanguage('nl');
    vi.mocked(api.getRecipe).mockResolvedValue(translated);
    expect(await renderPage('Soep')).not.toHaveAttribute('lang');

    expect(screen.getByText('Warm en romig')).toBeInTheDocument();
    expect(screen.getByText('Opdienen')).toBeInTheDocument();
    expect(screen.getByText('Heet serveren')).toBeInTheDocument();
    expect(screen.queryByText(/nog niet in het Nederlands vertaald/)).not.toBeInTheDocument();
    expect(document.title).toBe('Soep · Recipe Vault');

    fireEvent.click(screen.getByRole('button', { name: 'Meer personen' }));
    expect(screen.getByText('1½ teentjes')).toBeInTheDocument();
    expect(screen.getByText('1,5 l')).toBeInTheDocument();
  });

  test('without a translation it shows the original, says so, and marks its language', async () => {
    setLanguage('nl');
    expect(await renderPage('Soup')).toHaveAttribute('lang', 'en');
    expect(screen.getByText('Dit recept is nog niet in het Nederlands vertaald en wordt in het Engels getoond.')).toBeInTheDocument();
  });

  test('a recipe written in Dutch says so in English', async () => {
    vi.mocked(api.getRecipe).mockResolvedValue({ ...recipe, title: 'Erwtensoep', language: 'nl' });
    expect(await renderPage('Erwtensoep')).toHaveAttribute('lang', 'nl');
    expect(screen.getByText("This recipe isn't available in English yet, so it's shown in Dutch.")).toBeInTheDocument();
  });

  test('switching language swaps the text in place; ticked ingredients belong to one language', async () => {
    vi.mocked(api.getRecipe).mockResolvedValue(translated);
    await renderPage('Soup');
    fireEvent.click(screen.getAllByRole('checkbox')[0]!);

    act(() => setLanguage('nl'));
    expect(screen.getByRole('heading', { name: 'Soep' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')[0]).not.toBeChecked();

    act(() => setLanguage('en'));
    expect(screen.getByRole('heading', { name: 'Soup' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
    expect(api.getRecipe).toHaveBeenCalledTimes(1);
  });
});
