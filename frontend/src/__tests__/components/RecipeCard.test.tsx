import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import RecipeCard from '../../components/RecipeCard';

const mockRecipe = {
  id: 1,
  title: 'Test Recipe',
  description: 'A delicious test recipe',
  tags: JSON.stringify(['Dessert', 'Quick']),
  prepTime: 10,
  cookTime: 20,
  servings: 4,
  imageUrl: 'http://example.com/image.jpg',
  sourceUrl: null,
  ingredients: JSON.stringify(['1 cup flour', '1 cup sugar']),
  instructions: JSON.stringify(['Mix', 'Bake']),
  notes: 'Very good',
  isFavorite: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test('RecipeCard renders correctly', () => {
  const onClick = vi.fn();
  const onFavorite = vi.fn();

  render(<RecipeCard recipe={mockRecipe} onClick={onClick} onFavorite={onFavorite} />);

  // Check if title is rendered
  expect(screen.getByText('Test Recipe')).toBeInTheDocument();
  // Check if description is rendered
  expect(screen.getByText('A delicious test recipe')).toBeInTheDocument();
  // Check total time calculation (10 + 20)
  expect(screen.getByText('30 min')).toBeInTheDocument();
  // Check servings
  expect(screen.getByText('4 servings')).toBeInTheDocument();
  // Check tags badge (it renders the first tag and +1 for the rest)
  expect(screen.getByText('Dessert')).toBeInTheDocument();
  expect(screen.getByText('+1')).toBeInTheDocument();
});

test('RecipeCard handles interactions', () => {
  const onClick = vi.fn();
  const onFavorite = vi.fn();

  render(<RecipeCard recipe={mockRecipe} onClick={onClick} onFavorite={onFavorite} />);

  // Click on the card
  fireEvent.click(screen.getByText('Test Recipe'));
  expect(onClick).toHaveBeenCalledWith(1);

  // Click on the favorite button
  const favoriteButton = screen.getByTitle('Favorite');
  fireEvent.click(favoriteButton);
  expect(onFavorite).toHaveBeenCalledTimes(1);
});

