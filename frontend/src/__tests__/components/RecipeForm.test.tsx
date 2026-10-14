import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import RecipeForm from '../../components/RecipeForm';
import { ToastProvider } from '../../components/Toast';
import { api, ApiError } from '../../services/api';
import type { Recipe } from '../../types';

vi.mock('../../services/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../services/api')>();
  return {
    ...actual,
    api: { createRecipe: vi.fn(), updateRecipe: vi.fn(), getRecipe: vi.fn() },
  };
});

const savedRecipe = (overrides: Partial<Recipe> = {}): Recipe => ({
  id: 7,
  title: 'Soup',
  description: null,
  tags: '["Soup","Family favorite"]',
  prepTime: 5,
  cookTime: null,
  servings: 2,
  imageUrl: null,
  sourceUrl: 'https://example.com/soup',
  ingredients: '[{"quantity":"1","unit":"l","name":"stock"}]',
  instructions: '["Boil","Serve"]',
  notes: null,
  isFavorite: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const renderForm = (id?: number) =>
  render(
    <ToastProvider>
      <RecipeForm id={id} />
    </ToastProvider>,
  );

beforeEach(() => {
  vi.mocked(api.createRecipe).mockReset();
  vi.mocked(api.updateRecipe).mockReset();
  vi.mocked(api.getRecipe).mockReset();
  window.history.replaceState(null, '', '/recipes/new');
});

describe('new recipe', () => {
  test('keeps focus in an ingredient field while typing', () => {
    renderForm();
    const name = screen.getByLabelText('Ingredient 1 name');
    name.focus();
    fireEvent.change(name, { target: { value: 'f' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1 name'), { target: { value: 'fl' } });

    // Previously the row key was derived from its content, remounting the input on every keystroke.
    expect(screen.getByLabelText('Ingredient 1 name')).toBe(name);
    expect(document.activeElement).toBe(name);
  });

  test('Enter in an ingredient name adds and focuses a new row', () => {
    renderForm();
    fireEvent.keyDown(screen.getByLabelText('Ingredient 1 name'), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByLabelText('Ingredient 2 quantity'));
  });

  test('shows inline validation errors and does not submit', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Image link/), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    expect(screen.getByText('Give your recipe a title.')).toBeInTheDocument();
    expect(screen.getByText('Enter a full image link starting with https://')).toBeInTheDocument();
    expect(screen.getByText('Add at least one ingredient.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one step.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toHaveAttribute('aria-invalid', 'true');
    expect(document.activeElement).toBe(screen.getByLabelText(/Title/));
    expect(api.createRecipe).not.toHaveBeenCalled();
  });

  test('submits a clean payload and opens the new recipe', async () => {
    vi.mocked(api.createRecipe).mockResolvedValueOnce(savedRecipe({ id: 42 }));
    renderForm();

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: '  Pancakes ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Breakfast' }));
    fireEvent.change(screen.getByLabelText('Prep (min)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1 quantity'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1 name'), { target: { value: 'eggs' } });
    fireEvent.click(screen.getByRole('button', { name: /Add ingredient/ })); // blank row is dropped
    fireEvent.change(screen.getByLabelText('Step 1'), { target: { value: 'Whisk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() => expect(window.location.pathname).toBe('/recipes/42'));
    expect(api.createRecipe).toHaveBeenCalledWith({
      title: 'Pancakes',
      description: '',
      tags: ['Breakfast'],
      prepTime: 10,
      cookTime: null,
      servings: null,
      imageUrl: '',
      sourceUrl: '',
      ingredients: [{ quantity: '2', unit: '', name: 'eggs' }],
      instructions: ['Whisk'],
      notes: '',
      isFavorite: false,
    });
  });
});

describe('edit recipe', () => {
  test('loads the recipe, preserves custom tags and saves cleared numbers as null', async () => {
    vi.mocked(api.getRecipe).mockResolvedValueOnce(savedRecipe());
    vi.mocked(api.updateRecipe).mockResolvedValueOnce(savedRecipe());
    window.history.replaceState(null, '', '/recipes/7/edit');
    renderForm(7);

    const title = await screen.findByLabelText(/Title/);
    expect(title).toHaveValue('Soup');
    // A tag that isn't in the predefined list is still shown (and kept) when editing.
    expect(screen.getByRole('button', { name: 'Family favorite' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByLabelText('Servings'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(api.updateRecipe).toHaveBeenCalled());
    const [id, payload] = vi.mocked(api.updateRecipe).mock.calls[0]!;
    expect(id).toBe(7);
    expect(payload.servings).toBeNull();
    expect(payload.sourceUrl).toBe('https://example.com/soup');
    expect(payload.tags).toEqual(['Soup', 'Family favorite']);
  });

  test('moving a step reorders the instructions', async () => {
    vi.mocked(api.getRecipe).mockResolvedValueOnce(savedRecipe());
    renderForm(7);

    await screen.findByLabelText('Step 1');
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 up' }));
    expect(screen.getByLabelText('Step 1')).toHaveValue('Serve');
    expect(screen.getByLabelText('Step 2')).toHaveValue('Boil');
  });

  test('shows server validation errors', async () => {
    vi.mocked(api.getRecipe).mockResolvedValueOnce(savedRecipe());
    vi.mocked(api.updateRecipe).mockRejectedValueOnce(new ApiError(400, 'title must be at most 200 characters.'));
    renderForm(7);

    await screen.findByLabelText(/Title/);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('title must be at most 200 characters.')).toBeInTheDocument();
  });
});
