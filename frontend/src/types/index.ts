export interface Ingredient {
  quantity: string;
  unit: string;
  name: string;
}

export interface Recipe {
  id: number;
  title: string;
  description: string | null;
  tags: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  ingredients: string; // JSON string from backend
  instructions: string; // JSON string from backend
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeFormData {
  title: string;
  description: string;
  tags: string[];
  prepTime: number | '';
  cookTime: number | '';
  servings: number | '';
  imageUrl: string;
  sourceUrl: string;
  ingredients: Ingredient[];
  instructions: string[];
  notes: string;
  isFavorite: boolean;
}

