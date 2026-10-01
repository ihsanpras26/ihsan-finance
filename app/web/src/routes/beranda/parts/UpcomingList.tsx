// parts/UpcomingList.tsx : utang dan piutang yang jatuh tempo tujuh hari ke depan.
// Keadaan kosongnya berdiri sendiri sebagai kartu, dan menyebut di mana tanggal jatuh tempo diatur.
import { EmptyState, Card, CardHead, IconTile, LedgerRow, Money, RowTitle } from '../../../components/ui.tsx';
import { IconDebt, IconReceivable } from '../../../components/icons.tsx';
import type { DashboardData } from '../../../lib/api.ts';
import { formatDateShort, relativeDay } from '../../../lib/format.ts';
import { SectionLink } from './SectionLink.tsx';

export function UpcomingList({ items }: { items: DashboardData['upcoming'] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Tidak ada yang jatuh tempo dalam 7 hari"
        body="Utang dan piutang yang jatuh tempo tujuh hari ke depan tampil di sini. Tanggal jatuh temponya diatur di layar Rencana."
        action={<SectionLink to="/rencana">Buka Rencana</SectionLink>}
      />
    );
  }

  return (
    <Card className="px-4 py-4 lg:px-5">
      <CardHead title="Jatuh tempo 7 hari" action={<SectionLink to="/rencana">Kelola</SectionLink>} />
      <ul className="mt-1 flex flex-col">
        {items.map((item) => {
          const payable = item.direction === 'payable';
          return (
            <LedgerRow
              key={item.id}
              as="li"
              leading={
                <IconTile size="sm" tone={payable ? 'out' : 'in'}>
                  {payable ? <IconDebt size={17} /> : <IconReceivable size={17} />}
                </IconTile>
              }
              trailing={<Money value={item.amount} direction={payable ? 'out' : 'in'} />}
            >
              <RowTitle
                title={item.counterpartyName}
                meta={`${payable ? 'Utang' : 'Piutang'} · ${formatDateShort(item.dueDate)} · ${relativeDay(item.dueDate)}`}
              />
            </LedgerRow>
          );
        })}
      </ul>
    </Card>
  );
}
