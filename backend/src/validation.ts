// Input normalization for recipe payloads.
//
// The database stores tags, ingredients, instructions and translations as JSON strings. Clients
// may send either real arrays/objects (the web form) or the JSON strings returned by the API
// (backup files), so both shapes are accepted here and normalized into a single canonical form.

export const LIMITS = {
  title: 200,
  description: 2000,
  notes: 5000,
  url: 2048,
  tag: 50,
  tags: 30,
  ingredientQuantity: 50,
  ingredientUnit: 50,
  ingredientName: 500,
  ingredients: 200,
  instruction: 5000,
  instructions: 200,
  minutes: 7 * 24 * 60,
  servings: 1000,
  search: 100,
} as const;

export const PASSWORD_RULES = {
  minLength: 12,
  // bcrypt silently ignores everything past 72 bytes, so longer passwords give a false sense of security.
  maxBytes: 72,
} as const;

/** Languages a recipe can be written or translated in. Mirrors LANGUAGES in frontend/src/lib/i18n.ts. */
export const LANGUAGES = ['en', 'nl'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface Ingredient {
  quantity: string;
  unit: string;
  name: string;
}

/** The recipe text in another language. Times, servings, tags and links are shared by all languages. */
export interface RecipeTranslation {
  title: string;
  description: string | null;
  ingredients: Ingredient[];
  instructions: string[];
  notes: string | null;
}

export interface RecipeData {
  title: string;
  description: string | null;
  tags: string;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  ingredients: string;
  instructions: string;
  notes: string | null;
  isFavorite?: boolean;
  // Left out when the payload doesn't mention them, so an update from a client that doesn't
  // know about languages keeps what is stored. A new recipe then gets the database defaults.
  language?: Language;
  translations?: string | null; // JSON object of RecipeTranslation keyed by language
  createdAt?: Date;
}

export type ValidationResult =
  | { ok: true; data: RecipeData }
  | { ok: false; errors: string[] };

/**
 * strict  – API writes from the app: any invalid field rejects the request.
 * lenient – backup restore: unsalvageable optional fields (e.g. a bad URL) are dropped and
 *           over-long values truncated instead of rejecting the recipe, so old backups keep importing.
 */
export type ValidationMode = 'strict' | 'lenient';

/** Collects errors in strict mode; in lenient mode problems are silently repaired. */
class Checker {
  readonly errors: string[] = [];
  constructor(readonly lenient: boolean) {}

  fail(message: string) {
    if (!this.lenient && !this.errors.includes(message)) this.errors.push(message);
  }

  /** Enforces a maximum list length, truncating in lenient mode. */
  cap<T>(items: T[], max: number, message: string): T[] {
    if (items.length <= max) return items;
    this.fail(message);
    return items.slice(0, max);
  }
}

const isBlank = (value: unknown) => value === undefined || value === null || value === '';

const parseJsonArray = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  if (value.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'string') return isRecord(value) ? value : null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isLanguage = (value: unknown): value is Language => LANGUAGES.some(language => language === value);

export const toSafeHttpUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > LIMITS.url) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Parses a route `:id` parameter; returns null for anything that is not a positive int32. */
export const parseId = (value: unknown): number | null => {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 && id <= 2_147_483_647 ? id : null;
};

/** Normalizes a query-string value (Express may give string | string[] | object). */
export const getQueryString = (value: unknown): string | undefined => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first.trim() !== '' ? first.trim() : undefined;
};

/** Key used to detect duplicate recipes on import (case/whitespace-insensitive title). */
export const titleKey = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeTitle = (value: unknown, check: Checker): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    // A title is required even when restoring backups.
    check.errors.push('Title is required.');
    return '';
  }
  const title = value.trim();
  if (title.length <= LIMITS.title) return title;
  check.fail(`title must be at most ${LIMITS.title} characters.`);
  return title.slice(0, LIMITS.title);
};

const normalizeText = (field: string, value: unknown, max: number, check: Checker): string | null => {
  if (isBlank(value)) return null;
  if (typeof value !== 'string') {
    check.fail(`${field} must be a string.`);
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    check.fail(`${field} must be at most ${max} characters.`);
    return trimmed.slice(0, max);
  }
  return trimmed || null;
};

