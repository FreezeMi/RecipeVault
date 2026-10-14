import { useEffect, useMemo, useRef, useState } from 'react';
import { m } from 'motion/react';
import { MagnifyingGlassIcon, PlusIcon, CookingPotIcon, HeartIcon, XIcon, ArrowClockwiseIcon } from '@phosphor-icons/react';
import type { Recipe, RecipeFilters } from '../types';
import RecipeCard from './RecipeCard';
import { api, getCachedRecipes, toErrorMessage } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import { Notice, PageHeading, Spinner, buttonStyles } from './ui';
import { RECIPE_CATEGORIES } from '../constants';
import { Link, navigate, paths, useLocation, useScrollRestoration } from '../lib/router';
import { useDocumentTitle } from '../lib/hooks';

const SEARCH_DEBOUNCE_MS = 250;

// Filters live in the URL (?q=&tag=&fav=1) so they survive refreshes and Back navigation.
const readFilters = (search: string): Required<RecipeFilters> => {
  const params = new URLSearchParams(search);
  return { search: params.get('q') ?? '', tag: params.get('tag') ?? '', favorite: params.get('fav') === '1' };
};

const writeFilters = ({ search, tag, favorite }: Required<RecipeFilters>) => {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (tag) params.set('tag', tag);
  if (favorite) params.set('fav', '1');
  navigate(paths.list(params.toString()), { replace: true });
};

