import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Inbox, Loader2, RefreshCw, X } from 'lucide-react';

export const cn = (...a) => a.filter(Boolean).join(' ');

/** Wraps any async action so its button shows a spinner and can't be double-clicked. */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);
  return [busy, run];
}

const VARIANTS = {
  gold: 'bg-gold text-ink font-semibold hover:bg-gold-2 shadow-[0_10px_30px_-10px_rgba(226,184,101,0.6)]',
  outline: 'border border-line text-ivory hover:border-gold/70 hover:text-gold bg-white/[0.02]',
  ghost: 'text-sand hover:bg-white/5 hover:text-ivory',
  danger: 'bg-bad/10 text-bad border border-bad/40 hover:bg-bad/20',
  ok: 'bg-ok/15 text-ok border border-ok/40 hover:bg-ok/25',
};
const SIZES = { sm: 'px-3.5 py-2 text-[13px] gap-1.5', md: 'px-5 py-3 text-sm gap-2', lg: 'px-7 py-4 text-[15px] gap-2.5' };
const BASE = 'inline-flex items-center justify-center rounded-xl font-medium transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

export const buttonClasses = (variant = 'gold', size = 'md', extra = '') => cn(BASE, VARIANTS[variant], SIZES[size], extra);

export function Button({ variant = 'gold', size = 'md', icon: Icon, loading, onClick, children, className, type = 'button', disabled, ...rest }) {
  const [busy, setBusy] = useState(false);
  const isBusy = loading || busy;
  const handle = async (e) => {
    if (!onClick || isBusy) return;
    const r = onClick(e);
    if (r && typeof r.then === 'function') {
      setBusy(true);
      try {
        await r;
      } finally {
        setBusy(false);
      }
    }
  };
  return (
    <motion.button whileTap={{ scale: disabled || isBusy ? 1 : 0.97 }} type={type} disabled={disabled || isBusy} onClick={handle} className={buttonClasses(variant, size, className)} {...rest}>
      {isBusy ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </motion.button>
  );
}

export function LinkButton({ to, href, variant = 'gold', size = 'md', icon: Icon, children, className, ...rest }) {
  const cls = buttonClasses(variant, size, className);
  const inner = (
    <>
      {Icon && <Icon className="size-4" />}
      {children}
    </>
  );
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={to} className={cls} {...rest}>
      {inner}
    </Link>
  );
}

export function Field({ label, hint, error, children, className, required }) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-medium text-sand">
          {label}
          {required && <span className="text-gold"> *</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1.5 block text-[13px] text-bad">{error}</span> : hint ? <span className="mt-1.5 block text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

export const Input = ({ className, invalid, ...p }) => <input className={cn('field-input', className)} aria-invalid={invalid ? 'true' : undefined} {...p} />;
export const Textarea = ({ className, invalid, ...p }) => <textarea className={cn('field-input min-h-24 resize-y', className)} aria-invalid={invalid ? 'true' : undefined} {...p} />;
export const Select = ({ className, children, ...p }) => (
  <select className={cn('field-input', className)} {...p}>
    {children}
  </select>
);

export const Card = ({ className, children, ...p }) => (
  <div className={cn('rounded-2xl border border-line bg-ink-2/80 backdrop-blur', className)} {...p}>
    {children}
  </div>
);

const TONES = {
  gold: 'bg-gold/15 text-gold border-gold/30',
  ok: 'bg-ok/15 text-ok border-ok/30',
  bad: 'bg-bad/15 text-bad border-bad/30',
  warn: 'bg-warn/15 text-warn border-warn/30',
  muted: 'bg-white/5 text-muted border-line',
  clay: 'bg-clay/20 text-[#e9a08a] border-clay/40',
};
export const Badge = ({ tone = 'muted', children, className }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide', TONES[tone], className)}>{children}</span>
);

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn('relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors', checked ? 'border-gold bg-gold' : 'border-line bg-ink-3')}>
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={cn('absolute top-0.5 size-4.5 rounded-full', checked ? 'right-0.5 bg-ink' : 'left-0.5 bg-muted')} />
    </button>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn('relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-ink-2 p-6 shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h3 className="font-display text-2xl text-ivory">{title}</h3>
              <button onClick={onClose} aria-label="Close" className="cursor-pointer rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-ivory">
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Pagination({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export const Skeleton = ({ className }) => <div className={cn('animate-pulse rounded-xl bg-white/5', className)} />;

export function Empty({ title = 'Nothing here yet', children }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="rounded-2xl border border-line bg-ink-3 p-4 text-muted">
        <Inbox className="size-6" />
      </div>
      <p className="font-medium text-sand">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="max-w-md text-sand">{message}</p>
      {onRetry && (
        <Button variant="outline" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export const PageLoader = () => (
  <div className="grid min-h-[50dvh] place-items-center">
    <Loader2 className="size-8 animate-spin text-gold" />
  </div>
);

export function Table({ children, className }) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-line', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
export const Th = ({ children, right, className }) => <th className={cn('whitespace-nowrap border-b border-line bg-ink-3 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted', right && 'text-right', className)}>{children}</th>;
export const Td = ({ children, right, className, ...p }) => (
  <td className={cn('border-b border-line/60 px-4 py-3 align-middle text-sand', right && 'text-right tabular-nums', className)} {...p}>
    {children}
  </td>
);

/** Animated page wrapper: every screen fades and rises in. */
export const Page = ({ children, className }) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: 'easeOut' }} className={className}>
    {children}
  </motion.div>
);

export function Logo({ size = 40 }) {
  const [ok, setOk] = useState(true);
  if (ok) {
    return <img src="/logo.png" alt="NGFW logo" width={size} height={size} onError={() => setOk(false)} className="object-contain" style={{ height: size, width: 'auto', maxWidth: size * 2 }} />;
  }
  return (
    <div style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-xl border border-gold/50 bg-ink-2 font-display text-lg font-bold text-gold">
      N
    </div>
  );
}
