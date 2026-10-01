// components/icons.tsx: glyphs drawn for this product's own content (DESIGN.md "Components", R-04).
// 20x20 grid, 1.75 stroke, currentColor. No icon library: every glyph names a real object here.
// Stroke weight is set to match Schibsted Grotesk at UI sizes; a thinner stroke goes grey next to
// the heavier grotesk and reads as a different, lighter system (DESIGN.md "Typography").
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Buku kas terbuka: garis kolom dan punggung buku. */
export const IconLedger = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 4.2c2.4-.9 4.6-.9 7 0v11.6c-2.4-.9-4.6-.9-7 0V4.2Z" />
    <path d="M17 4.2c-2.4-.9-4.6-.9-7 0v11.6c2.4-.9 4.6-.9 7 0V4.2Z" />
    <path d="M6 7.4h1.8M6 10h1.8M12.2 7.4H14M12.2 10H14" />
  </Base>
);

/** Uang masuk: panah turun ke garis dasar. */
export const IconIn = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 3v10" />
    <path d="M6.2 9.4 10 13.2l3.8-3.8" />
    <path d="M4 16.5h12" />
  </Base>
);

/** Uang keluar: panah naik dari garis dasar. */
export const IconOut = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 17V7" />
    <path d="M6.2 10.6 10 6.8l3.8 3.8" />
    <path d="M4 3.5h12" />
  </Base>
);

/** Dompet. */
export const IconWallet = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 6.5c0-1 .8-1.8 1.8-1.8h8.4c1 0 1.8.8 1.8 1.8" />
    <rect x="3" y="6.5" width="14" height="9.3" rx="1.8" />
    <path d="M13.2 11.1h1.6" />
  </Base>
);

/** Utang: kewajiban, panah keluar dari buku. */
export const IconDebt = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.2" y="3.2" width="13.6" height="13.6" rx="2" />
    <path d="M7 13 13 7" />
    <path d="M13 11V7h-4" />
  </Base>
);

/** Piutang: hak tagih, panah masuk ke buku. */
export const IconReceivable = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.2" y="3.2" width="13.6" height="13.6" rx="2" />
    <path d="M13 7 7 13" />
    <path d="M7 9v4h4" />
  </Base>
);

/** Tujuan: cincin dengan inti. */
export const IconGoal = (p: IconProps) => (
  <Base {...p}>
    <circle cx="10" cy="10" r="6.4" />
    <circle cx="10" cy="10" r="2.2" />
  </Base>
);

/** Anggaran: penggaris batas. */
export const IconBudget = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.2 6.4h13.6" />
    <path d="M3.2 13.6h13.6" />
    <path d="M7 6.4v7.2M13 6.4v7.2" />
  </Base>
);

/** Berulang: dua panah melingkar. */
export const IconRepeat = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.4 8.6a5.6 5.6 0 0 1 9.5-3.2" />
    <path d="M14.4 3.2v3.4h-3.4" />
    <path d="M15.6 11.4a5.6 5.6 0 0 1-9.5 3.2" />
    <path d="M5.6 16.8v-3.4h3.4" />
  </Base>
);

/** Transfer: dua panah berlawanan arah, uang pindah dompet tanpa masuk atau keluar. */
export const IconTransfer = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.4 6.8h11.2" />
    <path d="M11.9 4.6 14.2 6.8l-2.3 2.2" />
    <path d="M16.6 13.2H5.4" />
    <path d="M8.1 11 5.8 13.2l2.3 2.2" />
  </Base>
);

/** Laporan: batang kolom. */
export const IconReport = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.4 16.4h13.2" />
    <path d="M6 16.4V9.6M10 16.4V5.2M14 16.4v-4.6" />
  </Base>
);

/** Profil. */
export const IconUser = (p: IconProps) => (
  <Base {...p}>
    <circle cx="10" cy="7.2" r="3.2" />
    <path d="M4.2 16.6c.7-2.9 3-4.4 5.8-4.4s5.1 1.5 5.8 4.4" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 4.4v11.2M4.4 10h11.2" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8.8" cy="8.8" r="4.8" />
    <path d="M12.4 12.4 16.4 16.4" />
  </Base>
);

