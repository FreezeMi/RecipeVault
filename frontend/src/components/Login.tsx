import { useEffect, useState, type FormEvent } from 'react';
import { LockKeyIcon } from '@phosphor-icons/react';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { toErrorMessage } from '../services/api';
import { navigate, paths, useLocation } from '../lib/router';
import { useDocumentTitle } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { Notice, Spinner, buttonStyles, cardClass, inputClass, labelClass } from './ui';

/** Only allow same-app paths as redirect targets (prevents open redirects like `//evil.com`). */
export const safeRedirectPath = (value: string | null): string =>
  value?.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : paths.list();

export default function Login() {
  const { search } = useLocation();
  const next = safeRedirectPath(new URLSearchParams(search).get('next'));
  const { authenticated, login } = useAuth();
  const toast = useToast();
  const t = useT();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useDocumentTitle(t.login.title);

  // Already signed in (e.g. visiting /login directly): continue to the destination.
  useEffect(() => {
    if (authenticated && !loading) navigate(next, { replace: true });
  }, [authenticated, loading, next]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email.trim(), password);
      toast.success(t.login.welcome);
      navigate(next, { replace: true });
    } catch (err) {
      setError(toErrorMessage(err, t.login.invalidCredentials));
      setLoading(false);
    }
  };

  return (
    <div className={`${cardClass} mx-auto mt-6 max-w-md p-8 md:mt-12 md:p-10`}>
      <div className="mb-8 text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <LockKeyIcon size={26} weight="duotone" aria-hidden="true" />
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900">{t.login.title}</h1>
        <p className="mt-2 text-stone-600">{t.login.intro}</p>
      </div>

      {error && (
        <div className="mb-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className={labelClass}>
            {t.login.email}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            {t.login.password}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <button type="submit" disabled={loading} className={`${buttonStyles.primary} mt-2 w-full py-3!`}>
          {loading && <Spinner className="size-5" />}
          {loading ? t.login.signingIn : t.login.submit}
        </button>
      </form>
    </div>
  );
}