const normalizeInt = (field: string, value: unknown, min: number, max: number, check: Checker): number | null => {
  if (isBlank(value)) return null;
  const num = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof num === 'number' && Number.isInteger(num) && num >= min && num <= max) return num;
  check.fail(`${field} must be a whole number between ${min} and ${max}.`);
  return null;
};

const normalizeUrl = (field: string, value: unknown, check: Checker): string | null => {
  if (isBlank(value)) return null;
  const url = toSafeHttpUrl(value);
  if (!url) check.fail(`${field} must be a valid http(s) URL.`);
  return url;
};

const normalizeTags = (value: unknown, check: Checker): string[] => {
  if (isBlank(value)) return [];
  const parsed = parseJsonArray(value);
  if (!parsed) {
    check.fail('tags must be an array of strings.');
    return [];
  }

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const tag of parsed) {
    if (typeof tag !== 'string') {
      check.fail('tags must be an array of strings.');
      continue;
    }
    const trimmed = tag.trim().slice(0, LIMITS.tag);
    const key = trimmed.toLowerCase();
    if (trimmed && !seen.has(key)) {
      seen.add(key);
      tags.push(trimmed);
    }
  }
  return check.cap(tags, LIMITS.tags, `A recipe can have at most ${LIMITS.tags} tags.`);
};

const ingredientField = (value: unknown, max: number) =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) : '';

// Accepts { quantity, unit, name } objects, or plain strings treated as the ingredient name.
const toIngredient = (item: unknown): Ingredient | null => {
  if (typeof item === 'string') {
    return { quantity: '', unit: '', name: ingredientField(item, LIMITS.ingredientName) };
  }
  if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
    const record = item as Record<string, unknown>;
    return {
      quantity: ingredientField(record.quantity, LIMITS.ingredientQuantity),
      unit: ingredientField(record.unit, LIMITS.ingredientUnit),
      name: ingredientField(record.name, LIMITS.ingredientName),
    };
  }
  return null;
};

const normalizeIngredients = (value: unknown, check: Checker): Ingredient[] => {
  const parsed = parseJsonArray(value ?? []);
  if (!parsed) {
    check.errors.push('ingredients must be an array.');
    return [];
  }

  const ingredients: Ingredient[] = [];
  for (const item of parsed) {
    const ingredient = toIngredient(item);
    if (!ingredient) check.fail('Each ingredient must be an object with a name.');
    // Rows without a name are empty form rows; drop them.
    else if (ingredient.name) ingredients.push(ingredient);
  }
  return check.cap(ingredients, LIMITS.ingredients, `A recipe can have at most ${LIMITS.ingredients} ingredients.`);
};

const normalizeInstructions = (value: unknown, check: Checker): string[] => {
  const parsed = parseJsonArray(value ?? []);
  if (!parsed) {
    check.errors.push('instructions must be an array.');
    return [];
  }

  const steps: string[] = [];
  for (const step of parsed) {
    if (typeof step !== 'string') {
      check.fail('Each instruction must be a string.');
      continue;
    }
    const trimmed = step.trim();
    if (trimmed.length > LIMITS.instruction) {
      check.fail(`Each instruction must be at most ${LIMITS.instruction} characters.`);
    }
    if (trimmed) steps.push(trimmed.slice(0, LIMITS.instruction));
  }
  return check.cap(steps, LIMITS.instructions, `A recipe can have at most ${LIMITS.instructions} steps.`);
};

const normalizeLanguage = (value: unknown, check: Checker): Language | undefined => {
  if (value === undefined) return undefined;
  if (isLanguage(value)) return value;
  check.fail(`language must be one of: ${LANGUAGES.join(', ')}.`);
  return undefined;
};

