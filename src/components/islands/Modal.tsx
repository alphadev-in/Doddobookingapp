// Accessible, portal-based modal. Rendered into document.body so no parent overflow/transform can clip it.
// Layout: fixed scroll wrapper -> centred flex column -> panel (header / scrollable body / footer).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Close when the dark backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
  /** Max width preset. Default 'lg'. */
  size?: 'md' | 'lg' | 'xl';
}

const SIZE = { md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-xl' } as const;

export default function Modal({ open, onClose, title, subtitle, children, footer, closeOnBackdrop = true, size = 'lg' }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  // Keep the latest onClose in a ref so re-renders of the parent never re-run this effect
  // (re-running it stole focus from inputs on every keystroke).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Escape to close, lock body scroll, move focus into the dialog on open and restore it on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain" role="presentation">
      {/* Backdrop */}
      <div aria-hidden="true" className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined} />
      {/* Scroll container: centred on larger screens, bottom sheet on phones */}
      <div className="flex min-h-full items-end justify-center p-3 sm:items-center sm:p-6" onClick={(e) => { if (e.target === e.currentTarget && closeOnBackdrop) onClose(); }}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className={`relative flex max-h-[90dvh] w-full ${SIZE[size]} flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl outline-none sm:rounded-2xl`}
        >
          {/* Fixed header */}
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close"
              className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <span aria-hidden="true">×</span>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            {children}
          </div>

          {/* Fixed footer */}
          {footer && (
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
