import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { IconAlert, IconCheck, IconChat } from '@/components/icons';
import { cn } from '@/lib/cn';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 3200;

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'text-sys-green',
  error: 'text-sys-red',
  info: 'text-accent',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextId = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    nextId.current += 1;
    setCurrent({ id: nextId.current, message, tone });

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCurrent(null), DURATION_MS);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4"
        role="status"
        aria-live="polite"
      >
        {current ? (
          <div
            key={current.id}
            className={cn(
              'bg-elevated/95 border-line rounded-card shadow-mac-lg pointer-events-auto flex max-w-[min(92vw,460px)] items-center gap-2.5',
              'border px-4 py-3 text-[13.5px] font-medium backdrop-blur-2xl',
              'animate-[toastIn_220ms_var(--ease-spring)]'
            )}
          >
            <span className={cn('shrink-0', TONE_CLASSES[current.tone])}>
              {current.tone === 'success' ? (
                <IconCheck size={16} />
              ) : current.tone === 'error' ? (
                <IconAlert size={16} />
              ) : (
                <IconChat size={16} />
              )}
            </span>
            <span className="text-ink">{current.message}</span>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
