// parts/MonthFlow.tsx : arus kas bulan berjalan (PRD FR04): tiga angka ringkasan, lalu dua baris yang
// dibuka ke transaksi nyatanya. Baris rincian hanya memanggil jaringan saat dibuka.
import { useState } from 'react';
import {
  Button, Card, CardHead, DisclosureRow, LedgerRow, Money, MoneyStat, RowTitle,
} from '../../../components/ui.tsx';
import { api, type Transaction } from '../../../lib/api.ts';
import { useAsync } from '../../../lib/hooks.ts';
import { formatDateShort, formatPeriod, TYPE_LABEL } from '../../../lib/format.ts';
import { SectionLink } from './SectionLink.tsx';
import { flowDirection } from './direction.ts';

type FlowSide = 'income' | 'expense';

interface MonthFlowProps {
  period: { start: string; end: string; label: string };
  income: string;
  expense: string;
  net: string;
}

export function MonthFlow({ period, income, expense, net }: MonthFlowProps) {
  const [open, setOpen] = useState<FlowSide | null>(null);

  return (
    <Card className="px-4 py-4 lg:px-5">
      <CardHead title="Arus bulan ini" subtitle={formatPeriod(period.label)} />
      {/* Di ponsel dua angka berdampingan dan selisihnya satu baris penuh: tiga kolom sempit membuat
          nominal panjang melampaui kotaknya, karena angka uang tidak boleh terpotong maupun dibungkus. */}
      <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 sm:gap-x-4">
        <MoneyStat label="Masuk" value={income} direction="in" size="md" />
        <MoneyStat label="Keluar" value={expense} direction="out" size="md" />
        <div className="col-span-2 sm:col-span-1">
          <MoneyStat label="Selisih" value={net} direction={flowDirection(net)} size="md" />
        </div>
      </div>
      <div className="mt-2 border-t border-hairline">
        <DisclosureRow
          label="Transaksi masuk"
          value={income}
          direction="in"
          meta="Lima transaksi terakhir"
          open={open === 'income'}
          onToggle={() => setOpen(open === 'income' ? null : 'income')}
        >
          {open === 'income' ? <FlowRows side="income" period={period} /> : null}
        </DisclosureRow>
        <DisclosureRow
          label="Transaksi keluar"
          value={expense}
          direction="out"
          meta="Lima transaksi terakhir"
          open={open === 'expense'}
          onToggle={() => setOpen(open === 'expense' ? null : 'expense')}
        >
          {open === 'expense' ? <FlowRows side="expense" period={period} /> : null}
        </DisclosureRow>
      </div>
    </Card>
  );
}

/**
 * Lima transaksi terakhir pada satu sisi arus. Komponen ini hanya dipasang saat barisnya dibuka,
 * sehingga permintaan jaringan tidak pernah terjadi untuk baris yang masih tertutup.
 */
function FlowRows({ side, period }: { side: FlowSide; period: { start: string; end: string; label: string } }) {
  const state = useAsync(
    () => api.transactions({ from: period.start, to: period.end, type: side, pageSize: 5 }),
    [side, period.start, period.end],
  );
  const items = state.data?.items ?? [];
  const allHref = `/transaksi?type=${side}&from=${period.start}&to=${period.end}`;

  return (
    <div className="pt-1">
      {state.loading && !state.data ? (
        <p className="py-2 text-xs text-muted">Memuat lima transaksi terakhir.</p>
      ) : null}

      {state.error && !state.data ? (
        <div className="flex flex-wrap items-center gap-3 py-2">
          <p className="min-w-0 flex-1 text-xs text-muted">Daftar transaksi gagal dimuat.</p>
          <Button variant="secondary" size="sm" onClick={state.reload}>
            Coba lagi
          </Button>
        </div>
      ) : null}

      {state.data && items.length === 0 ? (
        <p className="py-2 text-xs text-muted">
          {side === 'income' ? 'Tidak ada transaksi masuk' : 'Tidak ada transaksi keluar'} pada {formatPeriod(period.label)}.
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="flex flex-col">
          {items.map((tx) => (
            <FlowTxLine key={tx.id} tx={tx} side={side} />
          ))}
        </ul>
      ) : null}

      <div className="pt-1">
        <SectionLink to={allHref}>Lihat semua</SectionLink>
      </div>
    </div>
  );
}

/** Satu baris rincian: tanggal kecil, nama kategori atau catatan, nominal bertanda arah. */
function FlowTxLine({ tx, side }: { tx: Transaction; side: FlowSide }) {
  return (
    <LedgerRow
      as="li"
      trailing={<Money value={tx.amount} size="sm" direction={side === 'income' ? 'in' : 'out'} />}
    >
      <RowTitle
        title={tx.category?.name ?? tx.note ?? TYPE_LABEL[side]}
        meta={[formatDateShort(tx.effectiveDate), tx.category && tx.note ? tx.note : null].filter(Boolean).join(' · ')}
      />
    </LedgerRow>
  );
}
