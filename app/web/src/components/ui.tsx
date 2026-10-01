// components/ui.tsx: primitif antarmuka. Semua layar memakai ini supaya arah DESIGN.md konsisten.
// Aturan: target sentuh >= 44px, fokus terlihat, tanpa em dash di teks, angka uang memakai
// kolom tanda (DESIGN.md "Kolom tanda") sehingga arah uang tidak pernah ditandai warna saja (NFR06).
import {
  cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { formatIDR, formatAmountInput, moneySign, parseAmountInput, toMinor } from '../lib/format.ts';
import { IconAlert, IconArrowDownRight, IconArrowUpRight, IconCheck, IconChevronDown, IconClose, IconSearch } from './icons.tsx';

// ── visibilitas nominal (PRD §03: pengguna dapat menyembunyikan nominal) ─────
const VisibilityContext = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => {} });

export function MoneyVisibilityProvider({ hidden, onToggle, children }: { hidden: boolean; onToggle: () => void; children: ReactNode }) {
  const value = useMemo(() => ({ hidden, toggle: onToggle }), [hidden, onToggle]);
  return (
    <VisibilityContext.Provider value={value}>
      {children}
      {/* One polite announcement for the whole app, so hiding every figure is never a silent change. */}
      <span className="sr-only" aria-live="polite">
        {hidden ? 'Nominal disembunyikan' : 'Nominal ditampilkan'}
      </span>
    </VisibilityContext.Provider>
  );
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

// ── kartu (DESIGN.md "Components"): unit susunan setiap layar ──────────────────────────
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

/** IconTile: kotak lembut di kiri baris daftar, memberi jangkar yang bisa dipindai (DESIGN.md "Components"). */
export function IconTile({ tone = 'neutral', children, size = 'md' }: { tone?: 'neutral' | 'in' | 'out' | 'warn' | 'accent' | 'accent-2'; children: ReactNode; size?: 'sm' | 'md' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-sunken text-muted',
    in: 'bg-in/12 text-in',
    out: 'bg-out/12 text-out',
    warn: 'bg-warn/14 text-warn',
    accent: 'bg-accent-soft text-accent',
    'accent-2': 'bg-accent-2/20 text-warn',
  };
  const sizes = { sm: 'size-8', md: 'size-10' };
  return <span className={`icon-tile ${sizes[size]} ${tones[tone]}`} aria-hidden="true">{children}</span>;
}

// ── tombol ──────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_BASE =
  'press inline-flex items-center justify-center gap-2 font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent-solid text-accent-fg hover:brightness-110 rounded-chip',
  secondary: 'border border-hairline bg-raised text-fg hover:border-fg/20 hover:bg-sunken rounded-control',
  ghost: 'text-fg hover:bg-fg/6 rounded-control',
  danger: 'border border-out/40 bg-raised text-out hover:bg-out/8 rounded-control',
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
      className={`press inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-fg/6 hover:text-fg disabled:opacity-50 ${className}`}
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
  // The hint or the error is wired to the control so a screen reader reads it again on focus,
  // not only once when it appears (NFR06).
  const describedById = `${useId()}-description`;
  const child = isValidElement(children) ? (children as ReactElement<{ 'aria-describedby'?: string }>) : null;
  const control = child
    ? cloneElement(child, {
        'aria-describedby': [child.props['aria-describedby'], describedById].filter(Boolean).join(' '),
      })
    : children;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
        {label}
        {required ? <span className="ml-1 text-out" aria-hidden="true">*</span> : null}
      </label>
      {control}
      {error ? (
        <p id={describedById} className="flex items-start gap-2 text-xs text-out" role="alert">
          <IconAlert size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={describedById} className="text-xs text-muted">{hint}</p>
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

// ── angka uang: kolom tanda (DESIGN.md "Kolom tanda") ──────────────────────────────────
const MONEY_SIZE = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  hero: 'text-3xl',
} as const;
/**
 * SignMark: isi kolom tanda (DESIGN.md "Kolom tanda"). Nilai netral tidak memakai glif apa pun: titik tengah `·`
 * terbaca sebagai minus, dan bentuk apa pun yang lebih tebal darinya (bulatan kecil sekalipun) masih
 * terbaca sebagai garis pendek pada pembacaan cepat. Kolomnya tetap ada dan lebarnya dikunci CSS
 * (`.sign-col` = 1ch), jadi angka tetap lurus tanpa perlu penanda yang bisa disalahbaca.
 */
export function SignMark({ value, direction }: { value: string | number; direction: 'in' | 'out' | 'zero' }) {
  const glyph = moneySign(value, direction);
  return glyph ? <>{glyph}</> : null;
}

/**
 * Money: satu-satunya cara menampilkan nominal.
 * Tanda arah selalu menempati kolom tanda pada angka yang tersusun vertikal, termasuk saat netral,
 * sehingga seluruh angka di seluruh layar lurus dalam satu kolom dan arah uang terbaca tanpa
 * membaca satu digit pun. Angka fokus tunggal sebuah layar memakai `sign={false}`: ia tidak
 * dibandingkan dengan angka lain, jadi kolom tandanya hanya menambah satu karakter kosong
 * (DESIGN.md "Kolom tanda").
 */
export function Money({
  value, direction = 'zero', size = 'md', className = '', forceVisible = false, sign = true,
}: { value: string | number; direction?: 'in' | 'out' | 'zero'; size?: keyof typeof MONEY_SIZE; className?: string; forceVisible?: boolean; sign?: boolean }) {
  const { hidden } = useMoneyVisibility();
  const minor = toMinor(value);
  // Nominal nol tidak punya arah: tanpa ini baris "Pembanding" menampilkan "+Rp0" dan pembaca
  // layar mengucapkan "plus nol" untuk nilai yang tidak bergerak.
  const dir = minor === 0 ? 'zero' : direction;
  const sizeClass = MONEY_SIZE[size];
  const tone = dir === 'in' ? 'text-in' : dir === 'out' ? 'text-out' : 'text-fg';
  const weight = size === 'xl' || size === '2xl' || size === 'hero' ? 'font-medium' : 'font-normal';

  if (hidden && !forceVisible) {
    return (
      <span className={`figure ${sizeClass} ${weight} ${tone} ${className}`}>
        {sign ? <span className="sign-col" aria-hidden="true"><span className="sign-dot" role="presentation" /></span> : null}
        <span aria-hidden="true">••••••</span>
        <span className="sr-only">Nominal disembunyikan</span>
      </span>
    );
  }

  return (
    <span className={`figure ${sizeClass} ${weight} ${tone} ${className}`} data-money={minor}>
      {sign ? <span className="sign-col" aria-hidden="true"><SignMark value={minor} direction={dir} /></span> : null}
      {/* Kolom tanda tidak dibaca pembaca layar; arahnya diucapkan sebagai kata yang sama dengan
          glifnya, bukan sebagai "pemasukan"/"pengeluaran", supaya angka yang bukan arus kas
          (sisa anggaran, total teralokasi) tidak salah disebut pendapatan. */}
      {dir === 'out' ? <span className="sr-only">minus </span> : null}
      {dir === 'in' ? <span className="sr-only">plus </span> : null}
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
    'accent-2': 'bg-accent-2/20 text-warn',
  };
  return (
    <span className={`inline-flex items-center rounded-chip px-2 py-0.5 text-2xs font-semibold whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** DeltaPill: lencana arah perubahan dengan panah, gaya fintech (DESIGN.md "Components"). */
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

/**
 * ProgressBar: trek sunken dengan isian semantik. Persentase duduk di luar isian karena teks putih
 * di atas aksen gelap gagal AA dan angka di dalam isian sempit jadi tebakan.
 */
export function ProgressBar({ ratio, tone = 'accent', label, showPercent = false }: { ratio: number; tone?: 'accent' | 'in' | 'out' | 'warn' | 'accent-2'; label: string; showPercent?: boolean }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const colors: Record<string, string> = { accent: 'bg-accent', in: 'bg-in', out: 'bg-out', warn: 'bg-warn', 'accent-2': 'bg-accent-2' };
  const percent = Math.round(clamped * 100);
  const bar = (
    <div
      className="relative h-3 w-full overflow-hidden rounded-chip bg-sunken"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${percent} persen`}
      aria-label={label}
    >
      <div className={`h-full ${colors[tone]} transition-colors duration-150`} style={{ width: `${clamped * 100}%` }} />
    </div>
  );
  if (!showPercent) return bar;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">{bar}</div>
      <span className="figure w-10 shrink-0 text-2xs text-muted">{percent}%</span>
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
    // Backdrop bertabIndex -1 supaya ia tidak pernah jadi tujuan fokus pertama; fokus awal harus
    // jatuh pada kontrol nyata di dalam lembar (tombol Tutup di kepala), bukan pada latar gelap.
    const focusable = () =>
      Array.from(node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]') ?? []).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.offsetParent !== null,
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
/** Tabs: pil tersegmentasi di dalam kartu (DESIGN.md "Components"). */
export function Tabs<T extends string>({
  tabs, active, onChange, label, variant = 'pill', idBase,
}: { tabs: { id: T; label: string; count?: number }[]; active: T; onChange: (id: T) => void; label: string; variant?: 'pill' | 'underline'; idBase?: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (variant === 'pill') {
    return (
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto rounded-chip bg-sunken p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                refs.current[tab.id] = node;
              }}
              id={idBase ? `${idBase}-tab-${tab.id}` : undefined}
              aria-controls={idBase && selected ? `${idBase}-panel-${tab.id}` : undefined}
              role="tab"
              type="button"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={`press flex min-h-[44px] shrink-0 items-center justify-center rounded-chip px-3 text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
                selected ? 'bg-raised text-fg shadow-card' : 'text-muted hover:text-fg'
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
            id={idBase ? `${idBase}-tab-${tab.id}` : undefined}
            aria-controls={idBase && selected ? `${idBase}-panel-${tab.id}` : undefined}
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

/**
 * TabPanel: the region a tab owns. Screens render one for the active tab only, so an inactive tab
 * never mounts its data loader. Tabs hands out the matching ids.
 */
export function TabPanel({ idBase, id, children, className = '' }: { idBase: string; id: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${id}`} aria-labelledby={`${idBase}-tab-${id}`} tabIndex={0} className={`focus-visible:outline-2 focus-visible:outline-accent ${className}`}>
      {children}
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

/** Avatar: lingkaran inisial, pengganti foto yang belum ada (DESIGN.md "Components"). */
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

// ── komposisi yang dipakai berulang di layar ringkasan ──────────────────────

/**
 * MoneyStat: satu angka ringkasan dengan labelnya. Primitif, bukan susunan per layar, supaya kolom
 * angka di Beranda, Rencana, dan Laporan punya jarak dan ukuran yang sama persis.
 */
export function MoneyStat({
  label, value, direction = 'zero', size = 'lg', note, align = 'start',
}: { label: string; value: string | number; direction?: 'in' | 'out' | 'zero'; size?: keyof typeof MONEY_SIZE; note?: string; align?: 'start' | 'end' }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <span className="text-2xs font-medium text-muted">{label}</span>
      <Money value={value} direction={direction} size={size} className={align === 'start' ? 'text-left' : ''} />
      {note ? <span className="text-2xs text-muted">{note}</span> : null}
    </div>
  );
}

/**
 * DisclosureRow: satu angka ringkasan yang membuka baris penyusunnya di tempat (PRD FR04).
 * Tombol nyata dengan aria-expanded dan aria-controls; isinya tidak dimuat sampai dibuka.
 */
export function DisclosureRow({
  label, value, direction = 'zero', meta, open, onToggle, children,
}: { label: string; value: string | number; direction?: 'in' | 'out' | 'zero'; meta?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const id = useId();
  return (
    <div className="row-divide">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className="press flex min-h-[60px] w-full items-center gap-3 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{label}</span>
          {meta ? <span className="mt-0.5 block truncate text-xs text-muted">{meta}</span> : null}
        </span>
        <Money value={value} direction={direction} />
        <span aria-hidden="true" className={`shrink-0 text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
          <IconChevronDown size={18} />
        </span>
      </button>
      <div id={id} hidden={!open} className="pb-3">
        {children}
      </div>
    </div>
  );
}

/** Chip: kendali pilihan yang bisa ditekan (saringan, jenis, tanggal cepat). Bukan tab: tanpa panel. */
export function Chip({ selected = false, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`press inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-chip border px-3 text-sm font-medium transition-colors duration-150 ${
        selected ? 'border-accent bg-accent-soft text-accent' : 'border-hairline bg-raised text-fg hover:bg-sunken'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** SearchField: isian pencarian dengan ikon dan tombol bersihkan; dipin di puncak daftar. */
export function SearchField({
  value, onValueChange, label, placeholder = 'Cari', className = '',
}: { value: string; onValueChange: (next: string) => void; label: string; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
        <IconSearch size={18} />
      </span>
      <input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        enterKeyHint="search"
        onChange={(event) => onValueChange(event.target.value)}
        className={`${INPUT_BASE} border-hairline pl-10 [&::-webkit-search-cancel-button]:hidden ${value ? 'pr-12' : ''}`}
      />
      {value ? (
        <button
          type="button"
          aria-label="Hapus pencarian"
          onClick={() => onValueChange('')}
          className="press absolute right-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-fg/6 hover:text-fg"
        >
          <IconClose size={16} />
        </button>
      ) : null}
    </div>
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
