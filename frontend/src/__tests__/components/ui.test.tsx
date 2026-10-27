import { act, render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ReservedText, StableText } from '../../components/ui';
import { setLanguage } from '../../lib/i18n';

test('StableText shows the current translation and keeps the others as hidden space', () => {
  render(
    <button type="button">
      <StableText pick={t => t.nav.signOut} />
    </button>,
  );
  const button = screen.getByRole('button', { name: 'Sign out' });
  const reserved = within(button).getByText('Uitloggen');
  expect(reserved).toHaveAttribute('aria-hidden', 'true');
  expect(reserved).toHaveClass('invisible');

  act(() => setLanguage('nl'));

  // Same element, now named in Dutch; the English label takes over as the reserved space.
  expect(screen.getByRole('button', { name: 'Uitloggen' })).toBe(button);
  expect(within(button).getByText('Sign out')).toHaveAttribute('aria-hidden', 'true');
});

test('StableText does not repeat a text that is the same in every language', () => {
  render(<StableText pick={t => t.nav.account} />);
  expect(screen.getAllByText('Account')).toHaveLength(1);
});

test('ReservedText repeats the icon in every layer so icon and text stay centered together', () => {
  render(
    <button type="button">
      <ReservedText text="EN" alternatives={['EN', 'NL', 'NL']} icon={<svg data-testid="icon" />} />
    </button>,
  );
  expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
  expect(screen.getAllByTestId('icon')).toHaveLength(2);
});