const chipClass = (active: boolean, tone: 'neutral' | 'accent' = 'neutral') => {
  const base =
    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-colors duration-200';
  if (!active) return `${base} border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900`;
  return tone === 'accent'
    ? `${base} border-accent-200 bg-accent-50 text-accent-700`
    : `${base} border-stone-900 bg-stone-900 text-white`;
};

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl border border-stone-200/80 bg-white">
          <div className="skeleton aspect-[4/3]" />
          <div className="space-y-3 p-5">
            <div className="skeleton h-5 w-3/4 rounded-full" />
            <div className="skeleton h-3.5 w-full rounded-full" />
            <div className="skeleton h-3.5 w-1/2 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RecipeList() {
  const { search: locationSearch } = useLocation();
  const { search, tag, favorite } = readFilters(locationSearch);
  const filters = useMemo(() => ({ search, tag, favorite }), [search, tag, favorite]);
  const hasFilters = Boolean(search || tag || favorite);

  const { authenticated } = useAuth();
  const toast = useToast();
  useDocumentTitle();

  // --- Search input (debounced into the URL) ---
  const [searchInput, setSearchInput] = useState(search);
  const lastWrittenSearch = useRef(search);

  useEffect(() => {
    // Only adopt URL changes we didn't make ourselves (Back/Forward, "clear filters"),
    // otherwise keystrokes typed during the debounce window would be overwritten.
    if (search !== lastWrittenSearch.current) {
      lastWrittenSearch.current = search;
      setSearchInput(search);
    }
  }, [search]);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const timer = window.setTimeout(() => {
      lastWrittenSearch.current = next;
      writeFilters({ ...filters, search: next });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, filters]);

  const setFilters = (patch: Partial<Required<RecipeFilters>>) => {
    const next = { ...filters, ...patch };
    lastWrittenSearch.current = next.search;
    writeFilters(next);
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilters({ search: '', tag: '', favorite: false });
  };

  // --- Data ---
  const [recipes, setRecipes] = useState<Recipe[] | null>(() => getCachedRecipes(filters) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pendingFavorites, setPendingFavorites] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    const cached = getCachedRecipes(filters);
    if (cached) setRecipes(cached);
    setRefreshing(true);
    setError(null);

    api
      .getRecipes(filters, controller.signal)
      .then(setRecipes)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setRecipes(null);
        setError(toErrorMessage(err, 'Unable to load recipes.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });

    // Aborting stale requests guarantees an older, slower response never overwrites a newer one.
    return () => controller.abort();
  }, [filters, attempt]);

  useScrollRestoration(recipes !== null);

  const handleToggleFavorite = async (recipe: Recipe) => {
    const replace = (next: Recipe) => setRecipes(list => list?.map(r => (r.id === next.id ? next : r)) ?? list);

    setPendingFavorites(ids => new Set(ids).add(recipe.id));
    replace({ ...recipe, isFavorite: !recipe.isFavorite }); // optimistic
    try {
      const updated = await api.toggleFavorite(recipe.id);
      if (favorite && !updated.isFavorite) {
        setRecipes(list => list?.filter(r => r.id !== updated.id) ?? list);
      } else {
        replace(updated);
      }
    } catch (err) {
      replace(recipe); // roll back
      toast.error(toErrorMessage(err, 'Failed to update favorite.'));
    } finally {
      setPendingFavorites(ids => {
        const next = new Set(ids);
        next.delete(recipe.id);
        return next;
      });
    }
  };

  const count = recipes?.length ?? 0;
  let subtitle = 'Browse, search and cook from your personal culinary collection.';
  if (recipes && !hasFilters) subtitle = `${count} ${count === 1 ? 'recipe' : 'recipes'} in your vault.`;

  return (
    <div className="space-y-8">
      <PageHeading title="Your Recipes" subtitle={subtitle}>
        {authenticated && (
          <Link to={paths.new()} className={`${buttonStyles.primary} sm:hidden`}>
            <PlusIcon size={18} weight="bold" aria-hidden="true" />
            New recipe
          </Link>
        )}
      </PageHeading>

      <div className="space-y-4">
        <div className="relative">
          <MagnifyingGlassIcon
            size={20}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by title, ingredient or tag…"
            aria-label="Search recipes"
            maxLength={100}
            className="w-full rounded-2xl border border-stone-200 bg-white py-3.5 pl-12 pr-24 text-stone-900 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-stone-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 [&::-webkit-search-cancel-button]:hidden"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {refreshing && recipes !== null && <Spinner className="size-4 text-stone-400" />}
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setFilters({ search: '' });
                }}
                className={buttonStyles.icon}
                aria-label="Clear search"
              >
                <XIcon size={16} weight="bold" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div
          role="group"
          aria-label="Filter recipes"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        >
          <button
            type="button"
            aria-pressed={favorite}
            className={chipClass(favorite, 'accent')}
            onClick={() => setFilters({ favorite: !favorite })}
          >
            <HeartIcon size={16} weight={favorite ? 'fill' : 'regular'} aria-hidden="true" />
            Favorites
          </button>
          <span className="mx-1 w-px shrink-0 self-stretch bg-stone-200" aria-hidden="true" />
          <button type="button" aria-pressed={!tag} className={chipClass(!tag)} onClick={() => setFilters({ tag: '' })}>
            All
          </button>
          {RECIPE_CATEGORIES.map(category => (
            <button
              key={category}
              type="button"
              aria-pressed={tag === category}
              className={chipClass(tag === category)}
              onClick={() => setFilters({ tag: tag === category ? '' : category })}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {hasFilters && recipes && recipes.length > 0 && (
        <div className="flex items-center justify-between text-sm text-stone-600">
          <p aria-live="polite">
            {count} {count === 1 ? 'result' : 'results'}
          </p>
          <button type="button" onClick={clearFilters} className="font-medium text-brand-700 hover:text-brand-900">
            Clear filters
          </button>
        </div>
      )}

      {error && (
        <Notice
          tone="error"
          action={
            <button
              type="button"
              onClick={() => setAttempt(n => n + 1)}
              className="inline-flex items-center gap-1.5 font-semibold text-red-800 hover:text-red-950"
            >
              <ArrowClockwiseIcon size={16} weight="bold" aria-hidden="true" />
              Retry
            </button>
          }
        >
          {error}
        </Notice>
      )}

      {!error && recipes === null && (
        <>
          <p role="status" className="sr-only">
            Loading recipes…
          </p>
          <SkeletonGrid />
        </>
      )}

      {recipes?.length === 0 && (
        <m.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-3xl border border-stone-200/80 bg-white px-6 py-20 text-center"
        >
          <div className="mb-5 grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600">
            <CookingPotIcon size={36} weight="duotone" aria-hidden="true" />
          </div>
          {hasFilters ? (
            <>
              <h2 className="font-display text-2xl font-semibold text-stone-900">No recipes found</h2>
              <p className="mt-2 max-w-md text-stone-600">Try a different search term or remove some filters.</p>
              <button type="button" onClick={clearFilters} className={`${buttonStyles.secondary} mt-6`}>
                Clear all filters
              </button>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold text-stone-900">Your vault is empty</h2>
              {authenticated ? (
                <>
                  <p className="mt-2 max-w-md text-stone-600">Add your first recipe to start your culinary collection.</p>
                  <Link to={paths.new()} className={`${buttonStyles.primary} mt-6`}>
                    <PlusIcon size={18} weight="bold" aria-hidden="true" />
                    Add your first recipe
                  </Link>
                </>
              ) : (
                <p className="mt-2 max-w-md text-stone-600">No recipes have been added yet. Check back soon!</p>
              )}
            </>
          )}
        </m.div>
      )}

      {recipes && recipes.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-6 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 ${
            refreshing ? 'opacity-70' : ''
          }`}
          aria-busy={refreshing}
        >
          {recipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              index={index}
              onToggleFavorite={authenticated ? handleToggleFavorite : undefined}
              favoritePending={pendingFavorites.has(recipe.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
