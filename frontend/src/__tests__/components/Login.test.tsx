import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import Login from '../../components/Login';
import { authApi } from '../../services/api';
import * as AuthContext from '../../components/AuthContext';

// Mock the API calls
vi.mock('../../services/api', () => ({
  authApi: {
    login: vi.fn(),
  },
}));

// Mock the Auth Context
vi.mock('../../components/AuthContext', () => ({
  useAuth: vi.fn(),
}));

test('Login form submits successfully', async () => {
  const checkAuthMock = vi.fn();
  (AuthContext.useAuth as any).mockReturnValue({ checkAuth: checkAuthMock });
  
  (authApi.login as any).mockResolvedValueOnce({ user: { id: 1, email: 'test@test.com' } });

  const onSuccessMock = vi.fn();
  
  render(<Login onSuccess={onSuccessMock} />);

  // Fill in the form
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });

  // Submit the form
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  // Assert button text changes to loading state temporarily
  expect(screen.getByRole('button', { name: 'Signing in...' })).toBeInTheDocument();

  // Wait for the async actions
  await waitFor(() => {
    expect(authApi.login).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(checkAuthMock).toHaveBeenCalled();
    expect(onSuccessMock).toHaveBeenCalled();
  });
});

test('Login form displays error on failure', async () => {
  const checkAuthMock = vi.fn();
  (AuthContext.useAuth as any).mockReturnValue({ checkAuth: checkAuthMock });
  
  (authApi.login as any).mockRejectedValueOnce(new Error('Invalid credentials'));

  const onSuccessMock = vi.fn();
  
  render(<Login onSuccess={onSuccessMock} />);

  // Fill in the form
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'wrong@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });

  // Submit the form
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  // Wait for the error message
  await waitFor(() => {
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    expect(onSuccessMock).not.toHaveBeenCalled();
  });
});

