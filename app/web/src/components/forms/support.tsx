// components/forms/support.tsx : scaffolding every form in this folder shares:
// server error text, field-level issues, a keyboard-safe radio group, review rows, a switch row.
import { useId, type ReactNode } from 'react';
import { ApiError } from '../../lib/api.ts';

export type FormIssues = Record<string, string>;

/** Message ready to display. The screen adds the next action where it matters. */
export function errorMessage(caught: unknown): string {
  if (caught instanceof ApiError) return caught.message;
  return 'Data tidak terkirim. Periksa koneksi lalu coba lagi.';
}

/** Field errors the server returned, merged into the form's own validation state. */
export function issuesFrom(caught: unknown): FormIssues {
  if (caught instanceof ApiError) return { ...caught.fields };
  return {};
}

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Native radio group: arrow keys move within the group, Tab leaves it (R-32). */
export function RadioGroup<T extends string>({
  legend, value, options, onChange, disabled = false,
}: {
  legend: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1.5 text-xs font-semibold text-muted">{legend}</legend>
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-control px-3 py-2.5 transition-colors duration-150 ${
              selected ? 'bg-accent-soft' : 'hover:bg-fg/4'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option.value)}
              className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-fg">{option.label}</span>
              {option.hint ? <span className="text-xs text-muted">{option.hint}</span> : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Totals shown before a save, so the user reviews the arithmetic instead of trusting it. */
export function ReviewList({ rows, note }: { rows: { label: string; value: ReactNode; strong?: boolean }[]; note?: string }) {
  return (
    <div className="rounded-control bg-sunken px-4 py-1">
      {rows.map((row) => (
        <div key={row.label} className="row-divide flex items-baseline justify-between gap-3 py-2.5">
          <span className="text-sm text-muted">{row.label}</span>
          <span className={`num text-sm ${row.strong ? 'font-semibold text-fg' : 'text-fg'}`}>{row.value}</span>
        </div>
      ))}
      {note ? <p className="py-2.5 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

/** Switch for on/off preferences. Track is small, the hit area is 44px tall (R-03). */
export function SwitchRow({
  label, hint, checked, onChange, disabled = false,
}: { label: string; hint?: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <div className="row-divide flex items-start justify-between gap-4 py-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-fg">{label}</span>
        {hint ? <span className="text-xs text-muted">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="press flex min-h-[44px] w-14 shrink-0 items-center justify-center rounded-control disabled:opacity-55"
      >
        <span className={`relative h-6 w-11 rounded-chip transition-colors duration-150 ${checked ? 'bg-accent' : 'bg-hairline'}`}>
          <span
            aria-hidden="true"
            className={`absolute top-0.5 size-5 rounded-chip bg-white shadow-[0_1px_2px_rgb(16_24_40/0.2)] transition-transform duration-150 ${checked ? 'left-[22px]' : 'left-0.5'}`}
          />
        </span>
      </button>
    </div>
  );
}

/** A short label for the device the user is on right now, read from the browser. */
export function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Perangkat tidak dikenal';
  return navigator.userAgent;
}
