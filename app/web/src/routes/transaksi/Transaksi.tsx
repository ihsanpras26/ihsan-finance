// routes/transaksi/Transaksi.tsx - daftar baris buku besar dengan pencarian, filter, paginasi,
// detail di lembar bawah, pembatalan berdampak, dan koreksi (PRD FR07, ARCHITECTURE §8).
// Susunan v2 (DESIGN.md §6, §7): pencarian dan saringan menyatu dalam satu kartu di atas, lalu
// satu kartu daftar tempat setiap transaksi menjadi LedgerRow dengan kolom tanda yang lurus.
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SelectControl } from '../../components/forms/fields.tsx';
import { useShell } from '../../components/layout/AppShell.tsx';
import { DataError } from '../../components/layout/DataError.tsx';
import {
  IconAlert, IconChevronLeft, IconChevronRight, IconFilter, IconIn, IconLedger, IconOut, IconRepeat,
  IconSearch, IconTransfer,
} from '../../components/icons.tsx';
import {
  AmountInput, Button, Card, ConfirmDialog, EmptyState, Field, IconTile, LedgerRow, LoadingRows, Money,
  PageHeader, RowTitle, Sheet, StatusPill, TextInput, Textarea, useToast,
} from '../../components/ui.tsx';
import { api, ApiError, type Category, type Transaction, type TxType, type Wallet } from '../../lib/api.ts';
import {
  currentPeriod, directionOf, formatDateLong, formatDateShort, formatIDR, formatPeriod, parseAmountInput,
  periodOptions, relativeDay, STATUS_LABEL, toMinor, TYPE_LABEL, WALLET_TYPE_LABEL,
} from '../../lib/format.ts';
import { useAsync, useDebounced } from '../../lib/hooks.ts';

const PAGE_SIZE = 20;

const TYPE_OPTIONS: { id: TxType | 'all'; label: string }[] = [
  { id: 'all', label: 'Semua jenis' },
  { id: 'income', label: 'Pendapatan' },
  { id: 'expense', label: 'Pengeluaran' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'refund', label: 'Pengembalian dana' },
  { id: 'debt_payment', label: 'Pembayaran utang' },
  { id: 'receivable_payment', label: 'Penerimaan piutang' },
  { id: 'adjustment', label: 'Penyesuaian saldo' },
  { id: 'opening', label: 'Saldo awal' },
];

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Dicatat manual',
  import: 'Impor berkas',
  automatic: 'Otomatis',
  system: 'Sistem',
};

/** Koreksi hanya untuk jenis yang bisa dicatat ulang dari form ini (ARCHITECTURE §8). */
const CORRECTABLE: TxType[] = ['income', 'expense', 'transfer'];

/**
 * Nada kotak ikon mengikuti arah uang, bukan warnanya saja: masuk hijau, keluar merah,
 * jenis tanpa arah tetap kotak netral (DESIGN.md §2, NFR06).
 */
function rowTone(type: TxType): 'in' | 'out' | 'neutral' {
  const direction = directionOf(type);
  if (direction === 'in') return 'in';
  if (direction === 'out') return 'out';
  return 'neutral';
}

/** Glyph per jenis: panah masuk/keluar untuk uang, lalu glyph sendiri untuk jenis tanpa arah. */
function RowIcon({ type }: { type: TxType }) {
  if (type === 'transfer') return <IconTransfer size={18} />;
  if (type === 'refund') return <IconIn size={18} />;
  if (type === 'reversal') return <IconRepeat size={18} />;
  const direction = directionOf(type);
  if (direction === 'in') return <IconIn size={18} />;
  if (direction === 'out') return <IconOut size={18} />;
  return <IconLedger size={18} />;
}

/** Nama dompet baris: transfer menyebut kedua kakinya, baris tanpa dompet tetap jujur. */
function rowWallets(tx: Transaction): string {
  const names = tx.wallets.map((leg) => leg.walletName);
  return names.length > 0 ? names.join(', ') : 'Tanpa dompet';
}

