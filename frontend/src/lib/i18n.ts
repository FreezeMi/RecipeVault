// The interface language, kept in a tiny external store like the router in ./router.tsx. Two
// languages don't justify an i18n dependency, and the typed dictionaries in ../locales turn a
// missing translation into a type error.
import { useSyncExternalStore } from 'react';
import type { RecipeCategory } from '../constants';
import { en, type Messages } from '../locales/en';
import { nl } from '../locales/nl';

export type { Messages } from '../locales/en';

export const LANGUAGES = ['en', 'nl'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each language's name in that language, as offered in the language switcher. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', nl: 'Nederlands' };

const MESSAGES: Record<Language, Messages> = { en, nl };

const STORAGE_KEY = 'language';

export const isLanguage = (value: unknown): value is Language => LANGUAGES.some(language => language === value);

/** The browser's language tags, most preferred first. */
const browserLanguages = (): readonly string[] =>
  navigator.languages?.length ? navigator.languages : [navigator.language];

// "nl-BE" and "NL" both mean Dutch.
const baseLanguage = (tag: string) => tag.split('-')[0]?.toLowerCase();

const readStoredLanguage = (): Language | null => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : null;
  } catch {
    return null; // Storage can be blocked (private windows, disabled site data).
  }
};

/** A saved choice wins, then the first supported browser language, then English. */
export function detectLanguage(): Language {
  return readStoredLanguage() ?? browserLanguages().map(baseLanguage).find(isLanguage) ?? 'en';
}

let current: Language = detectLanguage();
document.documentElement.lang = current;

const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getLanguage = (): Language => current;

/** Switches the interface language and remembers the choice for later visits. */
export function setLanguage(language: Language) {
  if (language === current) return;
  current = language;
  document.documentElement.lang = language;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not remembered, but the switch still applies until the page is closed.
  }
  listeners.forEach(listener => listener());
}

/** The interface language; re-renders when it changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

/** Interface text in the current language. */
export function useT(): Messages {
  return MESSAGES[useLanguage()];
}

/** Interface text for code outside React (e.g. the API client). Read it when the text is needed. */
export const getMessages = (): Messages => MESSAGES[current];

/** Interface text in a specific language, e.g. to reserve room for the longest translation. */
export const messagesFor = (language: Language): Messages => MESSAGES[language];

/** Locale for dates and numbers: the browser's regional variant of the language ("nl-BE") if it has one. */
export const localeFor = (language: Language): string =>
  browserLanguages().find(tag => baseLanguage(tag) === language) ?? language;

/** A tag's display name. Tags are stored under their English name; custom tags are shown as entered. */
export const tagLabel = (tag: string, t: Messages): string =>
  Object.hasOwn(t.tags, tag) ? t.tags[tag as RecipeCategory] : tag;
