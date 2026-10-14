// A deliberately tiny History-API router: the app has six screens, which doesn't justify a
// routing dependency, but users still need real URLs (refresh, sharing, the Back button).
import { useCallback, useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export type Route =
  | { name: 'list' }
  | { name: 'detail'; id: number }
  | { name: 'edit'; id: number }
  | { name: 'new' }
  | { name: 'login' }
  | { name: 'account' }
  | { name: 'notFound' };

export const paths = {
  list: (search = '') => (search ? `/?${search}` : '/'),
  detail: (id: number) => `/recipes/${id}`,
  edit: (id: number) => `/recipes/${id}/edit`,
  new: () => '/recipes/new',
  login: () => '/login',
  account: () => '/account',
};

export function parseRoute(pathname: string): Route {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (path === '/') return { name: 'list' };
  if (path === '/recipes/new') return { name: 'new' };
  if (path === '/login') return { name: 'login' };
  if (path === '/account') return { name: 'account' };

  const match = /^\/recipes\/(\d{1,10})(\/edit)?$/.exec(path);
  if (match) {
    const id = Number(match[1]);
    if (id > 0) return match[2] ? { name: 'edit', id } : { name: 'detail', id };
  }
  return { name: 'notFound' };
}

const NAVIGATE_EVENT = 'app:navigate';

interface HistoryState {
  scrollY?: number;
}

export function navigate(to: string, { replace = false } = {}) {
  const current = window.location.pathname + window.location.search;
  if (to === current) return;
  if (replace) {
    window.history.replaceState(window.history.state, '', to);
  } else {
    // Remember where the user was so Back can restore the scroll position.
    window.history.replaceState({ ...(window.history.state as HistoryState | null), scrollY: window.scrollY }, '');
    window.history.pushState({}, '', to);
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

const subscribe = (callback: () => void) => {
  window.addEventListener('popstate', callback);
  window.addEventListener(NAVIGATE_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(NAVIGATE_EVENT, callback);
  };
};

const getLocationKey = () => window.location.pathname + window.location.search;

/** Re-renders whenever the URL changes. */
export function useLocation() {
  useSyncExternalStore(subscribe, getLocationKey, getLocationKey);
  return { pathname: window.location.pathname, search: window.location.search };
}

/**
 * Restores the saved scroll position (Back/Forward) or scrolls to the top (new navigation)
 * once a page's content is ready to be shown.
 */
export function useScrollRestoration(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const saved = (window.history.state as HistoryState | null)?.scrollY;
    window.scrollTo({ top: saved ?? 0, behavior: 'instant' });
  }, [ready]);
}

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; replace?: boolean };

/** A real <a href> (so middle-click, copy link, etc. work) that navigates client-side. */
export function Link({ to, replace, onClick, target, ...rest }: LinkProps) {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (target && target !== '_self')
      ) {
        return;
      }
      event.preventDefault();
      navigate(to, { replace });
    },
    [onClick, target, to, replace],
  );

  return <a href={to} target={target} onClick={handleClick} {...rest} />;
}
