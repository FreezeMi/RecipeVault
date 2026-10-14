import type { Ingredient, Recipe } from '../types';

const parseArray = (json: string | null | undefined): unknown[] => {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const asText = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '');

export const parseTags = (json: string | null | undefined): string[] =>
  parseArray(json).filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '');

/** Accepts both { quantity, unit, name } objects and legacy plain-string ingredients. */
export const parseIngredients = (json: string | null | undefined): Ingredient[] =>
  parseArray(json).flatMap((item): Ingredient[] => {
    if (typeof item === 'string') return item.trim() ? [{ quantity: '', unit: '', name: item.trim() }] : [];
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const name = asText(record.name);
      return name ? [{ quantity: asText(record.quantity), unit: asText(record.unit), name }] : [];
    }
    return [];
  });

export const parseInstructions = (json: string | null | undefined): string[] =>
  parseArray(json).filter((step): step is string => typeof step === 'string' && step.trim() !== '');

/** Total of prep + cook time, or null when neither is known. */
export const totalMinutes = (recipe: Pick<Recipe, 'prepTime' | 'cookTime'>): number | null =>
  recipe.prepTime === null && recipe.cookTime === null ? null : (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

export const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

export const formatServings = (servings: number) => `${servings} ${servings === 1 ? 'serving' : 'servings'}`;

/** Only http(s) URLs may be used as link targets or image sources (blocks `javascript:` etc.). */
export const safeHttpUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
};

export const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
