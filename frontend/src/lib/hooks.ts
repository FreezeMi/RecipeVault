import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, toErrorMessage } from '../services/api';
import type { Recipe } from '../types';

const APP_NAME = 'Recipe Vault';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}

type RecipeState =
  | { status: 'loading'; recipe: null; error: null }
  | { status: 'ready'; recipe: Recipe; error: null }
  | { status: 'error'; recipe: null; error: string; notFound: boolean };

/** Loads one recipe, cancelling stale requests when the id changes. */
export function useRecipe(id: number) {
  const [state, setState] = useState<RecipeState>({ status: 'loading', recipe: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', recipe: null, error: null });
    api
      .getRecipe(id, controller.signal)
      .then(recipe => setState({ status: 'ready', recipe, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
        setState({
          status: 'error',
          recipe: null,
          error: notFound ? 'This recipe could not be found.' : toErrorMessage(error, 'Failed to load recipe.'),
          notFound,
        });
      });
    return () => controller.abort();
  }, [id, attempt]);

  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const setRecipe = useCallback((recipe: Recipe) => setState({ status: 'ready', recipe, error: null }), []);

  return { ...state, reload, setRecipe };
}
