import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { PlusIcon, XIcon, FloppyDiskIcon, ArrowUpIcon, ArrowDownIcon, HeartIcon } from '@phosphor-icons/react';
import type { Recipe, RecipeInput, RecipeText, RecipeTextInput } from '../types';
import { api, ApiError, toErrorMessage } from '../services/api';
import { RECIPE_CATEGORIES } from '../constants';
import { originalLanguage, originalText, parseTags, parseTranslations, safeHttpUrl } from '../lib/recipe';
import { navigate, paths, useScrollRestoration } from '../lib/router';
import { useDocumentTitle, useRecipe } from '../lib/hooks';
import { LANGUAGES, tagLabel, useLanguage, useT, type Language, type Messages } from '../lib/i18n';
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

/** The fields that exist once per language. */
interface TextState {
  title: string;
  description: string;
  ingredients: IngredientRow[];
  instructions: StepRow[];
  notes: string;
}

interface FormState {
  /** Language of the original text; every other entry in `texts` is a translation of it. */
  language: Language;
  texts: Partial<Record<Language, TextState>>;
  tags: string[];
  prepTime: string;
  cookTime: string;
  servings: string;
  imageUrl: string;
  sourceUrl: string;
  isFavorite: boolean;
}

type SharedField = Exclude<keyof FormState, 'language' | 'texts'>;
type TextField = 'title' | 'ingredients' | 'instructions';
/** Shared fields by name, text fields per language (e.g. "nl.title"). */
type FieldName = 'prepTime' | 'cookTime' | 'servings' | 'imageUrl' | 'sourceUrl' | `${Language}.${TextField}`;
type FieldErrors = Partial<Record<FieldName, string>>;

const emptyIngredient = (): IngredientRow => ({ key: nextRowKey(), quantity: '', unit: '', name: '' });
const emptyStep = (): StepRow => ({ key: nextRowKey(), text: '' });

const toTextState = (text?: RecipeText): TextState => ({
  title: text?.title ?? '',
  description: text?.description ?? '',
  ingredients: text?.ingredients.length ? text.ingredients.map(i => ({ ...i, key: nextRowKey() })) : [emptyIngredient()],
  instructions: text?.instructions.length ? text.instructions.map(step => ({ key: nextRowKey(), text: step })) : [emptyStep()],
  notes: text?.notes ?? '',
});

/** A new recipe is written in the interface language unless the user picks another. */
const toFormState = (recipe: Recipe | undefined, newRecipeLanguage: Language): FormState => {
  const language = recipe ? originalLanguage(recipe) : newRecipeLanguage;
  const texts: Partial<Record<Language, TextState>> = { [language]: toTextState(recipe && originalText(recipe)) };
  const translations = parseTranslations(recipe?.translations);
  for (const other of LANGUAGES) {
    const translation = translations[other];
    if (other !== language && translation) texts[other] = toTextState(translation);
  }
  return {
    language,
    texts,
    tags: recipe ? parseTags(recipe.tags) : [],
    prepTime: recipe?.prepTime?.toString() ?? '',
    cookTime: recipe?.cookTime?.toString() ?? '',
    servings: recipe?.servings?.toString() ?? '',
    imageUrl: recipe?.imageUrl ?? '',
    sourceUrl: recipe?.sourceUrl ?? '',
    isFavorite: recipe?.isFavorite ?? false,
  };
};

/** The original text first, then its translations. */
const textEntries = (state: FormState): [Language, TextState][] =>
  [state.language, ...LANGUAGES.filter(language => language !== state.language)].flatMap((language): [Language, TextState][] => {
    const text = state.texts[language];
    return text ? [[language, text]] : [];
  });

/** Snapshot without row keys, used to detect unsaved changes. */
const snapshotText = (text: TextState | undefined) =>
  text &&
  JSON.stringify({
    ...text,
    ingredients: text.ingredients.map(({ quantity, unit, name }) => [quantity, unit, name]),
    instructions: text.instructions.map(step => step.text),
  });

const snapshot = (state: FormState) =>
  JSON.stringify({ ...state, texts: LANGUAGES.map(language => snapshotText(state.texts[language]) ?? null) });

const parseOptionalInt = (value: string) => (value.trim() === '' ? null : Number(value));

function validate(state: FormState, t: Messages): FieldErrors {
  const messages = t.form.errors;
  const errors: FieldErrors = {};
  for (const [language, text] of textEntries(state)) {
    if (!text.title.trim()) errors[`${language}.title`] = messages.title;
    if (!text.ingredients.some(i => i.name.trim())) errors[`${language}.ingredients`] = messages.ingredients;
    if (!text.instructions.some(s => s.text.trim())) errors[`${language}.instructions`] = messages.instructions;
  }

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
  return errors;
}

