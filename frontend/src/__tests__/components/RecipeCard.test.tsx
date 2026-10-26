import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import RecipeCard from '../../components/RecipeCard';
import { setLanguage } from '../../lib/i18n';
import type { Recipe } from '../../types';

const mockRecipe: Recipe = {
  id: 1,
  title: 'Test Recipe',
  description: 'A delicious test recipe',
  tags: JSON.stringify(['Dessert', 'Quick', 'Baking']),
  prepTime: 10,
  cookTime: 20,
  servings: 4,
  imageUrl: 'http://example.com/image.jpg',
  sourceUrl: null,
  ingredients: JSON.stringify(['1 cup flour', '1 cup sugar']),
  instructions: JSON.stringify(['Mix', 'Bake']),
  notes: 'Very good',
  language: 'en',
  translations: null,
  isFavorite: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test('renders title, description, time, servings and tags', () => {
  render(<RecipeCard recipe={mockRecipe} />);

  expect(screen.getByText('A delicious test recipe')).toBeInTheDocument();
  expect(screen.getByText('30 min')).toBeInTheDocument();
  expect(screen.getByText('4 servings')).toBeInTheDocument();
  expect(screen.getByText('Dessert')).toBeInTheDocument();
  expect(screen.getByText('Quick')).toBeInTheDocument();
  expect(screen.getByText('+1')).toBeInTheDocument();
});

test('the title is a real link to the recipe page', () => {
  render(<RecipeCard recipe={mockRecipe} />);
  expect(screen.getByRole('link', { name: 'Test Recipe' })).toHaveAttribute('href', '/recipes/1');
});

test('visitors get no favorite toggle', () => {
  render(<RecipeCard recipe={mockRecipe} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('signed-in users can toggle favorites', () => {
  const onToggleFavorite = vi.fn();
  render(<RecipeCard recipe={mockRecipe} onToggleFavorite={onToggleFavorite} />);

  const button = screen.getByRole('button', { name: 'Add Test Recipe to favorites' });
  expect(button).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(button);
  expect(onToggleFavorite).toHaveBeenCalledWith(mockRecipe);
});

test('renders in Dutch, translating known tags and keeping custom ones', () => {
  setLanguage('nl');
  render(<RecipeCard recipe={{ ...mockRecipe, tags: JSON.stringify(['Breakfast', 'Quick']) }} onToggleFavorite={vi.fn()} />);

  expect(screen.getByText('4 personen')).toBeInTheDocument();
  expect(screen.getByText('Ontbijt')).toBeInTheDocument();
  expect(screen.getByText('Quick')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Test Recipe toevoegen aan favorieten' })).toBeInTheDocument();
});

test('shows the translation for the interface language, and marks untranslated text with its language', () => {
  setLanguage('nl');
  const translations = JSON.stringify({ nl: { title: 'Testrecept', description: 'Een heerlijk testrecept' } });
  const { unmount } = render(<RecipeCard recipe={{ ...mockRecipe, translations }} onToggleFavorite={vi.fn()} />);
  expect(screen.getByRole('link', { name: 'Testrecept' })).toBeInTheDocument();
  expect(screen.getByText('Een heerlijk testrecept')).not.toHaveAttribute('lang');
  expect(screen.getByRole('button', { name: 'Testrecept toevoegen aan favorieten' })).toBeInTheDocument();
  unmount();

  render(<RecipeCard recipe={mockRecipe} />);
  expect(screen.getByRole('heading', { name: 'Test Recipe' })).toHaveAttribute('lang', 'en');
  expect(screen.getByText('A delicious test recipe')).toHaveAttribute('lang', 'en');
});

test('unsafe image URLs are never rendered', () => {
  const { container } = render(<RecipeCard recipe={{ ...mockRecipe, imageUrl: 'javascript:alert(1)' }} />);
  expect(container.querySelector('img')).toBeNull();
});
