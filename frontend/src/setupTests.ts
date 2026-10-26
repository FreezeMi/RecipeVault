import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setLanguage } from './lib/i18n';

// jsdom doesn't implement scrolling APIs.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  // Every test starts in English (jsdom's browser language) with nothing remembered.
  setLanguage('en');
  window.localStorage.clear();
});
