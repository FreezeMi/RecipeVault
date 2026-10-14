import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CheckCircleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';

type ToastTone = 'success' | 'error';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const show = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++;
      // Keep at most three on screen.
      setToasts(current => [...current.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ success: message => show('success', message), error: message => show('error', message) }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map(toast => (
            <m.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-stone-200 bg-white/95 py-3 pl-4 pr-2 text-sm font-medium text-stone-800 shadow-xl shadow-stone-900/10"
            >
              {toast.tone === 'success' ? (
                <CheckCircleIcon size={20} weight="fill" className="shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <WarningCircleIcon size={20} weight="fill" className="shrink-0 text-red-600" aria-hidden="true" />
              )}
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-full p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                aria-label="Dismiss notification"
              >
                <XIcon size={16} weight="bold" aria-hidden="true" />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
