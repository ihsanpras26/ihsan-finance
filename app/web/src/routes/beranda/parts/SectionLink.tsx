// parts/SectionLink.tsx : tautan kepala kartu ke layar lain.
// min-h 44px supaya tautan ini tetap nyaman ditekan di layar sentuh (R-03).
import { Link } from 'react-router-dom';

export function SectionLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="inline-flex min-h-[44px] items-center rounded-chip px-1 text-sm font-semibold text-accent hover:underline">
      {children}
    </Link>
  );
}
