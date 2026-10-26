import { useEffect, useRef, useState, type ReactNode } from 'react';
import { m } from 'motion/react';
import {
  ClockIcon,
  UsersIcon,
  HeartIcon,
  PencilSimpleIcon,
  TrashIcon,
  ArrowSquareOutIcon,
  TimerIcon,
  FireIcon,
  CheckIcon,
  ArrowClockwiseIcon,
} from '@phosphor-icons/react';
import { api, toErrorMessage } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './Toast';
import RecipeImage from './RecipeImage';
import { BackLink, Notice, PageLoader, Spinner, buttonStyles, cardClass } from './ui';
import { Link, navigate, paths, useScrollRestoration } from '../lib/router';
import { useDocumentTitle, useRecipe } from '../lib/hooks';
import {
  formatMinutes,
  formatServings,
  hostnameOf,
  parseIngredients,
  parseInstructions,
  parseTags,
  safeHttpUrl,
  totalMinutes,
} from '../lib/recipe';

interface Props {
  id: number;
}

function Stat({ icon, label, value }: Readonly<{ icon: ReactNode; label: string; value: string }>) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600" aria-hidden="true">
        {icon}
      </span>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</dt>
        <dd className="font-semibold text-stone-900">{value}</dd>
      </div>
    </div>
  );
}

