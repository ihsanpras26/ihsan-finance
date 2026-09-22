// components/ui.tsx: primitif antarmuka. Semua layar memakai ini supaya arah DESIGN.md konsisten.
// Aturan: target sentuh >= 44px, fokus terlihat, tanpa em dash di teks, angka uang memakai
// kolom tanda (DESIGN.md §5) sehingga arah uang tidak pernah ditandai warna saja (NFR06).
import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { formatIDR, formatAmountInput, parseAmountInput, signGlyph, toMinor } from '../lib/format.ts';
import { IconAlert, IconArrowDownRight, IconArrowUpRight, IconCheck, IconClose } from './icons.tsx';

// ── visibilitas nominal (PRD §03: pengguna dapat menyembunyikan nominal) ─────
const VisibilityContext = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => {} });

export function MoneyVisibilityProvider({ hidden, onToggle, children }: { hidden: boolean; onToggle: () => void; children: ReactNode }) {
  const value = useMemo(() => ({ hidden, toggle: onToggle }), [hidden, onToggle]);
  return <VisibilityContext.Provider value={value}>{children}</VisibilityContext.Provider>;
}

export function useMoneyVisibility() {
  return useContext(VisibilityContext);
}

// ── toast ───────────────────────────────────────────────────────────────────
type ToastTone = 'info' | 'success' | 'error';
interface ToastItem { id: number; tone: ToastTone; message: string; action?: { label: string; run: () => void } }
const ToastContext = createContext<{ push: (tone: ToastTone, message: string, action?: ToastItem['action']) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((tone: ToastTone, message: string, action?: ToastItem['action']) => {
    counter.current += 1;
    const id = counter.current;
    setItems((prev) => [...prev, { id, tone, message, action }]);
    window.setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), tone === 'error' ? 7000 : 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6" role="status" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className="sheet-enter pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-panel bg-raised px-4 py-3 text-sm"
          >
            <span className={item.tone === 'error' ? 'mt-0.5 text-out' : item.tone === 'success' ? 'mt-0.5 text-in' : 'mt-0.5 text-muted'}>
              {item.tone === 'error' ? <IconAlert size={18} /> : <IconCheck size={18} />}
            </span>
            <span className="flex-1 text-fg">{item.message}</span>
            {item.action ? (
              <button
                type="button"
                className="press inline-flex min-h-[44px] shrink-0 items-center rounded-control px-2 text-sm font-semibold text-accent underline-offset-2 transition-colors duration-150 hover:bg-accent-soft"
                onClick={() => {
                  item.action?.run();
                  setItems((prev) => prev.filter((entry) => entry.id !== item.id));
                }}
              >
                {item.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// ── kartu (DESIGN.md §6): unit susunan setiap layar ──────────────────────────
export function Card({ className = '', children, as = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'li' | 'article' }) {
  const Tag = as;
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

/**
 * CardHead: judul kartu 20px semibold dengan aksi di kanan, dan subjudul opsional.
 * Hierarki datang dari ukuran huruf dan jarak, bukan dari garis.
 */
export function CardHead({ title, subtitle, action, className = '' }: { title: string; subtitle?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  );
}

/** IconTile: kotak lembut di kiri baris daftar, memberi jangkar yang bisa dipindai (DESIGN.md §6). */
export function IconTile({ tone = 'neutral', children, size = 'md' }: { tone?: 'neutral' | 'in' | 'out' | 'warn' | 'accent' | 'accent-2'; children: ReactNode; size?: 'sm' | 'md' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-sunken text-muted',
    in: 'bg-in/12 text-in',
    out: 'bg-out/12 text-out',
    warn: 'bg-warn/14 text-warn',
    accent: 'bg-accent-soft text-accent',
    'accent-2': 'bg-accent-2/18 text-accent-2',
  };
  const sizes = { sm: 'size-8', md: 'size-10' };
  return <span className={`icon-tile ${sizes[size]} ${tones[tone]}`} aria-hidden="true">{children}</span>;
}

// ── tombol ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_BASE =
  'press inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg shadow-[0_1px_2px_rgb(16_24_40/0.12)] hover:brightness-110',
  secondary: 'border border-hairline bg-raised text-fg hover:border-fg/20 hover:bg-sunken',
  ghost: 'text-fg hover:bg-fg/6',
  danger: 'border border-out/40 bg-raised text-out hover:bg-out/8',
};

// Every size keeps a >= 44px hit area; `sm` differs in padding and type size only.
// Shrinking the hit area is never the way to make a control look secondary (target sentuh 44px).
const BUTTON_SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'min-h-[44px] px-3 py-1.5 text-sm',
  md: 'min-h-[44px] px-4 py-2.5 text-sm',
  lg: 'min-h-[52px] px-5 py-3 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  block?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading = false, block = false, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function IconButton({ label, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`press inline-flex size-11 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-fg/6 hover:text-fg disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── isian ───────────────────────────────────────────────────────────────────
export function Field({
  label, hint, error, htmlFor, children, required = false,
}: { label: string; hint?: string; error?: string; htmlFor?: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
        {label}
        {required ? <span className="ml-1 text-out" aria-hidden="true">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-start gap-2 text-xs text-out" role="alert">
          <IconAlert size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const INPUT_BASE =
  'w-full rounded-control border bg-raised px-3 py-2.5 text-base text-fg transition-colors duration-150 placeholder:text-muted/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent';

export function TextInput({ className = '', invalid = false, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={`${INPUT_BASE} ${invalid ? 'border-out' : 'border-hairline'} ${className}`} aria-invalid={invalid || undefined} {...rest} />;
}

export function Textarea({ className = '', invalid = false, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={`${INPUT_BASE} ${invalid ? 'border-out' : 'border-hairline'} min-h-[88px] resize-y ${className}`} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({ className = '', invalid = false, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={`${INPUT_BASE} ${invalid ? 'border-out' : 'border-hairline'} appearance-none bg-[length:14px] pr-9 ${className}`} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
}

/**
 * AmountInput: papan angka di perangkat sentuh, pemisah ribuan otomatis.
 * Nilai yang diketik tidak pernah berubah arti: "25.000" selalu 25000 (PRD §03).
 * Angkanya memakai rupa angka uang supaya terasa seperti instrumen, bukan kotak teks biasa.
 */
export function AmountInput({
  value, onValueChange, autoFocus = false, invalid = false, id, label = 'Nominal', ...rest
}: {
  value: number;
  onValueChange: (minor: number) => void;
  autoFocus?: boolean;
  invalid?: boolean;
  id?: string;
  label?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'id'>) {
  const [text, setText] = useState(() => formatAmountInput(value));
  const ref = useRef<HTMLInputElement>(null);
  const lastValue = useRef(value);

  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setText(formatAmountInput(value));
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <div className="relative">
      <span className="figure pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted">Rp</span>
      <input
        ref={ref}
        id={id}
        aria-label={label}
        className={`figure w-full rounded-control border bg-raised py-3 pl-12 pr-3 text-2xl text-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-accent ${invalid ? 'border-out' : 'border-hairline'}`}
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(event) => {
          const minor = parseAmountInput(event.target.value);
          setText(formatAmountInput(minor));
          lastValue.current = minor;
          onValueChange(minor);
        }}
        {...rest}
      />
    </div>
  );
}

// ── angka uang: kolom tanda (DESIGN.md §5) ──────────────────────────────────
const MONEY_SIZE = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  hero: 'text-3xl',
} as const;

/**
 * Money: satu-satunya cara menampilkan nominal.
 * Tanda arah selalu menempati kolom tanda, termasuk saat netral, sehingga seluruh angka di
 * seluruh layar lurus dalam satu kolom dan arah uang terbaca tanpa membaca satu digit pun.
 */
export function Money({
  value, direction = 'zero', size = 'md', className = '', forceVisible = false,
}: { value: string | number; direction?: 'in' | 'out' | 'zero'; size?: keyof typeof MONEY_SIZE; className?: string; forceVisible?: boolean }) {
  const { hidden } = useMoneyVisibility();
  const minor = toMinor(value);
  const sizeClass = MONEY_SIZE[size];
  const tone = direction === 'in' ? 'text-in' : direction === 'out' ? 'text-out' : 'text-fg';
  const weight = size === 'xl' || size === '2xl' || size === 'hero' ? 'font-medium' : 'font-normal';

  if (hidden && !forceVisible) {
    return (
      <span className={`figure ${sizeClass} ${weight} ${tone} ${className}`} aria-label="Nominal disembunyikan">
        <span className="sign-col" aria-hidden="true">·</span>••••••
      </span>
    );
  }

  return (
    <span className={`figure ${sizeClass} ${weight} ${tone} ${className}`} data-money={minor}>
      <span className="sign-col" aria-hidden="true">{signGlyph(minor, direction)}</span>
      {formatIDR(Math.abs(minor))}
    </span>
  );
}

// ── struktur ────────────────────────────────────────────────────────────────
/** SectionHead: judul bagian di atas kartu, gaya label kecil, dengan aksi di kanan. */
export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-center justify-between gap-3 px-0.5">
      <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {action}
    </div>
  );
}

export function LedgerRow({
  onClick, children, className = '', as = 'div', leading, trailing,
}: { onClick?: () => void; children: ReactNode; className?: string; as?: 'div' | 'li'; leading?: ReactNode; trailing?: ReactNode }) {
  const Tag = as;
  const body = (
    <>
      {leading}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </>
  );
  if (!onClick) {
    return <Tag className={`row-divide flex min-h-[60px] items-center gap-3 py-3 ${className}`}>{body}</Tag>;
  }
  return (
    <Tag className={`row-divide ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[60px] w-full items-center gap-3 py-3 text-left transition-colors duration-150 hover:bg-fg/4 active:bg-fg/6"
      >
        {body}
      </button>
    </Tag>
  );
}

/** RowTitle: dua baris teks baris daftar (nama dan meta), dipakai hampir semua daftar. */
export function RowTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-fg">{title}</p>
      {meta ? <p className="truncate text-xs text-muted">{meta}</p> : null}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: 'neutral' | 'in' | 'out' | 'warn' | 'accent' | 'accent-2'; children: ReactNode }) {
  const tones: Record<string, string> = {
    neutral: 'bg-sunken text-muted',
    in: 'bg-in/12 text-in',
    out: 'bg-out/12 text-out',
    warn: 'bg-warn/14 text-warn',
    accent: 'bg-accent-soft text-accent',
    'accent-2': 'bg-accent-2/18 text-warn',
  };
  return (
    <span className={`inline-flex items-center rounded-chip px-2 py-0.5 text-2xs font-semibold whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** DeltaPill: lencana arah perubahan dengan panah, gaya fintech (DESIGN.md §10). */
export function DeltaPill({ value, tone, label }: { value: string; tone: 'in' | 'out' | 'neutral'; label?: string }) {
  const tones: Record<string, string> = {
    in: 'bg-in/12 text-in',
    out: 'bg-out/12 text-out',
    neutral: 'bg-sunken text-muted',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-2xs font-semibold whitespace-nowrap ${tones[tone]}`}>
      {tone === 'in' ? <IconArrowUpRight size={13} /> : tone === 'out' ? <IconArrowDownRight size={13} /> : null}
      {value}
      {label ? <span className="font-normal opacity-80">{label}</span> : null}
    </span>
  );
}

export function ProgressBar({ ratio, tone = 'accent', label, showPercent = false }: { ratio: number; tone?: 'accent' | 'in' | 'out' | 'warn' | 'accent-2'; label: string; showPercent?: boolean }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const colors: Record<string, string> = { accent: 'bg-accent', in: 'bg-in', out: 'bg-out', warn: 'bg-warn', 'accent-2': 'bg-accent-2' };
  const percent = Math.round(clamped * 100);
  // The label rides inside the fill only when the fill is wide enough to hold it. Below that it
  // sits on the track, where white text would be invisible against the pale track (R-32 contrast).
  const insideFill = clamped >= 0.22;
  return (
    <div className="relative h-6 w-full overflow-hidden rounded-chip bg-sunken" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full ${colors[tone]} transition-[width] duration-240 ease-out`} style={{ width: `${clamped * 100}%` }} />
      {showPercent ? (
        <span
          className={`figure absolute inset-y-0 flex items-center text-2xs font-semibold ${insideFill ? 'left-2 text-white' : 'right-2 text-muted'}`}
          aria-hidden="true"
        >
          {percent}%
        </span>
      ) : null}
    </div>
  );
}

// ── keadaan wajib (R-27) ────────────────────────────────────────────────────
export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-3 px-5 py-6">
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      <p className="max-w-prose text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}

export function LoadingRows({ rows = 4, label = 'Memuat data' }: { rows?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="flex flex-col gap-3">
      <div className="card flex flex-col gap-3 px-4 py-4">
        <div className="h-3 w-24 animate-pulse rounded-chip bg-sunken" />
        <div className="h-8 w-40 animate-pulse rounded-chip bg-sunken" />
        <div className="h-3 w-32 animate-pulse rounded-chip bg-sunken" />
      </div>
      <div className="card flex flex-col px-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="row-divide flex min-h-[56px] items-center gap-3 py-2.5">
            <div className="size-10 shrink-0 animate-pulse rounded-control bg-sunken" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3 w-32 animate-pulse rounded-chip bg-sunken" />
              <div className="h-3 w-20 animate-pulse rounded-chip bg-sunken" />
            </div>
            <div className="h-4 w-24 animate-pulse rounded-chip bg-sunken" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry, children }: { message: string; onRetry?: () => void; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-3 px-5 py-5" role="alert">
      <div className="flex items-start gap-2">
        <IconAlert size={18} className="mt-0.5 shrink-0 text-out" />
        <p className="text-sm text-fg">{message}</p>
      </div>
      {children}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

// ── lembar / dialog ─────────────────────────────────────────────────────────
/**
 * Sheet: lembar bawah di HP, dialog di desktop. Escape menutup, fokus kembali ke pemicu (R-32).
 * Isian di dalam tidak pernah dihapus saat gagal simpan (PRD §09).
 */
export function Sheet({
  open, onClose, title, children, footer, size = 'md',
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = () =>
      Array.from(node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      );

    window.setTimeout(() => {
      const list = focusable();
      (list[0] ?? node)?.focus();
    }, 30);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusable();
      if (list.length === 0) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label="Tutup" className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`sheet-enter relative flex max-h-[92dvh] w-full flex-col overscroll-contain rounded-t-sheet bg-raised sm:rounded-sheet ${size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        {/* Grab handle: the affordance that tells a thumb this panel can be dismissed (mobile-first). */}
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-chip bg-fg/15 sm:hidden" />
        <header className="flex items-center justify-between gap-3 px-5 pt-3 pb-3 sm:pt-4">
          <h2 id={titleId} className="text-lg font-semibold text-fg">
            {title}
          </h2>
          <IconButton label="Tutup" onClick={onClose}>
            <IconClose />
          </IconButton>
        </header>
        {/* Keyboard-safe: 100% here keeps the scrolling body from being squeezed when a phone
            keyboard opens, which is the common cause of unreachable fields. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer ? <footer className="border-t border-hairline px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open, title, body, confirmLabel, tone = 'primary', onConfirm, onCancel, busy = false,
}: { open: boolean; title: string; body: string; confirmLabel: string; tone?: 'primary' | 'danger'; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button variant={tone} onClick={onConfirm} loading={busy} block>
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} block>
            Batal
          </Button>
        </div>
      }
    >
      <p className="text-sm text-fg">{body}</p>
    </Sheet>
  );
}

// ── tab ─────────────────────────────────────────────────────────────────────
/** Tabs: pil tersegmentasi di dalam kartu (DESIGN.md §6). */
export function Tabs<T extends string>({
  tabs, active, onChange, label, variant = 'pill',
}: { tabs: { id: T; label: string; count?: number }[]; active: T; onChange: (id: T) => void; label: string; variant?: 'pill' | 'underline' }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto rounded-control bg-sunken p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                refs.current[tab.id] = node;
              }}
              role="tab"
              type="button"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={`press flex min-h-[44px] shrink-0 items-center justify-center rounded-[9px] px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
                selected ? 'bg-raised text-fg shadow-[0_1px_2px_rgb(16_24_40/0.08)]' : 'text-muted hover:text-fg'
              }`}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => {
                const index = tabs.findIndex((entry) => entry.id === tab.id);
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
                  if (next) {
                    onChange(next.id);
                    refs.current[next.id]?.focus();
                  }
                }
              }}
            >
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 ? <span className="tnum ml-1.5 text-2xs font-medium text-muted">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-hairline">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`press relative flex min-h-[44px] shrink-0 items-center rounded-t-control px-3.5 py-2 text-sm font-semibold transition-colors duration-150 ${selected ? 'text-accent' : 'text-muted hover:bg-fg/4 hover:text-fg'}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              const index = tabs.findIndex((entry) => entry.id === tab.id);
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
                if (next) {
                  onChange(next.id);
                  refs.current[next.id]?.focus();
                }
              }
            }}
          >
            {tab.label}
            {typeof tab.count === 'number' && tab.count > 0 ? <span className="tnum ml-1.5 text-2xs font-medium text-muted">{tab.count}</span> : null}
            {selected ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}

// ── header halaman ──────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 pt-5 pb-1 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  );
}

/** Avatar: lingkaran inisial, pengganti foto yang belum ada (DESIGN.md §12). */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const sizes = { sm: 'size-8 text-2xs', md: 'size-10 text-xs', lg: 'size-12 text-sm' };
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-chip bg-accent-soft font-semibold text-accent ${sizes[size]}`} aria-hidden="true">
      {initials || '?'}
    </span>
  );
}

export function OfflineBadge({ savedAt }: { savedAt: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-chip bg-warn/14 px-2 py-0.5 text-2xs font-semibold text-warn">
      Draf di perangkat ini
      <span className="tnum font-normal">
        {new Date(savedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </span>
  );
}
