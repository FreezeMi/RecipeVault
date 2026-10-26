import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { PlusIcon, XIcon, FloppyDiskIcon, ArrowUpIcon, ArrowDownIcon, HeartIcon } from '@phosphor-icons/react';
import type { Recipe, RecipeInput } from '../types';
import { api, ApiError, toErrorMessage } from '../services/api';
import { RECIPE_CATEGORIES } from '../constants';
import { parseIngredients, parseInstructions, parseTags, safeHttpUrl } from '../lib/recipe';
import { navigate, paths, useScrollRestoration } from '../lib/router';
import { useDocumentTitle, useRecipe } from '../lib/hooks';
import { tagLabel, useT, type Messages } from '../lib/i18n';
import { useToast } from './Toast';
import RecipeImage from './RecipeImage';
import { BackLink, Notice, PageLoader, Spinner, buttonStyles, cardClass, inputClass, labelClass } from './ui';

// Mirrors the server-side limits in backend/src/validation.ts.
const MAX_MINUTES = 7 * 24 * 60;
const MAX_SERVINGS = 1000;

// Each dynamic row gets a stable key so React keeps the same input mounted while the user types.
let rowKeySeq = 0;
const nextRowKey = () => ++rowKeySeq;

interface IngredientRow {
  key: number;
  quantity: string;
  unit: string;
  name: string;
}

interface StepRow {
  key: number;
  text: string;
}

interface FormState {
  title: string;
  description: string;
  tags: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  imageUrl: string;
  sourceUrl: string;
  ingredients: IngredientRow[];
  instructions: StepRow[];
  notes: string;
  isFavorite: boolean;
}

type FieldName = 'title' | 'prepTime' | 'cookTime' | 'servings' | 'imageUrl' | 'sourceUrl' | 'ingredients' | 'instructions';
type FieldErrors = Partial<Record<FieldName, string>>;

const emptyIngredient = (): IngredientRow => ({ key: nextRowKey(), quantity: '', unit: '', name: '' });
const emptyStep = (): StepRow => ({ key: nextRowKey(), text: '' });

const toFormState = (recipe?: Recipe): FormState => {
  const ingredients = recipe ? parseIngredients(recipe.ingredients) : [];
  const instructions = recipe ? parseInstructions(recipe.instructions) : [];
  return {
    title: recipe?.title ?? '',
    description: recipe?.description ?? '',
    tags: recipe ? parseTags(recipe.tags) : [],
    prepTime: recipe?.prepTime?.toString() ?? '',
    cookTime: recipe?.cookTime?.toString() ?? '',
    servings: recipe?.servings?.toString() ?? '',
    imageUrl: recipe?.imageUrl ?? '',
    sourceUrl: recipe?.sourceUrl ?? '',
    ingredients: ingredients.length ? ingredients.map(i => ({ ...i, key: nextRowKey() })) : [emptyIngredient()],
    instructions: instructions.length ? instructions.map(text => ({ key: nextRowKey(), text })) : [emptyStep()],
    notes: recipe?.notes ?? '',
    isFavorite: recipe?.isFavorite ?? false,
  };
};

/** Snapshot without row keys, used to detect unsaved changes. */
const snapshot = (state: FormState) =>
  JSON.stringify({
    ...state,
    ingredients: state.ingredients.map(({ quantity, unit, name }) => [quantity, unit, name]),
    instructions: state.instructions.map(step => step.text),
  });

const parseOptionalInt = (value: string) => (value.trim() === '' ? null : Number(value));

function validate(state: FormState, t: Messages): FieldErrors {
  const messages = t.form.errors;
  const errors: FieldErrors = {};
  if (!state.title.trim()) errors.title = messages.title;

  const checkInt = (field: 'prepTime' | 'cookTime' | 'servings', min: number, max: number, label: string) => {
    const value = parseOptionalInt(state[field]);
    if (value !== null && (!Number.isInteger(value) || value < min || value > max)) {
      errors[field] = messages.wholeNumber(label, min, max);
    }
  };
  checkInt('prepTime', 0, MAX_MINUTES, messages.prepTime);
  checkInt('cookTime', 0, MAX_MINUTES, messages.cookTime);
  checkInt('servings', 1, MAX_SERVINGS, messages.servings);

  if (state.imageUrl.trim() && !safeHttpUrl(state.imageUrl)) errors.imageUrl = messages.imageUrl;
  if (state.sourceUrl.trim() && !safeHttpUrl(state.sourceUrl)) errors.sourceUrl = messages.sourceUrl;

  if (!state.ingredients.some(i => i.name.trim())) errors.ingredients = messages.ingredients;
  if (!state.instructions.some(s => s.text.trim())) errors.instructions = messages.instructions;
  return errors;
}