export default function RecipeDetail({ id }: Readonly<Props>) {
  const state = useRecipe(id);
  const { status, reload, setRecipe } = state;
  const { authenticated } = useAuth();
  const toast = useToast();

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const wasConfirmingDeleteRef = useRef(false);

  useDocumentTitle(state.recipe?.title);
  useScrollRestoration(status !== 'loading');

  // Move focus into the confirmation when it opens, and back to the Delete button when it closes.
  useEffect(() => {
    if (confirmingDelete) cancelDeleteRef.current?.focus();
    else if (wasConfirmingDeleteRef.current) deleteButtonRef.current?.focus();
    wasConfirmingDeleteRef.current = confirmingDelete;
  }, [confirmingDelete]);

  if (state.status === 'loading') return <PageLoader label="Opening recipe…" />;

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-xl py-12">
        <BackLink to={paths.list()}>Back to recipes</BackLink>
        <Notice
          tone="error"
          action={
            !state.notFound && (
              <button type="button" onClick={reload} className="inline-flex items-center gap-1.5 font-semibold">
                <ArrowClockwiseIcon size={16} weight="bold" aria-hidden="true" />
                Retry
              </button>
            )
          }
        >
          {state.error}
        </Notice>
      </div>
    );
  }

  const { recipe } = state;
  const tags = parseTags(recipe.tags);
  const ingredients = parseIngredients(recipe.ingredients);
  const instructions = parseInstructions(recipe.instructions);
  const minutes = totalMinutes(recipe);
  const sourceUrl = safeHttpUrl(recipe.sourceUrl);
  const hasImage = safeHttpUrl(recipe.imageUrl) !== null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteRecipe(recipe.id);
      toast.success(`“${recipe.title}” was deleted.`);
      navigate(paths.list(), { replace: true });
    } catch (err) {
      toast.error(toErrorMessage(err, 'Failed to delete recipe.'));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleFavorite = async () => {
    setFavoritePending(true);
    try {
      setRecipe(await api.toggleFavorite(recipe.id));
    } catch (err) {
      toast.error(toErrorMessage(err, 'Failed to update favorite.'));
    } finally {
      setFavoritePending(false);
    }
  };

  const toggleIngredient = (index: number) =>
    setChecked(current => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const stats = [
    recipe.prepTime !== null && { label: 'Prep', value: formatMinutes(recipe.prepTime), icon: <TimerIcon size={20} weight="duotone" /> },
    recipe.cookTime !== null && { label: 'Cook', value: formatMinutes(recipe.cookTime), icon: <FireIcon size={20} weight="duotone" /> },
    minutes !== null &&
      recipe.prepTime !== null &&
      recipe.cookTime !== null && { label: 'Total', value: formatMinutes(minutes), icon: <ClockIcon size={20} weight="duotone" /> },
    recipe.servings !== null && { label: 'Yield', value: formatServings(recipe.servings), icon: <UsersIcon size={20} weight="duotone" /> },
  ].filter(Boolean) as { label: string; value: string; icon: ReactNode }[];

  return (
    <article className="mx-auto max-w-5xl">
      <BackLink to={paths.list()}>Back to recipes</BackLink>

      <div className={`${cardClass} overflow-hidden`}>
        {/* Hero */}
        <header className="relative">
          {hasImage ? (
            <div className="relative h-[42dvh] min-h-[280px] max-h-[520px]">
              <RecipeImage src={recipe.imageUrl} className="size-full object-cover" priority iconSize={64} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            </div>
          ) : (
            <div className="h-28 bg-gradient-to-br from-brand-50 via-stone-50 to-accent-50" />
          )}

          <div className={`p-6 md:p-10 ${hasImage ? 'absolute inset-x-0 bottom-0 text-white' : '-mt-10'}`}>
            {tags.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2" aria-label="Tags">
                {tags.map(tag => (
                  <li key={tag}>
                    <Link
                      to={paths.list(new URLSearchParams({ tag }).toString())}
                      className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider transition-colors ${
                        hasImage
                          ? 'bg-white/20 text-white hover:bg-white/30 md:backdrop-blur-md'
                          : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                      }`}
                    >
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <h1
              className={`max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight md:text-5xl ${
                hasImage ? 'text-white [text-shadow:0_2px_12px_rgb(0_0_0/0.3)]' : 'text-stone-900'
              }`}
            >
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className={`mt-3 max-w-2xl text-base md:text-lg ${hasImage ? 'text-white/90' : 'text-stone-600'}`}>
                {recipe.description}
              </p>
            )}
          </div>
        </header>

        {/* Meta + actions */}
        <div className="flex flex-col gap-5 border-b border-stone-100 bg-stone-50/60 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-10">
          {stats.length > 0 || sourceUrl ? (
            <dl className="flex flex-wrap items-center gap-x-8 gap-y-4">
              {stats.map(stat => (
                <Stat key={stat.label} {...stat} />
              ))}
              {sourceUrl && (
                <div>
                  <dt className="sr-only">Source</dt>
                  <dd>
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3.5 py-2 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50"
                    >
                      Original at {hostnameOf(sourceUrl)}
                      <ArrowSquareOutIcon size={16} weight="bold" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <span />
          )}

          {authenticated &&
            (confirmingDelete ? (
              <m.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alertdialog"
                aria-labelledby="confirm-delete-title"
                aria-describedby="confirm-delete-description"
                onKeyDown={e => {
                  if (e.key === 'Escape' && !deleting) setConfirmingDelete(false);
                }}
                className="w-full rounded-2xl border border-red-200 bg-red-50 p-4 md:w-96"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-600" aria-hidden="true">
                    <TrashIcon size={20} weight="duotone" />
                  </span>
                  <div className="pt-0.5">
                    <p id="confirm-delete-title" className="font-semibold text-red-900">
                      Delete this recipe?
                    </p>
                    <p id="confirm-delete-description" className="mt-0.5 text-sm leading-relaxed text-red-800">
                      It will be permanently removed from your vault. This can't be undone.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2 sm:justify-end">
                  <button
                    ref={cancelDeleteRef}
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className={`${buttonStyles.secondary} flex-1 sm:flex-none`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className={`${buttonStyles.danger} flex-1 sm:flex-none`}
                  >
                    {deleting ? <Spinner className="size-4.5" /> : <TrashIcon size={18} weight="bold" aria-hidden="true" />}
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </m.div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleFavorite}
                  disabled={favoritePending}
                  aria-pressed={recipe.isFavorite}
                  className={`${buttonStyles.secondary} ${recipe.isFavorite ? 'border-accent-200! bg-accent-50! text-accent-700!' : ''}`}
                >
                  <HeartIcon size={18} weight={recipe.isFavorite ? 'fill' : 'bold'} aria-hidden="true" />
                  {recipe.isFavorite ? 'Favorite' : 'Add to favorites'}
                </button>
                <Link to={paths.edit(recipe.id)} className={buttonStyles.secondary}>
                  <PencilSimpleIcon size={18} weight="bold" aria-hidden="true" />
                  Edit
                </Link>
                <button
                  ref={deleteButtonRef}
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className={`${buttonStyles.secondary} hover:border-red-200! hover:bg-red-50! hover:text-red-700!`}
                >
                  <TrashIcon size={18} weight="bold" aria-hidden="true" />
                  Delete
                </button>
              </div>
            ))}

          {!authenticated && recipe.isFavorite && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700">
              <HeartIcon size={18} weight="fill" aria-hidden="true" /> Favorite
            </span>
          )}
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-12 p-6 md:grid-cols-12 md:p-10">
          <section className="md:col-span-5 lg:col-span-4" aria-labelledby="ingredients-heading">
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <h2 id="ingredients-heading" className="font-display text-2xl font-semibold text-stone-900">
                Ingredients
              </h2>
              {checked.size > 0 && (
                <button
                  type="button"
                  onClick={() => setChecked(new Set())}
                  className="text-sm font-medium text-brand-700 hover:text-brand-900"
                >
                  Reset
                </button>
              )}
            </div>
            {ingredients.length === 0 ? (
              <p className="text-stone-500">No ingredients listed.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {ingredients.map((ingredient, index) => {
                  const isChecked = checked.has(index);
                  const amount = [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ');
                  return (
                    // Index keys are safe: the list is static for the lifetime of this view.
                    <li key={index}>
                      <label className="group flex cursor-pointer items-start gap-3 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleIngredient(index)}
                          className="peer sr-only"
                        />
                        <span
                          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2 ${
                            isChecked ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white group-hover:border-brand-500'
                          }`}
                          aria-hidden="true"
                        >
                          {isChecked && <CheckIcon size={12} weight="bold" />}
                        </span>
                        <span className={`leading-relaxed transition-colors ${isChecked ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                          {amount && <span className={`font-semibold ${isChecked ? '' : 'text-stone-900'}`}>{amount} </span>}
                          {ingredient.name}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="md:col-span-7 lg:col-span-8" aria-labelledby="instructions-heading">
            <h2 id="instructions-heading" className="mb-5 font-display text-2xl font-semibold text-stone-900">
              Instructions
            </h2>
            {instructions.length === 0 ? (
              <p className="text-stone-500">No instructions listed.</p>
            ) : (
              <ol className="space-y-6">
                {instructions.map((step, index) => (
                  <li key={index} className="flex gap-4">
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-900 text-sm font-bold text-white"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <p className="whitespace-pre-line pt-0.5 leading-relaxed text-stone-700">
                      <span className="sr-only">Step {index + 1}: </span>
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            )}

            {recipe.notes && (
              <aside className="mt-12 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-6">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-amber-900">Chef's notes</h3>
                <p className="whitespace-pre-line leading-relaxed text-amber-900/90">{recipe.notes}</p>
              </aside>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
