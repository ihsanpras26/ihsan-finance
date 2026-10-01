// parts/NetWorthPanel.tsx : kekayaan bersih dan tiga penyusunnya (PRD FR07).
// Dipisah dari saldo supaya tidak tertukar: saldo itu kas, kekayaan bersih menambah piutang dan mengurangi utang.
import {
  Card, CardHead, IconTile, LedgerRow, Money, MoneyStat, RowTitle,
} from '../../../components/ui.tsx';
import { IconDebt, IconReceivable, IconWallet } from '../../../components/icons.tsx';
import type { DashboardData } from '../../../lib/api.ts';
import { SectionLink } from './SectionLink.tsx';
import { formatDateLong, toMinor } from '../../../lib/format.ts';
import { balanceDirection } from './direction.ts';

export function NetWorthPanel({ dashboard }: { dashboard: DashboardData }) {
  const parts = dashboard.netWorthParts;

  return (
    <Card className="px-4 py-4 lg:px-5">
      <CardHead
        title="Kekayaan bersih"
        subtitle={`Sampai ${formatDateLong(dashboard.asOf)}`}
        action={<SectionLink to="/laporan">Buka Laporan</SectionLink>}
      />
      <div className="mt-3">
        <MoneyStat label="Nilai tercatat" value={dashboard.netWorth} direction={balanceDirection(dashboard.netWorth)} size="xl" />
      </div>
      <ul className="mt-2 flex flex-col">
        <LedgerRow
          as="li"
          leading={
            <IconTile size="sm" tone="neutral">
              <IconWallet size={17} />
            </IconTile>
          }
          trailing={<Money value={parts.cash} direction={balanceDirection(parts.cash)} />}
        >
          <RowTitle title="Kas di dompet" />
        </LedgerRow>
        <LedgerRow
          as="li"
          leading={
            <IconTile size="sm" tone="in">
              <IconReceivable size={17} />
            </IconTile>
          }
          trailing={<Money value={parts.receivable} direction={toMinor(parts.receivable) > 0 ? 'in' : 'zero'} />}
        >
          <RowTitle title="Pokok piutang tersisa" />
        </LedgerRow>
        <LedgerRow
          as="li"
          leading={
            <IconTile size="sm" tone="out">
              <IconDebt size={17} />
            </IconTile>
          }
          trailing={<Money value={parts.payable} direction={toMinor(parts.payable) > 0 ? 'out' : 'zero'} />}
        >
          <RowTitle title="Pokok utang tersisa" />
        </LedgerRow>
      </ul>
      <p className="mt-2 text-xs text-muted">
        Kas di dompet ditambah pokok piutang tersisa, dikurangi pokok utang tersisa. Angka ini hanya mencakup aset dan
        kewajiban yang sudah dicatat di aplikasi.
      </p>
    </Card>
  );
}
