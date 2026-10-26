import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { detectLanguage, getMessages, localeFor, setLanguage, tagLabel, useLanguage, useT } from '../../lib/i18n';
import { en } from '../../locales/en';
import { nl } from '../../locales/nl';

const browserLanguages = (languages: string[]) => vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectLanguage', () => {
  test('a saved choice wins over the browser language', () => {
    browserLanguages(['en-US']);
    window.localStorage.setItem('language', 'nl');
    expect(detectLanguage()).toBe('nl');
  });

  test('otherwise uses the first supported browser language, ignoring the region', () => {
    browserLanguages(['fr-FR', 'nl-BE', 'en']);
    expect(detectLanguage()).toBe('nl');
  });

  test('falls back to English for unsupported languages and junk in storage', () => {
    browserLanguages(['de-DE', 'fr']);
    window.localStorage.setItem('language', 'xx');
    expect(detectLanguage()).toBe('en');
  });

  test('still works when storage is blocked', () => {
    browserLanguages(['nl']);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(detectLanguage()).toBe('nl');
  });
});

describe('setLanguage', () => {
  test('re-renders subscribers, updates <html lang> and remembers the choice', () => {
    const { result } = renderHook(() => ({ language: useLanguage(), t: useT() }));
    expect(result.current.language).toBe('en');

    act(() => setLanguage('nl'));

    expect(result.current.language).toBe('nl');
    expect(result.current.t).toBe(nl);
    expect(getMessages()).toBe(nl);
    expect(document.documentElement.lang).toBe('nl');
    expect(window.localStorage.getItem('language')).toBe('nl');
  });

  test('switches even when the choice cannot be saved', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    setLanguage('nl');
    expect(getMessages()).toBe(nl);
  });
});

test('localeFor prefers the browser regional variant of the language', () => {
  browserLanguages(['en-GB', 'nl-BE']);
  expect(localeFor('nl')).toBe('nl-BE');
  expect(localeFor('en')).toBe('en-GB');

  browserLanguages(['de-DE']);
  expect(localeFor('nl')).toBe('nl');
});

test('tagLabel translates known tags and leaves custom ones as entered', () => {
  expect(tagLabel('Breakfast', nl)).toBe('Ontbijt');
  expect(tagLabel('Breakfast', en)).toBe('Breakfast');
  expect(tagLabel('Family favorite', nl)).toBe('Family favorite');
  // Object prototype keys are not tags.
  expect(tagLabel('constructor', nl)).toBe('constructor');
});
