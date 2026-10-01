// components/layout/ErrorBoundary.tsx - pagar galat tingkat isi layar.
// Satu layar yang gagal dirender tidak boleh mematikan seluruh aplikasi: kerangka (rel, bilah bawah,
// tombol Tambah) tetap hidup, isi diganti pesan yang menyebut sebab dan tindakan berikutnya (R-27).
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '../ui.tsx';

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // P0 tidak punya layanan pelapor galat; jejak di konsol sudah cukup untuk menelusuri.
    console.error('Layar gagal dirender', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="pt-5">
        <ErrorState
          message="Layar ini gagal dimuat. Data keuangan Anda tidak berubah: catatan tetap ada di server, hanya tampilannya yang berhenti."
          onRetry={() => window.location.reload()}
        >
          <p className="text-xs break-words text-muted">{error.message}</p>
        </ErrorState>
      </div>
    );
  }
}
