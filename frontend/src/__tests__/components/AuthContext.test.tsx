import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../components/AuthContext';
import { ToastProvider } from '../../components/Toast';
import { api, getCachedRecipes } from '../../services/api';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const admin = { id: 'u1', email: 'admin@example.com' };

/** A small API: the list contains a hidden recipe for as long as the session exists. */
const stubApi = ({ signedIn, writesFail = false }: { signedIn: boolean; writesFail?: boolean }) => {
  let session = signedIn;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(jsonResponse(session ? { authenticated: true, user: admin } : { authenticated: false }));
      }
      if (url.endsWith('/auth/login')) {
        session = true;
        return Promise.resolve(jsonResponse({ user: admin }));
      }
      if (url.endsWith('/auth/logout')) {
        session = false;
        return Promise.resolve(jsonResponse({ success: true }));
      }
      if (init?.method === 'PATCH' && writesFail) return Promise.resolve(jsonResponse({ error: 'Unauthorized' }, 401));
      return Promise.resolve(jsonResponse(session ? [{ id: 1, isHidden: true }] : []));
    }),
  );
};

function Session() {
  const { authenticated, loading, login, logout } = useAuth();
  if (loading) return <p>checking</p>;
  return (
    <>
      <p>{authenticated ? 'signed in' : 'signed out'}</p>
      <button type="button" onClick={() => void login('admin@example.com', 'x')}>
        log in
      </button>
      <button type="button" onClick={() => void logout()}>
        log out
      </button>
    </>
  );
}

const renderSession = () =>
  render(
    <ToastProvider>
      <AuthProvider>
        <Session />
      </AuthProvider>
    </ToastProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

test('signing out drops the recipe lists that were fetched as the admin', async () => {
  stubApi({ signedIn: true });
  renderSession();
  await screen.findByText('signed in');

  await api.getRecipes({});
  expect(getCachedRecipes({})).toEqual([{ id: 1, isHidden: true }]);

  fireEvent.click(screen.getByRole('button', { name: 'log out' }));
  await screen.findByText('signed out');
  expect(getCachedRecipes({})).toBeUndefined();
});

test('an expired session drops them too', async () => {
  stubApi({ signedIn: true, writesFail: true });
  renderSession();
  await screen.findByText('signed in');
  await api.getRecipes({});

  await expect(api.toggleFavorite(1)).rejects.toThrow();
  await screen.findByText('signed out');
  expect(getCachedRecipes({})).toBeUndefined();
});

test('signing in drops the lists fetched as a visitor, so the admin gets the hidden recipes', async () => {
  stubApi({ signedIn: false });
  renderSession();
  await screen.findByText('signed out');
  await api.getRecipes({});
  expect(getCachedRecipes({})).toEqual([]);

  fireEvent.click(screen.getByRole('button', { name: 'log in' }));
  await screen.findByText('signed in');
  await waitFor(() => expect(getCachedRecipes({})).toBeUndefined());
});
