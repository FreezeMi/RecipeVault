import { describe, expect, test, beforeEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { Link, navigate, parseRoute, useLocation } from '../../lib/router';
import { safeRedirectPath } from '../../components/Login';

describe('parseRoute', () => {
  test.each([
    ['/', { name: 'list' }],
    ['/recipes/new', { name: 'new' }],
    ['/recipes/12', { name: 'detail', id: 12 }],
    ['/recipes/12/', { name: 'detail', id: 12 }],
    ['/recipes/12/edit', { name: 'edit', id: 12 }],
    ['/login', { name: 'login' }],
    ['/account', { name: 'account' }],
    ['/recipes/0', { name: 'notFound' }],
    ['/recipes/abc', { name: 'notFound' }],
    ['/whatever', { name: 'notFound' }],
  ])('%s', (path, expected) => {
    expect(parseRoute(path)).toEqual(expected);
  });
});

describe('navigation', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'));

  test('navigate updates subscribers', () => {
    const { result } = renderHook(() => useLocation());
    act(() => navigate('/recipes/5?x=1'));
    expect(result.current.pathname).toBe('/recipes/5');
    expect(result.current.search).toBe('?x=1');
  });

  test('Link navigates client-side on plain click but not with modifier keys', () => {
    render(<Link to="/login">Sign in</Link>);
    const link = screen.getByRole('link', { name: 'Sign in' });
    expect(link).toHaveAttribute('href', '/login');

    fireEvent.click(link, { ctrlKey: true });
    expect(window.location.pathname).toBe('/');

    fireEvent.click(link);
    expect(window.location.pathname).toBe('/login');
  });
});

describe('safeRedirectPath', () => {
  test('only allows same-app paths', () => {
    expect(safeRedirectPath('/recipes/1/edit')).toBe('/recipes/1/edit');
    expect(safeRedirectPath('//evil.example')).toBe('/');
    expect(safeRedirectPath('/\\evil.example')).toBe('/');
    expect(safeRedirectPath('https://evil.example')).toBe('/');
    expect(safeRedirectPath(null)).toBe('/');
  });
});