/** Judul baris: keterangan yang paling menjelaskan isinya, jatuh ke nama jenis bila kosong. */
function rowTitle(tx: Transaction): string {
  if (tx.note?.trim()) return tx.note.trim();
  if (tx.category?.name) return tx.category.name;
  if (tx.type === 'transfer') {
    const from = tx.wallets.find((leg) => leg.direction === 'out')?.walletName;
    const to = tx.wallets.find((leg) => leg.direction === 'in')?.walletName;
    if (from && to) return `${from} ke ${to}`;
  }
  if (tx.counterparty?.name) return tx.counterparty.name;
  return TYPE_LABEL[tx.type] ?? tx.type;
}

/** Baris meta: tanggal, dompet, jenis, lalu pihak lawan bila ada (DESIGN.md §6: dua baris teks). */
function rowMeta(tx: Transaction): string {
  const parts = [formatDateShort(tx.effectiveDate), rowWallets(tx), TYPE_LABEL[tx.type] ?? tx.type];
  if (tx.counterparty?.name) parts.push(tx.counterparty.name);
  return parts.join(' · ');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TransaksiPage() {
  const { dataVersion, notifyDataChanged, openQuickEntry } = useShell();
  const [searchParams] = useSearchParams();

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const search = useDebounced(q, 300);
  const [period, setPeriod] = useState(() => searchParams.get('period') ?? currentPeriod());
  const [type, setType] = useState<TxType | 'all'>(() => {
    const raw = searchParams.get('type');
    return raw && raw in TYPE_LABEL ? (raw as TxType) : 'all';
  });
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const minValue = useDebounced(parseAmountInput(minText), 400);
  const maxValue = useDebounced(parseAmountInput(maxText), 400);

  const range = useMemo(() => {
    if (period === 'all') return {} as { from?: string; to?: string };
    const [year, month] = period.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year ?? 2026, month ?? 1, 0)).getUTCDate();
    return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` };
  }, [period]);

  const query = useMemo(
    () => ({
      ...range,
      type: type === 'all' ? undefined : type,
      walletId: walletId || undefined,
      categoryId: categoryId || undefined,
      q: search.trim() || undefined,
      min: minValue > 0 ? String(minValue) : undefined,
      max: maxValue > 0 ? String(maxValue) : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [range, type, walletId, categoryId, search, minValue, maxValue, page],
  );

  const list = useAsync(() => api.transactions(query), [query, dataVersion]);
  const options = useAsync(async () => {
    const [wallets, categories] = await Promise.all([api.wallets(), api.categories()]);
    return { wallets, categories };
  }, [dataVersion]);

  // Filter apa pun yang berubah mengembalikan daftar ke halaman pertama.
  useEffect(() => {
    setPage(1);
  }, [search, period, type, walletId, categoryId, minValue, maxValue]);

  const activeFilters = [type !== 'all', Boolean(walletId), Boolean(categoryId), minValue > 0, maxValue > 0].filter(Boolean).length;
  const wallets = options.data?.wallets ?? [];
  const categories = options.data?.categories ?? [];

  function resetFilters() {
    setQ('');
    setType('all');
    setWalletId('');
    setCategoryId('');
    setMinText('');
    setMaxText('');
    setPeriod(currentPeriod());
  }

  const total = list.data?.total ?? 0;
  const shown = list.data?.items.length ?? 0;
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = start === 0 ? 0 : start + shown - 1;

  return (
    <div>
      <PageHeader
        title="Transaksi"
        subtitle={`Riwayat ${period === 'all' ? 'seluruh periode' : formatPeriod(period)}`}
        action={
          <Button onClick={() => openQuickEntry()}>Catat transaksi</Button>
        }
      />

      <div className="mt-3 flex flex-col gap-3">
        {/* Pencarian dan saringan satu kartu: satu tempat untuk mempersempit daftar (DESIGN.md §7). */}
        <Card className="px-4 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">
                <IconSearch size={18} />
              </span>
              <TextInput
                id="tx-search"
                type="search"
                className="pl-10"
                aria-label="Cari transaksi berdasarkan catatan"
                placeholder="Cari catatan transaksi"
                value={q}
                onChange={(event) => setQ(event.target.value)}
              />
            </div>
            <Button variant="secondary" aria-expanded={filtersOpen} aria-controls="tx-filters" onClick={() => setFiltersOpen((value) => !value)}>
              <IconFilter size={18} />
              {activeFilters > 0 ? `Filter (${activeFilters})` : 'Filter'}
            </Button>
          </div>

          {filtersOpen ? (
            <div
              id="tx-filters"
              className="mt-3 grid grid-cols-1 gap-3 border-t border-hairline pt-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <Field label="Periode" htmlFor="tx-period">
                <SelectControl id="tx-period" value={period} onChange={(event) => setPeriod(event.target.value)}>
                  <option value="all">Seluruh periode</option>
                  {periodOptions(18).map((option) => (
                    <option key={option} value={option}>
                      {formatPeriod(option)}
                    </option>
                  ))}
                </SelectControl>
              </Field>
              <Field label="Jenis" htmlFor="tx-type">
                <SelectControl id="tx-type" value={type} onChange={(event) => setType(event.target.value as TxType | 'all')}>
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </SelectControl>
              </Field>
              <Field label="Dompet" htmlFor="tx-wallet">
                <SelectControl id="tx-wallet" value={walletId} onChange={(event) => setWalletId(event.target.value)}>
                  <option value="">Semua dompet</option>
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </option>
                  ))}
                </SelectControl>
              </Field>
              <Field label="Kategori" htmlFor="tx-category">
                <SelectControl id="tx-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">Semua kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {`${category.name} · ${category.kind === 'income' ? 'Pendapatan' : 'Pengeluaran'}`}
                    </option>
                  ))}
                </SelectControl>
              </Field>
              <Field label="Nominal minimum" htmlFor="tx-min" hint="Kosongkan bila tidak dibatasi.">
                <TextInput
                  id="tx-min"
                  inputMode="numeric"
                  placeholder="0"
                  value={minText}
                  onChange={(event) => setMinText(event.target.value)}
                />
              </Field>
              <Field label="Nominal maksimum" htmlFor="tx-max" hint="Kosongkan bila tidak dibatasi.">
                <TextInput
                  id="tx-max"
                  inputMode="numeric"
                  placeholder="0"
                  value={maxText}
                  onChange={(event) => setMaxText(event.target.value)}
                />
              </Field>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button variant="ghost" onClick={resetFilters}>
                  Hapus filter
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        {list.loading && !list.data ? (
          <LoadingRows rows={8} label="Memuat daftar transaksi" />
        ) : list.error && !list.data ? (
          <DataError error={list.error} onRetry={list.reload} />
        ) : list.data && list.data.items.length === 0 ? (
          activeFilters > 0 || search.trim() || period !== currentPeriod() ? (
            <EmptyState
              title="Tidak ada transaksi yang cocok"
              body="Periode, jenis, dompet, kategori, atau nominal yang dipilih belum menemukan baris apa pun. Longgarkan filter lalu cari lagi."
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  Hapus filter
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Belum ada transaksi"
              body="Transaksi pertama bisa dicatat dalam beberapa detik: isi nominal, pilih kategori, lalu simpan."
              action={
                <Button variant="secondary" onClick={() => openQuickEntry()}>
                  Catat transaksi
                </Button>
              }
            />
          )
        ) : (
          <Card className="px-4 py-2">
            <ul className="flex flex-col">
              {list.data?.items.map((tx) => (
                <LedgerRow
                  key={tx.id}
                  as="li"
                  onClick={() => setDetailId(tx.id)}
                  leading={
                    <IconTile tone={rowTone(tx.type)}>
                      <RowIcon type={tx.type} />
                    </IconTile>
                  }
                  trailing={
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Money value={tx.amount} direction={directionOf(tx.type)} size="md" />
                      {tx.status !== 'posted' ? (
                        <StatusPill tone="neutral">{STATUS_LABEL[tx.status] ?? tx.status}</StatusPill>
                      ) : null}
                    </div>
                  }
                >
                  <RowTitle title={rowTitle(tx)} meta={rowMeta(tx)} />
                </LedgerRow>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline py-3">
              <p className="text-xs text-muted">
                {total === 0 ? 'Tidak ada baris' : `Baris ${start} sampai ${end} dari ${total}`}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  <IconChevronLeft size={18} />
                  Sebelumnya
                </Button>
                <Button variant="secondary" disabled={end >= total} onClick={() => setPage((value) => value + 1)}>
                  Berikutnya
                  <IconChevronRight size={18} />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {list.error && list.data ? (
          <Card className="px-4 py-3" as="div">
            <p className="text-xs text-out" role="status">Daftar terakhir gagal diperbarui: {list.error.display}</p>
          </Card>
        ) : null}
      </div>

      {detailId ? (
        <DetailPanel
          key={detailId}
          id={detailId}
          wallets={wallets}
          categories={categories}
          onClose={() => setDetailId(null)}
          onChanged={notifyDataChanged}
          onOpenOther={(nextId) => setDetailId(nextId)}
        />
      ) : null}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row-divide flex flex-wrap items-baseline justify-between gap-3 py-3">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="text-sm text-fg">{children}</dd>
    </div>
  );
}

function DetailPanel({
  id, wallets, categories, onClose, onChanged, onOpenOther,
}: {
  id: string;
  wallets: Wallet[];
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
  onOpenOther: (id: string) => void;
}) {
  const { push } = useToast();
  const detail = useAsync(() => api.transaction(id), [id]);
  const tx = detail.data;

  const [correctMode, setCorrectMode] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState('');
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');

  const impact = useAsync(() => api.transactionImpact(id), [id, cancelOpen], { enabled: cancelOpen });

  useEffect(() => {
    if (!correctMode || !tx) return;
    setAmount(toMinor(tx.amount));
    setDate(tx.effectiveDate);
    setWalletId(tx.wallets.find((leg) => leg.direction === 'out')?.walletId ?? tx.wallets[0]?.walletId ?? '');
    setCategoryId(tx.category?.id ?? '');
    setNote(tx.note ?? '');
    setFormError(null);
    setFieldErrors({});
  }, [correctMode, tx]);

  const correctable = tx ? CORRECTABLE.includes(tx.type) && tx.status !== 'reversed' : false;
  const cancelable = tx ? tx.status === 'posted' || tx.status === 'planned' : false;

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tx || busy) return;
    const errors: Record<string, string> = {};
    if (amount <= 0) errors.amount = 'Nominal harus lebih dari Rp0. Isi nominal lalu simpan lagi.';
    if (!date) errors.effectiveDate = 'Isi tanggal transaksi.';
    if (tx.type !== 'transfer' && !categoryId) errors.categoryId = 'Pilih kategori transaksi.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError('Ada isian yang perlu diperbaiki sebelum disimpan.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      await api.correctTransaction(tx.id, {
        amount: String(amount),
        effectiveDate: date,
        walletId: walletId || undefined,
        categoryId: tx.type === 'transfer' ? undefined : categoryId || undefined,
        note: note.trim(),
        expectedVersion: tx.version,
      });
      push('success', 'Koreksi tersimpan. Transaksi lama dibalik dan versi barunya dicatat.');
      onChanged();
      onClose();
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      if (error?.code === 'version_conflict') {
        setFormError('Data ini sudah berubah di perangkat lain. Muat ulang detail lalu ulangi perubahan.');
      } else if (error) {
        setFieldErrors(error.fields);
        setFormError(error.display);
      } else {
        setFormError('Koreksi gagal disimpan. Periksa isian lalu simpan lagi.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    if (!tx) return;
    setCancelBusy(true);
    try {
      await api.reverseTransaction(tx.id, {});
      push('success', 'Transaksi dibatalkan. Saldo dompet sudah diperbarui.');
      setCancelOpen(false);
      onChanged();
      onClose();
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      push('error', error ? error.display : 'Transaksi gagal dibatalkan. Coba lagi.');
    } finally {
      setCancelBusy(false);
    }
  }

  // Ringkasan dampak wajib dibaca sebelum pembatalan (PRD FR07). Tanpa laporan, tombol batal tidak mengirim apa pun.
  let dialogTitle = 'Memeriksa dampak pembatalan';
  let dialogBody = 'Menghitung perubahan saldo dompet yang akan terjadi.';
  let dialogConfirmLabel = 'Tutup';
  let dialogTone: 'primary' | 'danger' = 'primary';
  let dialogConfirm = () => setCancelOpen(false);

  if (impact.data) {
    if (impact.data.canCancel) {
      dialogTitle = 'Batalkan transaksi?';
      dialogBody = impact.data.summary;
      dialogConfirmLabel = 'Batalkan transaksi';
      dialogTone = 'danger';
      dialogConfirm = () => void confirmCancel();
    } else {
      dialogTitle = 'Transaksi ini belum bisa dibatalkan';
      dialogBody = [impact.data.summary, ...impact.data.blockedBy].join(' ');
      dialogConfirmLabel = 'Mengerti';
      dialogConfirm = () => setCancelOpen(false);
    }
  } else if (impact.error) {
    dialogTitle = 'Dampak pembatalan tidak dapat diperiksa';
    dialogBody = `${impact.error.display} Periksa koneksi, lalu tekan Batalkan transaksi lagi.`;
    dialogConfirmLabel = 'Tutup';
    dialogConfirm = () => setCancelOpen(false);
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="Detail transaksi"
        size="lg"
        footer={
          correctMode ? (
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button type="submit" form="form-koreksi" loading={busy} block>
                Simpan koreksi
              </Button>
              <Button variant="ghost" onClick={() => setCorrectMode(false)} block>
                Batal
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {correctable ? (
                <Button variant="secondary" block onClick={() => setCorrectMode(true)}>
                  Koreksi transaksi
                </Button>
              ) : null}
              {cancelable ? (
                <Button variant="danger" block onClick={() => setCancelOpen(true)}>
                  Batalkan transaksi
                </Button>
              ) : null}
              {tx && !correctable && !cancelable ? (
                <p className="text-xs text-muted">
                  Transaksi jenis ini dibuat proses lain, jadi hanya bisa dibaca di sini. Batalkan dari layar asalnya bila perlu.
                </p>
              ) : null}
            </div>
          )
        }
      >
        {detail.loading && !tx ? (
          <LoadingRows rows={5} label="Memuat detail transaksi" />
        ) : detail.error && !tx ? (
          <DataError error={detail.error} onRetry={detail.reload} />
        ) : tx ? (
          <div className="flex flex-col gap-5">
            <dl className="flex flex-col">
              <DetailRow label="Jenis">{TYPE_LABEL[tx.type] ?? tx.type}</DetailRow>
              <DetailRow label="Status">{STATUS_LABEL[tx.status] ?? tx.status}</DetailRow>
              <DetailRow label="Nominal">
                <Money value={tx.amount} direction={directionOf(tx.type)} size="lg" />
              </DetailRow>
              <DetailRow label="Tanggal">
                {formatDateLong(tx.effectiveDate)} ({relativeDay(tx.effectiveDate)})
              </DetailRow>
              {tx.category ? <DetailRow label="Kategori">{tx.category.name}</DetailRow> : null}
              {tx.counterparty ? <DetailRow label="Pihak">{tx.counterparty.name}</DetailRow> : null}
              <DetailRow label="Catatan">{tx.note ?? 'Tanpa catatan'}</DetailRow>
              <DetailRow label="Sumber">{SOURCE_LABEL[tx.source] ?? tx.source}</DetailRow>
              <DetailRow label="Dibuat">{formatDateTime(tx.createdAt)}</DetailRow>
              <DetailRow label="Versi data">{tx.version}</DetailRow>
            </dl>

            <section aria-labelledby="dampak-dompet">
              <h3 id="dampak-dompet" className="text-xs font-semibold tracking-wide text-muted uppercase">
                Dampak ke dompet
              </h3>
              {tx.wallets.length === 0 ? (
                <p className="py-2 text-sm text-muted">Transaksi ini tidak mengubah saldo dompet.</p>
              ) : (
                <ul className="flex flex-col">
                  {tx.wallets.map((leg) => (
                    <li key={`${leg.walletId}-${leg.direction}`} className="row-divide flex items-center gap-3 py-3">
                      <span className="flex-1 text-sm text-fg">{leg.walletName}</span>
                      <span className="text-xs text-muted">{leg.direction === 'in' ? 'Masuk' : 'Keluar'}</span>
                      <Money value={leg.amount} direction={leg.direction} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="riwayat-koreksi">
              <h3 id="riwayat-koreksi" className="text-xs font-semibold tracking-wide text-muted uppercase">
                Riwayat koreksi
              </h3>
              {tx.history.length === 0 ? (
                <p className="py-2 text-sm text-muted">Belum ada koreksi atau pembalikan untuk transaksi ini.</p>
              ) : (
                <ul className="flex flex-col">
                  {tx.history.map((entry) => (
                    <LedgerRow key={entry.id} as="li" onClick={() => onOpenOther(entry.id)}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-fg">{TYPE_LABEL[entry.type] ?? entry.type}</span>
                          <StatusPill tone="neutral">{STATUS_LABEL[entry.status] ?? entry.status}</StatusPill>
                        </div>
                        <p className="truncate text-xs text-muted">
                          {formatDateShort(entry.effectiveDate)}
                          {entry.note ? ` · ${entry.note}` : ''}
                        </p>
                      </div>
                      <Money value={entry.amount} direction={directionOf(entry.type)} />
                    </LedgerRow>
                  ))}
                </ul>
              )}
            </section>

            {correctMode ? (
              <form id="form-koreksi" onSubmit={submitCorrection} noValidate className="flex flex-col gap-4 border-t border-hairline pt-4">
                <p className="text-sm text-muted">
                  Transaksi lama dibalik pada tanggal aslinya, lalu versi baru dicatat pada tanggal di bawah ini.
                </p>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="koreksi-amount" className="text-xs font-semibold text-muted">
                    Nominal
                  </label>
                  <AmountInput
                    id="koreksi-amount"
                    value={amount}
                    onValueChange={setAmount}
                    invalid={Boolean(fieldErrors.amount)}
                    label="Nominal koreksi"
                  />
                  {fieldErrors.amount ? (
                    <p role="alert" className="flex items-start gap-1.5 text-xs text-out">
                      <IconAlert size={15} className="mt-0.5 shrink-0" />
                      <span>{fieldErrors.amount}</span>
                    </p>
                  ) : null}
                </div>

                <Field label="Tanggal" htmlFor="koreksi-date" required error={fieldErrors.effectiveDate}>
                  <TextInput
                    id="koreksi-date"
                    type="date"
                    value={date}
                    invalid={Boolean(fieldErrors.effectiveDate)}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </Field>

                <Field label="Dompet" htmlFor="koreksi-wallet">
                  <SelectControl id="koreksi-wallet" value={walletId} onChange={(event) => setWalletId(event.target.value)}>
                    <option value="">Dompet tidak diubah</option>
                    {wallets
                      .filter((wallet) => !wallet.archivedAt)
                      .map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                          {`${wallet.name} · ${WALLET_TYPE_LABEL[wallet.type] ?? wallet.type} · ${formatIDR(wallet.balance)}`}
                        </option>
                      ))}
                  </SelectControl>
                </Field>

                {tx.type !== 'transfer' ? (
                  <Field label="Kategori" htmlFor="koreksi-category" required error={fieldErrors.categoryId}>
                    <SelectControl
                      id="koreksi-category"
                      value={categoryId}
                      invalid={Boolean(fieldErrors.categoryId)}
                      onChange={(event) => setCategoryId(event.target.value)}
                    >
                      <option value="">Pilih kategori</option>
                      {categories
                        .filter((category) => category.kind === (tx.type === 'income' ? 'income' : 'expense'))
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </SelectControl>
                  </Field>
                ) : null}

                <Field label="Catatan" htmlFor="koreksi-note" hint="Opsional, maksimal 500 karakter.">
                  <Textarea id="koreksi-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
                </Field>

                {formError ? (
                  <div role="alert" className="flex items-start gap-2 rounded-control bg-out/8 px-4 py-3">
                    <IconAlert size={18} className="mt-0.5 shrink-0 text-out" />
                    <span className="text-sm text-fg">{formError}</span>
                  </div>
                ) : null}
              </form>
            ) : null}
          </div>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={cancelOpen}
        title={dialogTitle}
        body={dialogBody}
        confirmLabel={dialogConfirmLabel}
        tone={dialogTone}
        busy={cancelBusy}
        onConfirm={dialogConfirm}
        onCancel={() => setCancelOpen(false)}
      />
    </>
  );
}