/** Fields in the order they appear, original first, so focus goes to the first error on screen. */
const fieldOrder = (state: FormState): FieldName[] => [
  `${state.language}.title`,
  'imageUrl',
  'sourceUrl',
  'prepTime',
  'cookTime',
  'servings',
  `${state.language}.ingredients`,
  `${state.language}.instructions`,
  ...textEntries(state)
    .slice(1)
    .flatMap(([language]): FieldName[] => [`${language}.title`, `${language}.ingredients`, `${language}.instructions`]),
];

const toTextPayload = (text: TextState): RecipeTextInput => ({
  title: text.title.trim(),
  description: text.description.trim(),
  ingredients: text.ingredients
    .filter(i => i.name.trim())
    .map(({ quantity, unit, name }) => ({ quantity: quantity.trim(), unit: unit.trim(), name: name.trim() })),
  instructions: text.instructions.map(s => s.text.trim()).filter(Boolean),
  notes: text.notes.trim(),
});

const toPayload = (state: FormState): RecipeInput => {
  const [[, original], ...translations] = textEntries(state);
  return {
    ...toTextPayload(original),
    tags: state.tags,
    prepTime: parseOptionalInt(state.prepTime),
    cookTime: parseOptionalInt(state.cookTime),
    servings: parseOptionalInt(state.servings),
    imageUrl: state.imageUrl.trim(),
    sourceUrl: state.sourceUrl.trim(),
    language: state.language,
    translations: Object.fromEntries(translations.map(([language, text]) => [language, toTextPayload(text)])),
    isFavorite: state.isFavorite,
  };
};

