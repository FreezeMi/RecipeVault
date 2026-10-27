import type { ReactNode } from 'react';
import { ArrowLeftIcon, CheckCircleIcon, WarningCircleIcon, InfoIcon } from '@phosphor-icons/react';
import { Link } from '../lib/router';
import { LANGUAGES, messagesFor, useT, type Messages } from '../lib/i18n';

// Shared visual primitives so every screen uses the same buttons, inputs, cards and notices.

const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100';

export const buttonStyles = {
  primary: `${buttonBase} px-5 py-2.5 bg-brand-600 text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/25`,
  secondary: `${buttonBase} px-5 py-2.5 bg-white text-stone-700 border border-stone-200 shadow-sm hover:bg-stone-50 hover:text-stone-900 hover:border-stone-300`,
  ghost: `${buttonBase} px-4 py-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100`,
  danger: `${buttonBase} px-5 py-2.5 bg-red-600 text-white shadow-md shadow-red-600/20 hover:bg-red-700`,
  icon: 'inline-flex items-center justify-center rounded-full p-2.5 text-stone-500 transition-colors hover:text-stone-900 hover:bg-stone-100',
};

export const inputClass =
  'w-full rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3 text-stone-900 placeholder:text-stone-400 outline-none transition-[border-color,background-color,box-shadow] focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/15 aria-[invalid=true]:border-red-400';

export const labelClass = 'mb-1.5 block text-sm font-semibold text-stone-700';

export const cardClass = 'rounded-3xl border border-stone-200/80 bg-white shadow-sm shadow-stone-900/[0.03]';

interface ReservedTextProps {
  text: string;
  /** Texts that may replace `text` in this spot; the widest one sets the size. */
  alternatives: readonly string[];
  /** Repeated in every layer, so icon and text stay centered together. */
  icon?: ReactNode;
  align?: 'center' | 'start';
  /** Lets text that may not fit (e.g. one with a hostname) wrap; every layer is then as tall as the tallest. */
  wrap?: boolean;
}

/**
 * Shows `text` in the room of the widest of `alternatives`, which are stacked in the same grid cell,
 * invisible and hidden from assistive technology. Swapping the text then never resizes the control
 * it's in or moves whatever sits next to it. Labels don't wrap unless `wrap` is set: a hidden
 * alternative that wrapped would make the visible one two lines tall. Layers inherit the parent's gap.
 */
export function ReservedText({ text, alternatives, icon, align = 'center', wrap = false }: Readonly<ReservedTextProps>) {
  const layer = 'col-start-1 row-start-1 inline-flex items-center [gap:inherit]';
  const others = [...new Set(alternatives)].filter(other => other !== text);
  return (
    <span
      className={`inline-grid [gap:inherit] ${wrap ? '' : 'whitespace-nowrap'} ${align === 'start' ? 'justify-items-start' : 'justify-items-center'}`}
    >
      <span className={layer}>
        {icon}
        {text}
      </span>
      {others.map(other => (
        <span key={other} className={`${layer} invisible`} aria-hidden="true">
          {icon}
          {other}
        </span>
      ))}
    </span>
  );
}

/** Interface text sized to its longest translation, so switching language leaves the layout in place. */
export function StableText({ pick, ...props }: Readonly<{ pick: (t: Messages) => string } & Omit<ReservedTextProps, 'text' | 'alternatives'>>) {
  const t = useT();
  return <ReservedText text={pick(t)} alternatives={LANGUAGES.map(language => pick(messagesFor(language)))} {...props} />;
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-24 text-stone-500">
      <Spinner className="size-8 text-brand-600" />
      <p className="font-medium">{label}</p>
    </div>
  );
}

const noticeTones = {
  error: { className: 'bg-red-50 text-red-800 border-red-200', Icon: WarningCircleIcon, role: 'alert' },
  success: { className: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircleIcon, role: 'status' },
  info: { className: 'bg-brand-50 text-brand-900 border-brand-200', Icon: InfoIcon, role: 'status' },
} as const;

export function Notice({ tone, children, action }: { tone: keyof typeof noticeTones; children: ReactNode; action?: ReactNode }) {
  const { className, Icon, role } = noticeTones[tone];
  return (
    <div role={role} className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${className}`}>
      <Icon size={20} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
      {action}
    </div>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group mb-6 inline-flex items-center gap-2 rounded-full py-1 pr-2 font-medium text-stone-500 transition-colors hover:text-stone-900"
    >
      <ArrowLeftIcon size={18} className="transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
      {children}
    </Link>
  );
}

export function PageHeading({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-stone-900 md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 text-stone-600">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
