import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Kind = 'info' | 'success' | 'error';
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: Kind } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((msg: string, kind: Kind = 'info') => {
    setToast({ msg, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-zone" aria-live="polite" role="status">
        {toast && <div className={`toast toast-${toast.kind}`} onClick={() => setToast(null)}>{toast.msg}</div>}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