const languageChipClass = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
  }`;

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
  const interfaceLanguage = useLanguage();
  // Built once, so switching the interface language doesn't change a recipe that's being written.
  const [initial] = useState(() => toFormState(recipe, interfaceLanguage));
  const [form, setForm] = useState<FormState>(initial);
  // The language whose text the title, description, ingredient, step and notes fields show.
  const [editing, setEditing] = useState<Language>(initial.language);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<{ message: string; details?: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const focusAfterRender = useRef<string | null>(null);
  const serverErrorRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(isEdit ? t.form.editTitle(initial.texts[interfaceLanguage]?.title || recipe.title) : t.form.newTitle);
  useScrollRestoration(true);

  const isDirty = snapshot(form) !== snapshot(initial);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!isDirty || saving) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, saving]);

  // Move focus to a newly added row (or the first invalid field) once it exists in the DOM.
  useEffect(() => {
    if (focusAfterRender.current) {
      document.getElementById(focusAfterRender.current)?.focus();
      focusAfterRender.current = null;
    }
  });

  const update = <K extends SharedField>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field in errors) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  // `editing` always names a language that has text.
  const text = form.texts[editing]!;

  /** Updates a field of the text that is being edited. */
  const updateText = <K extends keyof TextState>(field: K, value: TextState[K]) => {
    setForm(prev => ({ ...prev, texts: { ...prev.texts, [editing]: { ...prev.texts[editing]!, [field]: value } } }));
    const errorKey = `${editing}.${field}`;
    if (errorKey in errors) setErrors(prev => ({ ...prev, [errorKey]: undefined }));
  };

  const toggleTag = (tag: string) =>
    update('tags', form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag]);

  // Predefined categories plus any custom tags the recipe already has (so they're never silently lost).
  const availableTags = useMemo(
    () => [...RECIPE_CATEGORIES, ...initial.tags.filter(tag => !(RECIPE_CATEGORIES as readonly string[]).includes(tag))],
    [initial.tags],
  );

  // --- Languages ---
  const languageName = (language: Language) => t.languages[language];
  const isOriginal = editing === form.language;
  const translated = textEntries(form).slice(1).map(([language]) => language);
  const untranslated = LANGUAGES.filter(language => !form.texts[language]);

  const addTranslation = (language: Language) => {
    const original = form.texts[form.language]!;
    // A copy, so quantities, units and the order of the steps carry over and only the words need translating.
    const copy: TextState = {
      ...original,
      ingredients: original.ingredients.map(row => ({ ...row, key: nextRowKey() })),
      instructions: original.instructions.map(step => ({ ...step, key: nextRowKey() })),
    };
    setForm(prev => ({ ...prev, texts: { ...prev.texts, [language]: copy } }));
    setEditing(language);
    focusAfterRender.current = 'title';
  };

  const removeTranslation = (language: Language) => {
    if (!window.confirm(t.form.confirmRemoveTranslation(languageName(language)))) return;
    setForm(prev => ({
      ...prev,
      texts: Object.fromEntries(Object.entries(prev.texts).filter(([key]) => key !== language)),
    }));
    setErrors(prev => ({ ...prev, [`${language}.title`]: undefined, [`${language}.ingredients`]: undefined, [`${language}.instructions`]: undefined }));
    setEditing(form.language);
  };

  const changeOriginalLanguage = (language: Language) => {
    setForm(prev => {
      // Already translated into that language: the translation and the original swap roles.
      if (prev.texts[language]) return { ...prev, language };
      // Otherwise the text was written in that language all along, so it moves there.
      const texts = Object.fromEntries(Object.entries(prev.texts).filter(([key]) => key !== prev.language));
      return { ...prev, language, texts: { ...texts, [language]: prev.texts[prev.language] } };
    });
    setEditing(language);
    // Text errors are filed under a language, which may just have changed; they're rechecked on save.
    setErrors({});
  };

  const textChanged = (language: Language) => snapshotText(form.texts[language]) !== snapshotText(initial.texts[language]);
  // Editing only the original of a translated recipe probably leaves its translation out of date.
  const showReviewHint = isEdit && translated.length > 0 && textChanged(form.language) && !translated.some(textChanged);
  const isUntouchedCopy = !isOriginal && snapshotText(text) === snapshotText(form.texts[form.language]);

  const hasErrors = (language: Language) =>
    (['title', 'ingredients', 'instructions'] as const).some(field => errors[`${language}.${field}`]) ||
    (language === form.language && (['prepTime', 'cookTime', 'servings', 'imageUrl', 'sourceUrl'] as const).some(field => errors[field]));

  // --- Ingredients ---
  const updateIngredient = (key: number, field: 'quantity' | 'unit' | 'name', value: string) => {
    updateText('ingredients', text.ingredients.map(row => (row.key === key ? { ...row, [field]: value } : row)));
  };
  const addIngredient = (afterKey?: number) => {
    const row = emptyIngredient();
    const index = afterKey === undefined ? text.ingredients.length : text.ingredients.findIndex(r => r.key === afterKey) + 1;
    updateText('ingredients', [...text.ingredients.slice(0, index), row, ...text.ingredients.slice(index)]);
    focusAfterRender.current = `ingredient-${row.key}-quantity`;
  };
  const removeIngredient = (key: number) => {
    const remaining = text.ingredients.filter(row => row.key !== key);
    updateText('ingredients', remaining.length ? remaining : [emptyIngredient()]);
  };
  const handleIngredientKeyDown = (event: KeyboardEvent<HTMLInputElement>, key: number) => {
    // Enter adds the next ingredient instead of submitting the form.
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      addIngredient(key);
    }
  };

  // --- Instructions ---
  const updateStep = (key: number, value: string) => {
    updateText('instructions', text.instructions.map(step => (step.key === key ? { ...step, text: value } : step)));
  };
  const addStep = () => {
    const step = emptyStep();
    updateText('instructions', [...text.instructions, step]);
    focusAfterRender.current = `step-${step.key}`;
  };
  const removeStep = (key: number) => {
    const remaining = text.instructions.filter(step => step.key !== key);
    updateText('instructions', remaining.length ? remaining : [emptyStep()]);
  };
  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= text.instructions.length) return;
    const next = [...text.instructions];
    [next[index], next[target]] = [next[target]!, next[index]!];
    updateText('instructions', next);
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
    const firstInvalid = fieldOrder(form).find(field => fieldErrors[field]);
    if (firstInvalid) {
      // Show the language with the error (shared fields live with the original), then focus the field.
      const [prefix, textField] = firstInvalid.split('.') as [string, TextField | undefined];
      const language = textField ? (prefix as Language) : form.language;
      const invalidText = form.texts[language]!;
      setEditing(language);
      focusAfterRender.current =
        textField === 'ingredients'
          ? `ingredient-${invalidText.ingredients[0]!.key}-name`
          : textField === 'instructions'
            ? `step-${invalidText.instructions[0]!.key}`
            : (textField ?? prefix);
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

  /** `id` is the element the field's error describes; text fields share one id across languages. */
  const fieldProps = (field: FieldName, id: string = field) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${id}-error` : undefined,
  });

  const imagePreview = safeHttpUrl(form.imageUrl);
  const errorCount = Object.values(errors).filter(Boolean).length;
  const ingredientsError = errors[`${editing}.ingredients`];
  const instructionsError = errors[`${editing}.instructions`];

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
          {/* Languages */}
          <section className="space-y-4 rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4" aria-labelledby="languages-heading">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="languages-heading" className={labelClass}>
                  {t.form.editingLanguage}
                </h2>
                <div role="group" aria-labelledby="languages-heading" className="flex flex-wrap gap-2">
                  {textEntries(form).map(([language]) => (
                    <button
                      key={language}
                      type="button"
                      aria-pressed={editing === language}
                      onClick={() => setEditing(language)}
                      className={languageChipClass(editing === language)}
                    >
                      {languageName(language)}
                      {language === form.language && <span className="font-normal opacity-75">· {t.form.original}</span>}
                      {hasErrors(language) && (
                        <>
                          <span className="size-2 rounded-full bg-red-500" aria-hidden="true" />
                          <span className="sr-only">({t.form.hasErrors})</span>
                        </>
                      )}
                    </button>
                  ))}
                  {untranslated.map(language => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => addTranslation(language)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-stone-300 px-3.5 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50"
                    >
                      <PlusIcon size={14} weight="bold" aria-hidden="true" />
                      {t.form.addTranslation(languageName(language))}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="originalLanguage" className={labelClass}>
                  {t.form.originalLanguage}
                </label>
                <select
                  id="originalLanguage"
                  value={form.language}
                  onChange={e => changeOriginalLanguage(e.target.value as Language)}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition-[border-color,box-shadow] focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
                >
                  {LANGUAGES.map(language => (
                    <option key={language} value={language}>
                      {languageName(language)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!isOriginal && (
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 text-sm text-stone-600">
                <p className="max-w-md">{t.form.sharedFieldsHint(languageName(form.language))}</p>
                <button type="button" onClick={() => removeTranslation(editing)} className="font-semibold text-red-700 hover:text-red-900">
                  {t.form.removeTranslation(languageName(editing))}
                </button>
              </div>
            )}
            {isUntouchedCopy && <Notice tone="info">{t.form.copiedHint(languageName(form.language))}</Notice>}
            {showReviewHint && <Notice tone="info">{t.form.reviewTranslations(languageName(form.language))}</Notice>}
          </section>

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
                lang={editing}
                value={text.title}
                onChange={e => updateText('title', e.target.value)}
                className={inputClass}
                placeholder={t.form.titlePlaceholder}
                maxLength={200}
                autoComplete="off"
                required
                {...fieldProps(`${editing}.title`, 'title')}
              />
              <FieldError id="title-error" message={errors[`${editing}.title`]} />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                {t.form.description}
              </label>
              <textarea
                id="description"
                lang={editing}
                value={text.description}
                onChange={e => updateText('description', e.target.value)}
                rows={3}
                maxLength={2000}
                className={`${inputClass} resize-y`}
                placeholder={t.form.descriptionPlaceholder}
              />
            </div>

            {/* Shared by all languages, so only edited with the original text. */}
            {isOriginal && (
              <>
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
              </>
            )}
          </section>

          {/* Ingredients */}
          <fieldset className="border-t border-stone-100 pt-8" aria-describedby={ingredientsError ? 'ingredients-error' : undefined}>
            <legend className="float-left mb-4 w-full font-display text-2xl font-semibold text-stone-900">
              {t.common.ingredients} <span className="text-base text-red-600">*</span>
            </legend>
            <div className="clear-both space-y-3">
              <div className="hidden grid-cols-[5.5rem_6.5rem_1fr_2.5rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-stone-500 sm:grid">
                <span>{t.form.quantity}</span>
                <span>{t.form.unit}</span>
                <span>{t.form.ingredient}</span>
              </div>
              {text.ingredients.map((row, index) => (
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
                    lang={editing}
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
                    lang={editing}
                    placeholder={index === 0 ? t.form.namePlaceholder : t.form.ingredient}
                    aria-label={t.form.ingredientName(index + 1)}
                    value={row.name}
                    maxLength={500}
                    onChange={e => updateIngredient(row.key, 'name', e.target.value)}
                    onKeyDown={e => handleIngredientKeyDown(e, row.key)}
                    aria-invalid={ingredientsError && index === 0 ? true : undefined}
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
            <FieldError id="ingredients-error" message={ingredientsError} />
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
          <fieldset className="border-t border-stone-100 pt-8" aria-describedby={instructionsError ? 'instructions-error' : undefined}>
            <legend className="float-left mb-4 w-full font-display text-2xl font-semibold text-stone-900">
              {t.common.instructions} <span className="text-base text-red-600">*</span>
            </legend>
            <ol className="clear-both space-y-3">
              {text.instructions.map((step, index) => (
                <li key={step.key} className="flex items-start gap-3">
                  <span
                    className="mt-2.5 grid size-7 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-bold text-white"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <textarea
                    id={`step-${step.key}`}
                    lang={editing}
                    value={step.text}
                    rows={2}
                    maxLength={5000}
                    aria-label={t.common.step(index + 1)}
                    aria-invalid={instructionsError && index === 0 ? true : undefined}
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
                      disabled={index === text.instructions.length - 1}
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
            <FieldError id="instructions-error" message={instructionsError} />
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
                lang={editing}
                value={text.notes}
                onChange={e => updateText('notes', e.target.value)}
                rows={3}
                maxLength={5000}
                className={`${inputClass} resize-y`}
                placeholder={t.form.notesPlaceholder}
              />
            </div>

            {isOriginal && (
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
            )}
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
