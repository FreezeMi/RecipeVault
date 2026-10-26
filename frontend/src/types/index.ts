import type { Language } from '../lib/i18n';

export interface Ingredient {
  quantity: string;
  unit: string;
  name: string;
}

/** The language-specific part of a recipe, parsed. Times, servings, tags and links are shared. */
export interface RecipeText {
  title: string;
  description: string | null;
  ingredients: Ingredient[];
  instructions: string[];
  notes: string | null;
}

/** A recipe as returned by the API. List-like fields are stored as JSON strings. */
export interface Recipe {
  id: number;
  title: string;
  description: string | null;
  tags: string | null; // JSON array of strings
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  ingredients: string; // JSON array of Ingredient
  instructions: string; // JSON array of strings
  notes: string | null;
  /** Language of title, description, ingredients, instructions and notes. */
  language: Language;
  translations: string | null; // JSON object of RecipeText (lists as arrays) keyed by language
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Payload sent to the API when creating or updating a recipe. */
export interface RecipeInput {
  title: string;
  description: string;
  tags: string[];
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  imageUrl: string;
  sourceUrl: string;
  ingredients: Ingredient[];
  instructions: string[];
  notes: string;
  isFavorite: boolean;
}

export interface RecipeFilters {
  search?: string;
  tag?: string;
  favorite?: boolean;
}

export interface UploadResult {
  success: boolean;
  count: number;
  skipped?: number;
  invalid?: number;
}

export interface DbStatus {
  isOkay: boolean;
  lastCheck: string | null;
}

export interface User {
  id: string;
  email: string;
}
