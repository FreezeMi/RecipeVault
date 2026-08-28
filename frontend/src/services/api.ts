import { Recipe, RecipeFormData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const defaultOptions: RequestInit = {
  credentials: 'include',
};

export const api = {
  async getRecipes(params?: { search?: string; tags?: string; favorite?: string }): Promise<Recipe[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.tags && params.tags !== 'All') query.append('tags', params.tags);
    if (params?.favorite === 'true') query.append('favorite', 'true');

    const response = await fetch(`${API_BASE_URL}/recipes?${query.toString()}`, { ...defaultOptions });
    if (!response.ok) throw new Error('Failed to fetch recipes');
    return response.json();
  },

  async getRecipe(id: number): Promise<Recipe> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`, { ...defaultOptions });
    if (!response.ok) throw new Error('Failed to fetch recipe');
    return response.json();
  },

  async createRecipe(data: RecipeFormData): Promise<Recipe> {
    const response = await fetch(`${API_BASE_URL}/recipes`, {
      ...defaultOptions,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create recipe');
    return response.json();
  },

  async updateRecipe(id: number, data: RecipeFormData): Promise<Recipe> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
      ...defaultOptions,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update recipe');
    return response.json();
  },

  async deleteRecipe(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
      ...defaultOptions,
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete recipe');
  },

  async toggleFavorite(id: number): Promise<Recipe> {
    const response = await fetch(`${API_BASE_URL}/recipes/${id}/favorite`, {
      ...defaultOptions,
      method: 'PATCH',
    });
    if (!response.ok) throw new Error('Failed to toggle favorite');
    return response.json();
  },
};



export const authApi = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      ...defaultOptions,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Login failed');
    }
    return response.json();
  },
  
  async logout() {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      ...defaultOptions,
      method: 'POST',
    });
    if (!response.ok) throw new Error('Logout failed');
    return response.json();
  },
  
  async getMe() {
    const response = await fetch(`${API_BASE_URL}/auth/me`, { ...defaultOptions });
    if (!response.ok) throw new Error('Failed to get session');
    return response.json();
  }
};
