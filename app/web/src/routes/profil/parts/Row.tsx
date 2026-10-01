// routes/profil/parts/Row.tsx : bentuk baris yang dipakai bersama kelima bagian Profil.
// Kelima bagian memakai jarak, perataan label, dan lebar tombol yang sama supaya halaman ini
// terbaca sebagai satu daftar pengaturan, bukan lima tata letak yang berbeda.
import type { ReactNode } from 'react';

/** Baris fakta yang tidak bisa diubah: label di kiri, nilainya di kanan. */
export function InfoRow({ label, value, meta }: { label: string; value: ReactNode; meta?: string }) {
  return (
    <div className="row-divide flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="shrink-0 text-sm text-muted">{label}</span>
      <span className="flex min-w-0 flex-col gap-0.5 sm:items-end">
        <span className="break-words text-sm text-fg sm:text-right">{value}</span>
        {meta ? <span className="max-w-prose text-xs text-muted sm:text-right">{meta}</span> : null}
      </span>
    </div>
  );
}

/**
 * Baris tindakan: penjelasan di kiri, tombol di kanan. Di layar sempit tombol turun ke bawah
 * penjelasan supaya target sentuh 44px tidak berdesakan di satu baris.
 */
export function ActionRow({ title, hint, action }: { title: string; hint: string; action: ReactNode }) {
  return (
    <div className="row-divide flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="mt-0.5 max-w-prose text-xs text-muted">{hint}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">{action}</div>
    </div>
  );
}

/**
 * SectionEmpty: keadaan kosong di dalam kartu bagian. Primitive EmptyState membawa kartunya
 * sendiri, dan kartu di dalam kartu dilarang, jadi keadaan ini disusun dari baris kartu yang sudah
 * ada. Isinya tetap sebab plus satu tindakan (DESIGN.md "Components").
 */
export function SectionEmpty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-4">
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="max-w-prose text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}
