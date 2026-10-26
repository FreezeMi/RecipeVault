import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test } from 'vitest';
import LanguageSwitcher from '../../components/LanguageSwitcher';

test('shows the current language as pressed and switches on click', () => {
  render(<LanguageSwitcher />);
  const english = screen.getByRole('button', { name: 'English' });
  const dutch = screen.getByRole('button', { name: 'Nederlands' });
  expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
  expect(english).toHaveAttribute('aria-pressed', 'true');
  expect(dutch).toHaveAttribute('aria-pressed', 'false');
  // Each option is announced in its own language.
  expect(dutch).toHaveAttribute('lang', 'nl');

  fireEvent.click(dutch);

  expect(dutch).toHaveAttribute('aria-pressed', 'true');
  expect(english).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('group', { name: 'Taal' })).toBeInTheDocument();
  expect(document.documentElement.lang).toBe('nl');
  expect(window.localStorage.getItem('language')).toBe('nl');
});
