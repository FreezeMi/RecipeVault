import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { DownloadSimpleIcon, UploadSimpleIcon, ShieldCheckIcon, DatabaseIcon, UserCircleIcon } from '@phosphor-icons/react';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { api, authApi, toErrorMessage } from '../services/api';
import type { DbStatus } from '../types';
import { navigate, paths, useScrollRestoration } from '../lib/router';
import { useDocumentTitle } from '../lib/hooks';
import { Notice, PageHeading, Spinner, buttonStyles, cardClass, inputClass, labelClass } from './ui';

const MIN_PASSWORD_LENGTH = 12;
const MAX_BACKUP_BYTES = 15 * 1024 * 1024; // matches the API's upload body limit

type Message = { text: string; tone: 'error' | 'success' } | null;

function Section({ icon, title, description, children }: Readonly<{ icon: ReactNode; title: string; description?: string; children: ReactNode }>) {
  return (
    <section className={`${cardClass} p-6 md:p-8`}>
      <div className="mb-6 flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold text-stone-900">{title}</h2>
          {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const describeImport = ({ count, skipped = 0, invalid = 0 }: { count: number; skipped?: number; invalid?: number }) => {
  const parts = [`Imported ${count} ${count === 1 ? 'recipe' : 'recipes'}.`];
  if (skipped) parts.push(`Skipped ${skipped} already in your vault.`);
  if (invalid) parts.push(`${invalid} invalid ${invalid === 1 ? 'entry was' : 'entries were'} ignored.`);
  return parts.join(' ');
};

export default function Account() {
  const { user, clearSession } = useAuth();
  const toast = useToast();
  useDocumentTitle('Account');
  useScrollRestoration(true);

  // --- System status ---
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [dbStatusError, setDbStatusError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api
      .getDbStatus(controller.signal)
      .then(setDbStatus)
      .catch(() => {
        if (!controller.signal.aborted) setDbStatusError(true);
      });
    return () => controller.abort();
  }, []);

  // --- Backup & restore ---
  const [dataMessage, setDataMessage] = useState<Message>(null);
  const [dataBusy, setDataBusy] = useState<'download' | 'upload' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = async () => {
    setDataBusy('download');
    setDataMessage(null);
    try {
      const recipes = await api.getRecipes();
      const blob = new Blob([JSON.stringify(recipes, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `recipe_vault_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoke on the next tick so the download has started in every browser.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setDataMessage({ text: `Downloaded a backup of ${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}.`, tone: 'success' });
    } catch (err) {
      setDataMessage({ text: toErrorMessage(err, 'Failed to download recipes.'), tone: 'error' });
    } finally {
      setDataBusy(null);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;

    setDataMessage(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setDataMessage({ text: 'That file is too large (maximum 15 MB).', tone: 'error' });
      return;
    }

    setDataBusy('upload');
    try {
      let recipes: unknown;
      try {
        recipes = JSON.parse(await file.text());
      } catch {
        throw new Error("That file isn't valid JSON. Choose a backup downloaded from Recipe Vault.");
      }
      if (!Array.isArray(recipes)) {
        throw new Error('This file is not a Recipe Vault backup (expected a list of recipes).');
      }
      const result = await api.uploadRecipes(recipes);
      setDataMessage({ text: describeImport(result), tone: 'success' });
    } catch (err) {
      setDataMessage({ text: toErrorMessage(err, 'Failed to import recipes.'), tone: 'error' });
    } finally {
      setDataBusy(null);
    }
  };

  // --- Password ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordMessage({ text: `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`, tone: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'The new passwords do not match.', tone: 'error' });
      return;
    }

    setChangingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      // The server signed out every session, including this one.
      clearSession();
      toast.success('Password changed. Please sign in with your new password.');
      navigate(paths.login(), { replace: true });
    } catch (err) {
      setPasswordMessage({ text: toErrorMessage(err, 'Failed to change password.'), tone: 'error' });
      setChangingPassword(false);
    }
  };

  if (!user) return null;

  let statusDot = 'bg-stone-300';
  let statusText = 'Checking…';
  if (dbStatusError) {
    statusText = 'Unavailable';
  } else if (dbStatus && !dbStatus.lastCheck) {
    statusText = 'Not checked yet';
  } else if (dbStatus) {
    statusDot = dbStatus.isOkay ? 'bg-emerald-500' : 'bg-red-500';
    statusText = dbStatus.isOkay ? 'Healthy' : 'Issue detected';
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeading title="Account" subtitle="Manage your sign-in, backups and system health." />

      <Section icon={<UserCircleIcon size={24} weight="duotone" />} title="Profile">
        <dl>
          <dt className="text-sm font-medium text-stone-500">Signed in as</dt>
          <dd className="mt-0.5 break-all font-medium text-stone-900">{user.email}</dd>
        </dl>
      </Section>

      <Section
        icon={<DownloadSimpleIcon size={24} weight="duotone" />}
        title="Backup & restore"
        description="Download every recipe as a JSON file, or restore from a backup. Restoring only adds recipes — titles already in your vault are skipped, nothing is overwritten."
      >
        {dataMessage && (
          <div className="mb-5">
            <Notice tone={dataMessage.tone}>{dataMessage.text}</Notice>
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={handleDownload} disabled={dataBusy !== null} className={`${buttonStyles.primary} flex-1`}>
            {dataBusy === 'download' ? <Spinner className="size-5" /> : <DownloadSimpleIcon size={20} weight="bold" aria-hidden="true" />}
            {dataBusy === 'download' ? 'Preparing…' : 'Download backup'}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={dataBusy !== null}
            className={`${buttonStyles.secondary} flex-1`}
          >
            {dataBusy === 'upload' ? <Spinner className="size-5" /> : <UploadSimpleIcon size={20} weight="bold" aria-hidden="true" />}
            {dataBusy === 'upload' ? 'Importing…' : 'Restore from backup'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </Section>

      <Section
        icon={<ShieldCheckIcon size={24} weight="duotone" />}
        title="Change password"
        description="Changing your password signs you out on every device."
      >
        {passwordMessage && (
          <div className="mb-5">
            <Notice tone={passwordMessage.tone}>{passwordMessage.text}</Notice>
          </div>
        )}
        <form onSubmit={handleChangePassword} className="space-y-5">
          {/* Hidden username field helps password managers attach the new password to the right account. */}
          <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
          <div>
            <label htmlFor="currentPassword" className={labelClass}>
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="newPassword" className={labelClass}>
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                aria-describedby="newPassword-hint"
                className={inputClass}
              />
              <p id="newPassword-hint" className="mt-1.5 text-sm text-stone-500">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>
            <div>
              <label htmlFor="confirmPassword" className={labelClass}>
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>
          <button type="submit" disabled={changingPassword} className={buttonStyles.primary}>
            {changingPassword && <Spinner className="size-5" />}
            {changingPassword ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </Section>

      <Section
        icon={<DatabaseIcon size={24} weight="duotone" />}
        title="System status"
        description="The server checks the database connection every few days."
      >
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-stone-50 p-4">
            <dt className="text-sm font-medium text-stone-500">Database</dt>
            <dd className="mt-1 flex items-center gap-2 font-semibold text-stone-900">
              <span className={`size-2.5 rounded-full ${statusDot}`} aria-hidden="true" />
              {statusText}
            </dd>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <dt className="text-sm font-medium text-stone-500">Last check</dt>
            <dd className="mt-1 font-semibold text-stone-900">
              {dbStatus?.lastCheck ? new Date(dbStatus.lastCheck).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>
      </Section>
    </div>
  );
}
