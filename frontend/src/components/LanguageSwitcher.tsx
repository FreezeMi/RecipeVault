import { LANGUAGES, LANGUAGE_NAMES, setLanguage, useLanguage, useT } from '../lib/i18n';
import { ReservedText } from './ui';

const CODES = LANGUAGES.map(code => code.toUpperCase());

/**
 * EN | NL toggle. Switching re-renders in place, so the page, filters and scroll position stay put.
 * Below the md breakpoint only the other language is shown ("NL" while in English), the usual
 * convention on bilingual sites; it keeps the signed-in header on one line from 360px up.
 * Both codes take the same room, so that one button doesn't change size when it swaps.
 */
export default function LanguageSwitcher() {
  const language = useLanguage();
  const t = useT();

  return (
    <div role="group" aria-label={t.nav.language} className="flex items-center rounded-full border border-stone-200 bg-white p-0.5">
      {LANGUAGES.map(code => {
        const active = code === language;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-label={LANGUAGE_NAMES[code]}
            aria-pressed={active}
            onClick={() => setLanguage(code)}
            className={`rounded-full px-2 py-1 text-xs font-semibold tracking-wide transition-colors sm:px-2.5 ${
              active ? 'bg-stone-900 text-white max-md:hidden' : 'text-stone-600 hover:bg-stone-900/5 hover:text-stone-900'
            }`}
          >
            <ReservedText text={code.toUpperCase()} alternatives={CODES} />
          </button>
        );
      })}
    </div>
  );
}
