import { useEffect, useRef } from 'react';
import { t } from '../lib/strings';

interface Props {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel, danger }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="overlay" role="presentation" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={message} onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="row">
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
          <button className="btn btn-ghost" ref={cancelRef} onClick={onCancel}>{t.no}</button>
        </div>
      </div>
    </div>
  );
}
