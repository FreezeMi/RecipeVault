import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CookingPotIcon, PlusIcon, SignInIcon, SignOutIcon, UserCircleIcon } from '@phosphor-icons/react';
import RecipeList from './components/RecipeList';
import RecipeDetail from './components/RecipeDetail';
import Login from './components/Login';
import { useAuth } from './components/AuthContext';
import { useToast } from './components/Toast';
import { PageLoader, buttonStyles } from './components/ui';
import { Link, navigate, parseRoute, paths, useLocation, type Route } from './lib/router';
import { useDocumentTitle } from './lib/hooks';

// Admin-only screens are split into their own chunks; visitors never download them.
const RecipeForm = lazy(() => import('./components/RecipeForm'));
const Account = lazy(() => import('./components/Account'));

const PROTECTED_ROUTES = new Set<Route['name']>(['new', 'edit', 'account']);

const navLinkClass = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
    active ? 'bg-stone-900/5 text-stone-900' : 'text-stone-600 hover:bg-stone-900/5 hover:text-stone-900'
  }`;

function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="font-display text-6xl font-semibold text-stone-300">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold text-stone-900">This page isn't on the menu</h1>
      <p className="mt-2 text-stone-600">The page you're looking for doesn't exist or has been moved.</p>
      <Link to={paths.list()} className={`${buttonStyles.primary} mt-8`}>
        Back to recipes
      </Link>
    </div>
  );
}

function App() {
  const { pathname } = useLocation();
  const route = parseRoute(pathname);
  const { authenticated, loading, logout } = useAuth();
  const toast = useToast();

  const isProtected = PROTECTED_ROUTES.has(route.name);

  // Route guards run once the initial session check has finished.
  useEffect(() => {
    if (loading) return;
    if (isProtected && !authenticated) {
      navigate(`${paths.login()}?next=${encodeURIComponent(pathname)}`, { replace: true });
    }
  }, [loading, isProtected, authenticated, pathname]);

  const handleLogout = async () => {
    navigate(paths.list());
    await logout();
    toast.success('You have been signed out.');
  };

  let page: ReactNode;
  if (isProtected && (loading || !authenticated)) {
    page = <PageLoader label="Checking your session…" />;
  } else {
    switch (route.name) {
      case 'list':
        page = <RecipeList />;
        break;
      case 'detail':
        page = <RecipeDetail id={route.id} />;
        break;
      case 'new':
        page = <RecipeForm />;
        break;
      case 'edit':
        page = <RecipeForm id={route.id} />;
        break;
      case 'login':
        page = <Login />;
        break;
      case 'account':
        page = <Account />;
        break;
      default:
        page = <NotFound />;
    }
  }

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-stone-50 font-sans text-stone-900">
      <a
        href="#main"
        className="sr-only z-[70] rounded-full bg-stone-900 px-4 py-2 font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      {/* Soft ambient color — desktop only, blur is expensive on phones. */}
      <div className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden md:block" aria-hidden="true">
        <div className="absolute -left-[10%] -top-[10%] size-[520px] rounded-full bg-brand-500/10 blur-[110px]" />
        <div className="absolute -bottom-[10%] -right-[10%] size-[620px] rounded-full bg-accent-500/[0.08] blur-[120px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-white/95 md:glass md:border-x-0 md:border-t-0 md:border-b-stone-200/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:h-[72px] md:px-8">
          <Link to={paths.list()} className="group flex items-center gap-3 rounded-2xl">
            <span className="grid size-10 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25 transition-transform duration-300 group-hover:-rotate-6">
              <CookingPotIcon size={22} weight="duotone" aria-hidden="true" />
            </span>
            <span className="whitespace-nowrap font-display text-xl font-semibold tracking-tight text-stone-900 md:text-2xl">Recipe Vault</span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            {authenticated ? (
              <>
                {/* Wrapper controls visibility: the button's own inline-flex would override `hidden`. */}
                <span className="hidden sm:block">
                  <Link
                    to={paths.new()}
                    className={`${buttonStyles.primary} px-4! py-2! text-sm`}
                    aria-current={route.name === 'new' ? 'page' : undefined}
                  >
                    <PlusIcon size={16} weight="bold" aria-hidden="true" />
                    New recipe
                  </Link>
                </span>
                <Link
                  to={paths.account()}
                  className={navLinkClass(route.name === 'account')}
                  aria-current={route.name === 'account' ? 'page' : undefined}
                >
                  <UserCircleIcon size={20} aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Account</span>
                </Link>
                <button type="button" onClick={handleLogout} className={navLinkClass(false)}>
                  <SignOutIcon size={20} aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Sign out</span>
                </button>
              </>
            ) : (
              <Link
                to={paths.login()}
                className={navLinkClass(route.name === 'login')}
                aria-current={route.name === 'login' ? 'page' : undefined}
              >
                <SignInIcon size={20} aria-hidden="true" />
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 outline-none md:px-8 md:pt-12">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <Suspense fallback={<PageLoader label="Loading…" />}>{page}</Suspense>
          </m.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
