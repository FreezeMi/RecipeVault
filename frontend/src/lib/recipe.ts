import type { Ingredient, Recipe, RecipeText } from '../types';
import { LANGUAGES, isLanguage, type Language, type Messages } from './i18n';

const parseJson = (json: string | null | undefined): unknown => {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return undefined;
  }
};

/** Accepts a JSON string (top-level recipe fields) or an array (inside translations). */
const parseArray = (value: unknown): unknown[] => {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  return Array.isArray(parsed) ? parsed : [];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asText = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '');

export const parseTags = (json: string | null | undefined): string[] =>
  parseArray(json).filter((tag): tag is string => typeof tag === 'string' && tag.trim() !== '');

/** Accepts both { quantity, unit, name } objects and legacy plain-string ingredients. */
export const parseIngredients = (json: unknown): Ingredient[] =>
  parseArray(json).flatMap((item): Ingredient[] => {
    if (typeof item === 'string') return item.trim() ? [{ quantity: '', unit: '', name: item.trim() }] : [];
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const name = asText(record.name);
      return name ? [{ quantity: asText(record.quantity), unit: asText(record.unit), name }] : [];
    }
    return [];
  });

export const parseInstructions = (json: unknown): string[] =>
  parseArray(json).filter((step): step is string => typeof step === 'string' && step.trim() !== '');

/** Translations keyed by language. Unknown languages and entries without a title are skipped. */
export const parseTranslations = (json: string | null | undefined): Partial<Record<Language, RecipeText>> => {
  const value = parseJson(json);
  const translations: Partial<Record<Language, RecipeText>> = {};
  if (!isRecord(value)) return translations;
  for (const language of LANGUAGES) {
    const entry = value[language];
    if (!isRecord(entry) || !asText(entry.title)) continue;
    translations[language] = {
      title: asText(entry.title),
      description: asText(entry.description) || null,
      ingredients: parseIngredients(entry.ingredients),
      instructions: parseInstructions(entry.instructions),
      notes: asText(entry.notes) || null,
    };
  }
  return translations;
};

export interface LocalizedRecipe {
  text: RecipeText;
  /** The language `text` is in. */
  language: Language;
  /** The requested language isn't available, so the recipe is shown in its original language. */
  isFallback: boolean;
}

type RecipeContent = Pick<Recipe, 'title' | 'description' | 'ingredients' | 'instructions' | 'notes' | 'language' | 'translations'>;

/**
 * The recipe's text in `language`: its translation, or the original when the recipe was written
 * in that language or hasn't been translated yet. Whole recipes are shown in one language, never mixed.
 */
export function localizeRecipe(recipe: RecipeContent, language: Language): LocalizedRecipe {
  // Responses from before recipes had a language are English.
  const original = isLanguage(recipe.language) ? recipe.language : 'en';
  const translation = language === original ? undefined : parseTranslations(recipe.translations)[language];
  if (translation) return { text: translation, language, isFallback: false };
  return {
    text: {
      title: recipe.title,
      description: recipe.description,
      ingredients: parseIngredients(recipe.ingredients),
      instructions: parseInstructions(recipe.instructions),
      notes: recipe.notes,
    },
    language: original,
    isFallback: language !== original,
  };
}

/** Total of prep + cook time, or null when neither is known. */
export const totalMinutes = (recipe: Pick<Recipe, 'prepTime' | 'cookTime'>): number | null =>
  recipe.prepTime === null && recipe.cookTime === null ? null : (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

export const formatMinutes = (minutes: number, t: Messages): string =>
  minutes < 60 ? t.format.minutes(minutes) : t.format.hours(Math.floor(minutes / 60), minutes % 60);

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
