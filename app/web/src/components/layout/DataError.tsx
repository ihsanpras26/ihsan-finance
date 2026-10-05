// components/layout/DataError.tsx - keadaan galat yang dipakai semua layar berdata.
// Sesi berakhir (401) tidak menampilkan tombol coba lagi: pengguna diarahkan masuk ulang,
// dan draf yang belum terkirim tetap ada di perangkat (PRD FR22).
import { useEffect, type ReactNode } from 'react';
import { ErrorState } from '../ui.tsx';
import { ApiError } from '../../lib/api.ts';
import { useSession } from '../../lib/session.tsx';

export function DataError({ error, onRetry, children, label }: { error: ApiError; onRetry?: () => void; children?: ReactNode; label?: string }) {
  const { refresh } = useSession();
  const expired = error.status === 401;

  useEffect(() => {
    if (expired) void refresh();
  }, [expired, refresh]);

  if (expired) {
    return (
      <ErrorState message="Sesi berakhir. Masuk lagi untuk melihat data ini. Draf yang belum terkirim tetap tersimpan di perangkat ini." />
    );
  }

  return (
    <ErrorState message={label ? `${label} ${error.display}` : error.display} onRetry={onRetry}>
      {children}
    </ErrorState>
  );
}