/** One translation, held to the same rules as the recipe's own text. Null when it can't be repaired. */
const normalizeTranslation = (language: Language, value: unknown, check: Checker): RecipeTranslation | null => {
  const own = new Checker(check.lenient);
  let translation: RecipeTranslation | null = null;
  if (isRecord(value)) {
    translation = {
      title: normalizeTitle(value.title, own),
      description: normalizeText('description', value.description, LIMITS.description, own),
      ingredients: normalizeIngredients(value.ingredients, own),
      instructions: normalizeInstructions(value.instructions, own),
      notes: normalizeText('notes', value.notes, LIMITS.notes, own),
    };
  } else {
    own.errors.push('must be an object.');
  }
  // Prefixed so the message says which translation is wrong (in lenient mode `fail` records nothing).
  for (const error of own.errors) check.fail(`translations.${language}: ${error}`);
  return own.errors.length > 0 ? null : translation;
};

/**
 * Returns the translations as a JSON string, null to clear them, or undefined when the payload
 * doesn't mention them. A translation that can't be repaired is an error in strict mode and is
 * dropped (keeping the recipe) in lenient mode.
 */
const normalizeTranslations = (value: unknown, language: Language | undefined, check: Checker): string | null | undefined => {
  if (value === undefined) return undefined;
  if (isBlank(value)) return null;
  const entries = parseJsonObject(value);
  if (!entries) {
    check.fail('translations must be an object keyed by language.');
    return undefined;
  }

  const unsupported = Object.keys(entries).filter(key => !isLanguage(key));
  if (unsupported.length > 0) check.fail(`translations has unsupported languages: ${unsupported.join(', ').slice(0, 100)}.`);

  // Built in LANGUAGES order so the stored JSON doesn't depend on the order the client used.
  const translations: Partial<Record<Language, RecipeTranslation>> = {};
  for (const key of LANGUAGES) {
    if (!Object.hasOwn(entries, key)) continue;
    // Only checkable when the payload states the recipe's language; an update may leave it out.
    if (key === language) {
      check.fail(`translations cannot include the recipe's own language (${key}).`);
      continue;
    }
    const translation = normalizeTranslation(key, entries[key], check);
    if (translation) translations[key] = translation;
  }
  return Object.keys(translations).length > 0 ? JSON.stringify(translations) : null;
};

const normalizeCreatedAt = (value: unknown): Date | undefined => {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) || time > Date.now() ? undefined : date;
};

export function normalizeRecipeInput(input: unknown, mode: ValidationMode = 'strict'): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['Recipe must be an object.'] };
  }

  const body = input as Record<string, unknown>;
  const check = new Checker(mode === 'lenient');

  const data: RecipeData = {
    title: normalizeTitle(body.title, check),
    description: normalizeText('description', body.description, LIMITS.description, check),
    tags: JSON.stringify(normalizeTags(body.tags, check)),
    prepTime: normalizeInt('prepTime', body.prepTime, 0, LIMITS.minutes, check),
    cookTime: normalizeInt('cookTime', body.cookTime, 0, LIMITS.minutes, check),
    servings: normalizeInt('servings', body.servings, 1, LIMITS.servings, check),
    imageUrl: normalizeUrl('imageUrl', body.imageUrl, check),
    sourceUrl: normalizeUrl('sourceUrl', body.sourceUrl, check),
    ingredients: JSON.stringify(normalizeIngredients(body.ingredients, check)),
    instructions: JSON.stringify(normalizeInstructions(body.instructions, check)),
    notes: normalizeText('notes', body.notes, LIMITS.notes, check),
  };

  if (typeof body.isFavorite === 'boolean') data.isFavorite = body.isFavorite;
  else if (body.isFavorite !== undefined) check.fail('isFavorite must be a boolean.');

  const language = normalizeLanguage(body.language, check);
  if (language) data.language = language;
  const translations = normalizeTranslations(body.translations, language, check);
  if (translations !== undefined) data.translations = translations;

  // Restored backups keep their original creation date so the vault order is preserved.
  if (check.lenient) {
    const createdAt = normalizeCreatedAt(body.createdAt);
    if (createdAt) data.createdAt = createdAt;
  }

  return check.errors.length > 0 ? { ok: false, errors: check.errors } : { ok: true, data };
}
