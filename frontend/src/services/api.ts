import { Recipe, RecipeFormData } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

export const api = {
  async getRecipes(params?: { search?: string; category?: string; favorite?: string }): Promise<Recipe[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category && params.category !== 'All') query.append('category', params.category);
    if (params?.favorite === 'true') query.append('favorite', 'true');

    const response = await fetch(`${API_BASE_URL}/recipes?${query.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch recipes');
    return response.json();
  },

  async getRecipe(id: number): Promise<Recipe> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`);
    if (!response.ok) throw new Error('Failed to fetch recipe');
    return response.json();
  },

  async createRecipe(data: RecipeFormData): Promise<Recipe> {
    const response = await fetch(`${API_BASE_URL}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create recipe');
    return response.json();
  },

  async updateRecipe(id: number, data: RecipeFormData): Promise<Recipe> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update recipe');
    return response.json();
  },

  async deleteRecipe(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete recipe');
  },

  async toggleFavorite(id: number): Promise<Recipe> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}/favorite`, {
      method: 'PATCH',
    });
    if (!response.ok) throw new Error('Failed to toggle favorite');
    return response.json();
  },
};

