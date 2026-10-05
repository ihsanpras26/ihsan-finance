// parts/SaldoPanel.tsx : panel saldo, titik fokus Beranda (DESIGN.md "Layout").
// Total saldo adalah angka terbesar di layar; baris dompet penyusunnya dibuka di tempat tanpa permintaan baru (FR04).
import { useState } from 'react';
import {
  Card, DisclosureRow, IconButton, IconTile, LedgerRow, Money, RowTitle, useMoneyVisibility,
} from '../../../components/ui.tsx';
import { IconEye, IconEyeOff, IconLedger, IconSavings, IconWallet } from '../../../components/icons.tsx';
import type { DashboardData } from '../../../lib/api.ts';
import { formatDateLong, formatPeriod, WALLET_TYPE_LABEL } from '../../../lib/format.ts';
import { balanceDirection } from './direction.ts';

/** Ikon mengikuti jenis dompet, bukan mereknya, supaya baris bisa dipindai tanpa membaca nama. */
function WalletGlyph({ type }: { type: string }) {
  if (type === 'cash') return <IconSavings size={19} />;
  if (type === 'bank') return <IconLedger size={19} />;
  return <IconWallet size={19} />;
}

export function SaldoPanel({ dashboard, timezone }: { dashboard: DashboardData; timezone?: string }) {
  const { hidden, toggle } = useMoneyVisibility();
  const [open, setOpen] = useState(false);
  const wallets = dashboard.wallets;

  return (
    <Card as="div" className="px-4 py-4 lg:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">Total saldo dompet</p>
          <p className="mt-1">
            <Money value={dashboard.totalBalance} direction={balanceDirection(dashboard.totalBalance)} size="2xl" sign={false} />
          </p>
          <p className="mt-1 text-xs text-muted">
            Periode {formatPeriod(dashboard.period.label)}, dihitung sampai {formatDateLong(dashboard.asOf)}
            {timezone ? ` (zona waktu ${timezone})` : ''}.
          </p>
        </div>
        <IconButton
          label={hidden ? 'Menampilkan nominal' : 'Menyembunyikan nominal'}
          onClick={toggle}
        >
          {hidden ? <IconEye /> : <IconEyeOff />}
        </IconButton>
      </div>

      {/* Angka ringkasan yang membuka baris dompet penyusunnya; kolom nominalnya sama dengan total di atas. */}
      <div className="mt-3">
        <DisclosureRow
          label="Dompet penyusun saldo"
          value={dashboard.totalBalance}
          direction={balanceDirection(dashboard.totalBalance)}
          meta={wallets.length === 1 ? '1 dompet' : `${wallets.length} dompet`}
          open={open}
          onToggle={() => setOpen(!open)}
        >
          {wallets.length === 0 ? (
            <p className="px-1 text-xs text-muted">Belum ada dompet. Dompet dan saldo awalnya dibuat di layar Profil.</p>
          ) : (
            <ul className="flex flex-col">
              {wallets.map((wallet) => (
                <LedgerRow
                  key={wallet.id}
                  as="li"
                  leading={
                    <IconTile size="sm">
                      <WalletGlyph type={wallet.type} />
                    </IconTile>
                  }
                  trailing={<Money value={wallet.balance} direction={balanceDirection(wallet.balance)} />}
                >
                  <RowTitle
                    title={wallet.name}
                    meta={`${WALLET_TYPE_LABEL[wallet.type] ?? wallet.type}${wallet.archived ? ', arsip' : ''}`}
                  />
                </LedgerRow>
              ))}
            </ul>
          )}
        </DisclosureRow>
      </div>

      {/* FR04 · "Dana belum dialokasikan": hanya mengurangi alokasi tujuan aktif, dan label beserta
          penjelasannya harus mencegah angka ini dibaca sebagai rekomendasi belanja. */}
      <div className="mt-3 border-t border-hairline pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-muted">Dana belum dialokasikan</p>
          <Money value={dashboard.unallocated} direction={balanceDirection(dashboard.unallocated)} size="sm" sign={false} />
        </div>
        <p className="mt-1 text-xs text-muted">
          Hanya mengurangi alokasi tujuan aktif. Angka ini bukan rekomendasi belanja dan tidak menjamin cukup untuk
          tagihan mendatang.
        </p>
      </div>
    </Card>
  );
}