const toPayload = (state: FormState): RecipeInput => ({
  title: state.title.trim(),
  description: state.description.trim(),
  tags: state.tags,
  prepTime: parseOptionalInt(state.prepTime),
  cookTime: parseOptionalInt(state.cookTime),
  servings: parseOptionalInt(state.servings),
  imageUrl: state.imageUrl.trim(),
  sourceUrl: state.sourceUrl.trim(),
  ingredients: state.ingredients
    .filter(i => i.name.trim())
    .map(({ quantity, unit, name }) => ({ quantity: quantity.trim(), unit: unit.trim(), name: name.trim() })),
  instructions: state.instructions.map(s => s.text.trim()).filter(Boolean),
  notes: state.notes.trim(),
  isFavorite: state.isFavorite,
});

const FIELD_ORDER: FieldName[] = ['title', 'imageUrl', 'sourceUrl', 'prepTime', 'cookTime', 'servings', 'ingredients', 'instructions'];

function FieldError({ id, message }: Readonly<{ id: string; message?: string }>) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

function RecipeEditor({ recipe }: Readonly<{ recipe?: Recipe }>) {
  const isEdit = recipe !== undefined;
  const toast = useToast();
  const t = useT();
  const initial = useMemo(() => toFormState(recipe), [recipe]);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<{ message: string; details?: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const focusAfterRender = useRef<string | null>(null);
  const serverErrorRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(isEdit ? t.form.editTitle(recipe.title) : t.form.newTitle);
  useScrollRestoration(true);

  const isDirty = snapshot(form) !== snapshot(initial);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!isDirty || saving) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, saving]);

  // Move focus to a newly added row once it exists in the DOM.
  useEffect(() => {
    if (focusAfterRender.current) {
      document.getElementById(focusAfterRender.current)?.focus();
      focusAfterRender.current = null;
    }
  });

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field in errors) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const toggleTag = (tag: string) =>
    update('tags', form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag]);

  // Predefined categories plus any custom tags the recipe already has (so they're never silently lost).
  const availableTags = useMemo(
    () => [...RECIPE_CATEGORIES, ...initial.tags.filter(tag => !(RECIPE_CATEGORIES as readonly string[]).includes(tag))],
    [initial.tags],
  );

  // --- Ingredients ---
  const updateIngredient = (key: number, field: 'quantity' | 'unit' | 'name', value: string) => {
    update('ingredients', form.ingredients.map(row => (row.key === key ? { ...row, [field]: value } : row)));
  };
  const addIngredient = (afterKey?: number) => {
    const row = emptyIngredient();
    const index = afterKey === undefined ? form.ingredients.length : form.ingredients.findIndex(r => r.key === afterKey) + 1;
    update('ingredients', [...form.ingredients.slice(0, index), row, ...form.ingredients.slice(index)]);
    focusAfterRender.current = `ingredient-${row.key}-quantity`;
  };
  const removeIngredient = (key: number) => {
    const remaining = form.ingredients.filter(row => row.key !== key);
    update('ingredients', remaining.length ? remaining : [emptyIngredient()]);
  };
  const handleIngredientKeyDown = (event: KeyboardEvent<HTMLInputElement>, key: number) => {
    // Enter adds the next ingredient instead of submitting the form.
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      addIngredient(key);
    }
  };

  // --- Instructions ---
  const updateStep = (key: number, text: string) => {
    update('instructions', form.instructions.map(step => (step.key === key ? { ...step, text } : step)));
  };
  const addStep = () => {
    const step = emptyStep();
    update('instructions', [...form.instructions, step]);
    focusAfterRender.current = `step-${step.key}`;
  };
  const removeStep = (key: number) => {
    const remaining = form.instructions.filter(step => step.key !== key);
    update('instructions', remaining.length ? remaining : [emptyStep()]);
  };
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= form.instructions.length) return;
    const next = [...form.instructions];
    [next[index], next[target]] = [next[target]!, next[index]!];
    update('instructions', next);
    focusAfterRender.current = `step-move-${direction === -1 ? 'up' : 'down'}-${next[target]!.key}`;
  };

  const leave = () => navigate(isEdit ? paths.detail(recipe.id) : paths.list(), { replace: true });

  const handleCancel = () => {
    if (!isDirty || window.confirm(t.form.discardChanges)) leave();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    const fieldErrors = validate(form, t);
    setErrors(fieldErrors);
    const firstInvalid = FIELD_ORDER.find(field => fieldErrors[field]);
    if (firstInvalid) {
      const target =
        firstInvalid === 'ingredients'
          ? `ingredient-${form.ingredients[0]!.key}-name`
          : firstInvalid === 'instructions'
            ? `step-${form.instructions[0]!.key}`
            : firstInvalid;
      document.getElementById(target)?.focus();
      return;
    }

    setSaving(true);
    try {
      const payload = toPayload(form);
      const saved = isEdit ? await api.updateRecipe(recipe.id, payload) : await api.createRecipe(payload);
      toast.success(isEdit ? t.form.updated : t.form.added);
      navigate(paths.detail(saved.id), { replace: true });
    } catch (err) {
      setSaving(false);
      setServerError({
        message: toErrorMessage(err, t.form.saveFailed),
        details: err instanceof ApiError && err.details && err.details.length > 1 ? err.details : undefined,
      });
      requestAnimationFrame(() => serverErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    }
  };

  const fieldProps = (field: FieldName) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
  });

  const imagePreview = safeHttpUrl(form.imageUrl);
  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink to={isEdit ? paths.detail(recipe.id) : paths.list()}>{isEdit ? t.form.backToRecipe : t.common.backToRecipes}</BackLink>

      <div className={`${cardClass} p-6 sm:p-8 md:p-12`}>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">
          {isEdit ? t.form.editHeading : t.form.newHeading}
        </h1>
        <p className="mt-2 text-stone-600">
          {t.form.requiredNote.before} <span className="text-red-600">*</span> {t.form.requiredNote.after}
        </p>

        <div ref={serverErrorRef} className="mt-6 space-y-3 empty:hidden">
          {serverError && (
            <Notice tone="error">
              <p className="font-semibold">{serverError.message}</p>
              {serverError.details && (
                <ul className="mt-1 list-disc pl-5">
                  {serverError.details.map(detail => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </Notice>
          )}
          {errorCount > 0 && (
            <Notice tone="error">
              {t.form.fixFields(errorCount)}
            </Notice>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-10">
          {/* Basics */}
          <section className="space-y-5" aria-labelledby="basics-heading">
            <h2 id="basics-heading" className="sr-only">
              {t.form.basics}
            </h2>
            <div>
              <label htmlFor="title" className={labelClass}>
                {t.form.title} <span className="text-red-600">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={e => update('title', e.target.value)}
                className={inputClass}
                placeholder={t.form.titlePlaceholder}
                maxLength={200}
                autoComplete="off"
                required
                {...fieldProps('title')}
              />
              <FieldError id="title-error" message={errors.title} />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                {t.form.description}
              </label>
              <textarea
                id="description"
                value={form.description}
                onChange={e => update('description', e.target.value)}
                rows={3}
                maxLength={2000}
                className={`${inputClass} resize-y`}
                placeholder={t.form.descriptionPlaceholder}
              />
            </div>

            <fieldset>
              <legend className={labelClass}>{t.common.tags}</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {availableTags.map(tag => {
                  const selected = form.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      {tagLabel(tag, t)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <label htmlFor="imageUrl" className={labelClass}>
                  {t.form.imageLink}
                </label>
                <input
                  id="imageUrl"
                  type="url"
                  inputMode="url"
                  value={form.imageUrl}
                  onChange={e => update('imageUrl', e.target.value)}
                  className={inputClass}
                  placeholder="https://example.com/photo.jpg"
                  {...fieldProps('imageUrl')}
                />
                <FieldError id="imageUrl-error" message={errors.imageUrl} />
                {!errors.imageUrl && (
                  <p className="mt-1.5 text-sm text-stone-500">{t.form.imageHint}</p>
                )}
              </div>
              {imagePreview && (
                <RecipeImage
                  key={imagePreview}
                  src={imagePreview}
                  alt={t.form.imagePreview}
                  className="h-24 w-full rounded-2xl border border-stone-200 object-cover sm:mt-7 sm:w-32"
                />
              )}
            </div>

            <div>
              <label htmlFor="sourceUrl" className={labelClass}>
                {t.form.sourceLink}
              </label>
              <input
                id="sourceUrl"
                type="url"
                inputMode="url"
                value={form.sourceUrl}
                onChange={e => update('sourceUrl', e.target.value)}
                className={inputClass}
                placeholder="https://www.example.com/recipe"
                {...fieldProps('sourceUrl')}
              />
              <FieldError id="sourceUrl-error" message={errors.sourceUrl} />
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-5">
              {(
                [
                  ['prepTime', t.form.prepMinutes, '15', 0, MAX_MINUTES],
                  ['cookTime', t.form.cookMinutes, '45', 0, MAX_MINUTES],
                  ['servings', t.common.servings, '4', 1, MAX_SERVINGS],
                ] as const
              ).map(([field, label, placeholder, min, max]) => (
                <div key={field}>
                  <label htmlFor={field} className={labelClass}>
                    {label}
                  </label>
                  <input
                    id={field}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    step={1}
                    value={form[field]}
                    onChange={e => update(field, e.target.value)}
                    className={inputClass}
                    placeholder={placeholder}
                    {...fieldProps(field)}
                  />
                  <FieldError id={`${field}-error`} message={errors[field]} />
                </div>
              ))}
            </div>
          </section>

          {/* Ingredients */}
          <fieldset className="border-t border-stone-100 pt-8" aria-describedby={errors.ingredients ? 'ingredients-error' : undefined}>
            <legend className="float-left mb-4 w-full font-display text-2xl font-semibold text-stone-900">
              {t.common.ingredients} <span className="text-base text-red-600">*</span>
            </legend>
            <div className="clear-both space-y-3">
              <div className="hidden grid-cols-[5.5rem_6.5rem_1fr_2.5rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-stone-500 sm:grid">
                <span>{t.form.quantity}</span>
                <span>{t.form.unit}</span>
                <span>{t.form.ingredient}</span>
              </div>
              {form.ingredients.map((row, index) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_1fr_2.5rem] gap-2 rounded-2xl border border-stone-100 p-2 sm:grid-cols-[5.5rem_6.5rem_1fr_2.5rem] sm:border-0 sm:p-0"
                >
                  <input
                    id={`ingredient-${row.key}-quantity`}
                    type="text"
                    placeholder={index === 0 ? '200' : undefined}
                    aria-label={t.form.ingredientQuantity(index + 1)}
                    value={row.quantity}
                    maxLength={50}
                    onChange={e => updateIngredient(row.key, 'quantity', e.target.value)}
                    className={`${inputClass} px-3`}
                  />
                  <input
                    type="text"
                    placeholder={index === 0 ? 'g' : undefined}
                    aria-label={t.form.ingredientUnit(index + 1)}
                    value={row.unit}
                    maxLength={50}
                    onChange={e => updateIngredient(row.key, 'unit', e.target.value)}
                    className={`${inputClass} px-3`}
                  />
                  <input
                    id={`ingredient-${row.key}-name`}
                    type="text"
                    placeholder={index === 0 ? t.form.namePlaceholder : t.form.ingredient}
                    aria-label={t.form.ingredientName(index + 1)}
                    value={row.name}
                    maxLength={500}
                    onChange={e => updateIngredient(row.key, 'name', e.target.value)}
                    onKeyDown={e => handleIngredientKeyDown(e, row.key)}
                    aria-invalid={errors.ingredients && index === 0 ? true : undefined}
                    className={`${inputClass} col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto`}
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(row.key)}
                    aria-label={t.form.removeIngredient(index + 1)}
                    className={`${buttonStyles.icon} col-start-3 row-span-2 self-center hover:bg-red-50! hover:text-red-600! sm:col-start-auto sm:row-span-1`}
                  >
                    <XIcon size={18} weight="bold" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <FieldError id="ingredients-error" message={errors.ingredients} />
            <button
              type="button"
              onClick={() => addIngredient()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
            >
              <PlusIcon size={16} weight="bold" aria-hidden="true" /> {t.form.addIngredient}
            </button>
            <p className="mt-1 text-xs text-stone-500">{t.form.ingredientTip}</p>
          </fieldset>

          {/* Instructions */}
          <fieldset className="border-t border-stone-100 pt-8" aria-describedby={errors.instructions ? 'instructions-error' : undefined}>
            <legend className="float-left mb-4 w-full font-display text-2xl font-semibold text-stone-900">
              {t.common.instructions} <span className="text-base text-red-600">*</span>
            </legend>
            <ol className="clear-both space-y-3">
              {form.instructions.map((step, index) => (
                <li key={step.key} className="flex items-start gap-3">
                  <span
                    className="mt-2.5 grid size-7 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-bold text-white"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <textarea
                    id={`step-${step.key}`}
                    value={step.text}
                    rows={2}
                    maxLength={5000}
                    aria-label={t.common.step(index + 1)}
                    aria-invalid={errors.instructions && index === 0 ? true : undefined}
                    onChange={e => updateStep(step.key, e.target.value)}
                    placeholder={t.form.stepPlaceholder}
                    className={`${inputClass} min-h-[3.25rem] flex-1 resize-y [field-sizing:content]`}
                  />
                  <div className="flex shrink-0 flex-col">
                    <button
                      id={`step-move-up-${step.key}`}
                      type="button"
                      onClick={() => moveStep(index, -1)}
                      disabled={index === 0}
                      aria-label={t.form.moveStepUp(index + 1)}
                      className={`${buttonStyles.icon} p-1.5! disabled:opacity-30`}
                    >
                      <ArrowUpIcon size={16} weight="bold" aria-hidden="true" />
                    </button>
                    <button
                      id={`step-move-down-${step.key}`}
                      type="button"
                      onClick={() => moveStep(index, 1)}
                      disabled={index === form.instructions.length - 1}
                      aria-label={t.form.moveStepDown(index + 1)}
                      className={`${buttonStyles.icon} p-1.5! disabled:opacity-30`}
                    >
                      <ArrowDownIcon size={16} weight="bold" aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStep(step.key)}
                    aria-label={t.form.removeStep(index + 1)}
                    className={`${buttonStyles.icon} mt-1.5 hover:bg-red-50! hover:text-red-600!`}
                  >
                    <XIcon size={18} weight="bold" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
            <FieldError id="instructions-error" message={errors.instructions} />
            <button
              type="button"
              onClick={addStep}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
            >
              <PlusIcon size={16} weight="bold" aria-hidden="true" /> {t.form.addStep}
            </button>
          </fieldset>

          {/* Extras */}
          <section className="space-y-6 border-t border-stone-100 pt-8" aria-label={t.form.extras}>
            <div>
              <label htmlFor="notes" className={labelClass}>
                {t.common.chefsNotes}
              </label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                rows={3}
                maxLength={5000}
                className={`${inputClass} resize-y`}
                placeholder={t.form.notesPlaceholder}
              />
            </div>

            <label htmlFor="isFavorite" className="group inline-flex cursor-pointer items-center gap-3">
              <input
                id="isFavorite"
                type="checkbox"
                role="switch"
                className="peer sr-only"
                checked={form.isFavorite}
                onChange={e => update('isFavorite', e.target.checked)}
              />
              <span
                aria-hidden="true"
                className="relative h-7 w-12 rounded-full bg-stone-200 transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600 peer-focus-visible:ring-offset-2"
              />
              <span className="inline-flex items-center gap-1.5 font-medium text-stone-800">
                <HeartIcon size={18} weight={form.isFavorite ? 'fill' : 'regular'} className="text-accent-600" aria-hidden="true" />
                {t.form.markFavorite}
              </span>
            </label>
          </section>

          <div className="sticky bottom-4 z-10 -mx-2 flex items-center justify-end gap-3 rounded-full border border-stone-200/80 bg-white/95 p-2 shadow-lg shadow-stone-900/5 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <button type="button" onClick={handleCancel} disabled={saving} className={buttonStyles.ghost}>
              {t.common.cancel}
            </button>
            <button type="submit" disabled={saving} className={`${buttonStyles.primary} px-7!`}>
              {saving ? <Spinner className="size-5" /> : <FloppyDiskIcon size={20} weight="bold" aria-hidden="true" />}
              {saving ? t.form.saving : isEdit ? t.form.saveChanges : t.form.saveRecipe}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Route component: `/recipes/new` (no id) or `/recipes/:id/edit`. */
export default function RecipeForm({ id }: Readonly<{ id?: number }>) {
  if (id === undefined) return <RecipeEditor />;
  return <EditRecipeLoader id={id} />;
}

function EditRecipeLoader({ id }: Readonly<{ id: number }>) {
  const state = useRecipe(id);
  const t = useT();
  if (state.status === 'loading') return <PageLoader label={t.form.loading} />;
  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-xl py-12">
        <BackLink to={paths.list()}>{t.common.backToRecipes}</BackLink>
        <Notice tone="error">{state.error}</Notice>
      </div>
    );
  }
  return <RecipeEditor key={state.recipe.id} recipe={state.recipe} />;
}
