import { useMemo } from 'react';
import { m } from 'motion/react';
import { HeartIcon, ClockIcon, UsersIcon } from '@phosphor-icons/react';
import type { Recipe } from '../types';
import { Link, paths } from '../lib/router';
import { formatMinutes, localizeRecipe, parseTags, totalMinutes } from '../lib/recipe';
import { tagLabel, useLanguage, useT } from '../lib/i18n';
import RecipeImage from './RecipeImage';

interface Props {
  recipe: Recipe;
  index?: number;
  /** When provided (signed-in users), the heart becomes a toggle button. */
  onToggleFavorite?: (recipe: Recipe) => void;
  favoritePending?: boolean;
}

export default function RecipeCard({ recipe, index = 0, onToggleFavorite, favoritePending = false }: Readonly<Props>) {
  const t = useT();
  const language = useLanguage();
  // Memoized: the list re-renders every card on each keystroke in the search box.
  const localized = useMemo(() => localizeRecipe(recipe, language), [recipe, language]);
  const { title, description } = localized.text;
  // Untranslated text keeps its own language so screen readers pronounce it correctly.
  const textLang = localized.isFallback ? localized.language : undefined;
  const tags = parseTags(recipe.tags);
  const minutes = totalMinutes(recipe);

  return (
    <m.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm shadow-stone-900/[0.03] transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-stone-900/[0.07] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-600 has-[a:focus-visible]:ring-offset-2"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
        <RecipeImage
          src={recipe.imageUrl}
          className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        {tags.length > 0 && (
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-stone-800 shadow-sm md:bg-white/85 md:backdrop-blur-md"
              >
                {tagLabel(tag, t)}
              </span>
            ))}
            {tags.length > 2 && (
              <span
                className="rounded-full bg-white/95 px-2 py-1 text-xs font-semibold text-stone-600 shadow-sm md:bg-white/85 md:backdrop-blur-md"
                aria-label={t.card.moreTags(tags.length - 2)}
              >
                +{tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3
          lang={textLang}
          className="font-display text-xl font-semibold leading-snug tracking-tight text-stone-900 transition-colors group-hover:text-brand-700"
        >
          {/* The link is stretched over the whole card so the card is one large, keyboard-reachable target. */}
          <Link to={paths.detail(recipe.id)} className="outline-none after:absolute after:inset-0 after:content-['']">
            {title}
          </Link>
        </h3>

        {description && (
          <p lang={textLang} className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-600">
            {description}
          </p>
        )}

        {(minutes !== null || recipe.servings !== null) && (
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-sm font-medium text-stone-600">
            {minutes !== null && minutes > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon size={16} weight="duotone" className="text-brand-600" aria-hidden="true" />
                <span className="sr-only">{t.card.totalTime}</span>
                {formatMinutes(minutes, t)}
              </span>
            )}
            {recipe.servings !== null && (
              <span className="inline-flex items-center gap-1.5">
                <UsersIcon size={16} weight="duotone" className="text-brand-600" aria-hidden="true" />
                {t.format.servings(recipe.servings)}
              </span>
            )}
          </div>
        )}
      </div>

      {onToggleFavorite ? (
        <button
          type="button"
          onClick={() => onToggleFavorite(recipe)}
          disabled={favoritePending}
          aria-pressed={recipe.isFavorite}
          aria-label={recipe.isFavorite ? t.card.removeFromFavorites(title) : t.card.addToFavorites(title)}
          title={recipe.isFavorite ? t.common.removeFromFavorites : t.common.addToFavorites}
          className={`absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/95 shadow-sm transition-[color,transform] active:scale-90 disabled:opacity-70 md:bg-white/85 md:backdrop-blur-md ${
            recipe.isFavorite ? 'text-accent-600' : 'text-stone-500 hover:text-accent-600'
          }`}
        >
          <HeartIcon size={20} weight={recipe.isFavorite ? 'fill' : 'bold'} aria-hidden="true" />
        </button>
      ) : (
        recipe.isFavorite && (
          <span
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/95 text-accent-600 shadow-sm md:bg-white/85 md:backdrop-blur-md"
            title={t.common.favorite}
          >
            <HeartIcon size={20} weight="fill" aria-hidden="true" />
            <span className="sr-only">{t.common.favorite}</span>
          </span>
        )
      )}
    </m.article>
  );
}
