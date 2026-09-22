// components/forms/fields.tsx - kendali isian yang dipakai form di modul ini.
// Select bawaan ui.tsx memakai appearance-none tanpa penanda, jadi caret digambar di sini
// supaya pengguna tahu bahwa isian itu daftar pilihan, bukan teks bebas (R-26).
import type { ChangeEvent, ReactNode, SelectHTMLAttributes } from 'react';
import { Select } from '../ui.tsx';
import { IconChevronDown } from '../icons.tsx';

export function SelectControl({
  id, value, onChange, invalid = false, disabled = false, children, 'aria-label': ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  invalid?: boolean;
  disabled?: boolean;
  children: ReactNode;
} & Pick<SelectHTMLAttributes<HTMLSelectElement>, 'aria-label'>) {
  return (
    <div className="relative">
      <Select id={id} value={value} onChange={onChange} invalid={invalid} disabled={disabled} aria-label={ariaLabel}>
        {children}
      </Select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">
        <IconChevronDown size={18} />
      </span>
    </div>
  );
}
