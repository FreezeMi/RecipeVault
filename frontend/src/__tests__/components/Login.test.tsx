import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import Login from '../../components/Login';
import { ToastProvider } from '../../components/Toast';
import * as AuthContext from '../../components/AuthContext';

vi.mock('../../components/AuthContext', () => ({ useAuth: vi.fn() }));

const loginMock = vi.fn();

beforeEach(() => {
  loginMock.mockReset();
  vi.mocked(AuthContext.useAuth).mockReturnValue({ authenticated: false, login: loginMock } as never);
});

const renderLogin = () =>
  render(
    <ToastProvider>
      <Login />
    </ToastProvider>,
  );

const fillAndSubmit = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

test('submits credentials and redirects to the requested page', async () => {
  window.history.replaceState(null, '', '/login?next=%2Frecipes%2F3%2Fedit');
  loginMock.mockResolvedValueOnce(undefined);
  renderLogin();

  fillAndSubmit(' test@example.com ', 'password123');
  expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();

  await waitFor(() => expect(window.location.pathname).toBe('/recipes/3/edit'));
  expect(loginMock).toHaveBeenCalledWith('test@example.com', 'password123');
});

test('ignores off-site redirect targets', async () => {
  window.history.replaceState(null, '', '/login?next=%2F%2Fevil.example');
  loginMock.mockResolvedValueOnce(undefined);
  renderLogin();

  fillAndSubmit('test@example.com', 'password123');
  await waitFor(() => expect(window.location.pathname).toBe('/'));
});

test('shows the error message on failure', async () => {
  window.history.replaceState(null, '', '/login');
  loginMock.mockRejectedValueOnce(new Error('Invalid email or password.'));
  renderLogin();

  fillAndSubmit('wrong@example.com', 'wrong');

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  expect(window.location.pathname).toBe('/login');
});