export const IconFilter = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.4 5.4h13.2L11.4 11v4.6l-2.8-1.6V11L3.4 5.4Z" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.4 10.6 8 14.2l7.6-8.4" />
  </Base>
);

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 3.4 17.2 16.6H2.8L10 3.4Z" />
    <path d="M10 8.2v3.4M10 13.8v.1" />
  </Base>
);

export const IconClock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="10" cy="10" r="6.8" />
    <path d="M10 6.4V10l2.6 1.6" />
  </Base>
);

export const IconCalendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.4" y="5" width="13.2" height="11.6" rx="1.8" />
    <path d="M3.4 8.6h13.2M7 3.6v2.8M13 3.6v2.8" />
  </Base>
);

export const IconChevronLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5.4 7.4 10 12 14.6" />
  </Base>
);

export const IconChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="M5.4 8 10 12.6 14.6 8" />
  </Base>
);

export const IconSun = (p: IconProps) => (
  <Base {...p}>
    <circle cx="10" cy="10" r="3.4" />
    <path d="M10 2.6v1.6M10 15.8v1.6M2.6 10h1.6M15.8 10h1.6M5.1 5.1l1.1 1.1M13.8 13.8l1.1 1.1M14.9 5.1l-1.1 1.1M6.2 13.8l-1.1 1.1" />
  </Base>
);

export const IconMoon = (p: IconProps) => (
  <Base {...p}>
    <path d="M15.6 12.4A6.4 6.4 0 0 1 7.6 4.4a6.6 6.6 0 1 0 8 8Z" />
  </Base>
);

export const IconCloudOff = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.6 13.4A3.4 3.4 0 0 1 5.8 7a4.6 4.6 0 0 1 8.6 1.2 3 3 0 0 1 .6 5.2" />
    <path d="M4 4l12 12" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M10 3.4v9.2" />
    <path d="M6.6 9.4 10 12.8l3.4-3.4" />
    <path d="M4 16.4h12" />
  </Base>
);

/** Panah naik ke kanan: arah perubahan positif pada lencana (DESIGN.md "Components"). */
export const IconArrowUpRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 14 14 6" />
    <path d="M7.6 6H14v6.4" />
  </Base>
);

/** Panah turun ke kanan: arah perubahan negatif pada lencana (DESIGN.md "Components"). */
export const IconArrowDownRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l8 8" />
    <path d="M14 7.6V14H7.6" />
  </Base>
);

/** Lonceng: pemberitahuan pengingat. */
export const IconBell = (p: IconProps) => (
  <Base {...p}>
    <path d="M5.6 8.4a4.4 4.4 0 0 1 8.8 0c0 3 .9 4.4 1.4 5.1H4.2c.5-.7 1.4-2.1 1.4-5.1Z" />
    <path d="M8.4 16a1.8 1.8 0 0 0 3.2 0" />
  </Base>
);

/** Mata: kendali tampilkan atau sembunyikan nominal. */
export const IconEye = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.4 10S5.4 5.2 10 5.2 17.6 10 17.6 10 14.6 14.8 10 14.8 2.4 10 2.4 10Z" />
    <circle cx="10" cy="10" r="2.2" />
  </Base>
);

/** Mata dicoret: nominal sedang disembunyikan. */
export const IconEyeOff = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.4 10s2.6-4.2 6.6-4.2c1 0 1.9.2 2.7.6" />
    <path d="M16.2 11.4c.8-1 1.4-1.4 1.4-1.4s-3-4.8-7.6-4.8" />
    <path d="M4.4 5 15.6 15" />
    <path d="M8.2 8.4a2.2 2.2 0 0 0 3 3" />
    <path d="M13.4 11.8A9.6 9.6 0 0 1 10 14.8c-1.4 0-2.7-.4-3.8-1" />
  </Base>
);

/** Tabungan: celengan dengan celah koin. */
export const IconSavings = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.6 11.6a5.6 5.6 0 0 1 5.6-5.6h1.6a5.6 5.6 0 0 1 5.6 5.6v2a1.4 1.4 0 0 1-1.4 1.4h-1v1.4H8.6V16.4h-1A1.4 1.4 0 0 1 6.2 15h-1a1.4 1.4 0 0 1-1.4-1.4v-2Z" />
    <path d="M8.6 6v-.6a1.4 1.4 0 0 1 1.4-1.4h.6" />
    <path d="M13.6 10.6h.1" />
  </Base>
);

