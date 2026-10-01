// routes/transaksi/Transaksi.tsx - daftar baris buku besar: pencarian dipin, saringan di lembar
// bawah, kelompok per tanggal, detail di lembar bawah, pembatalan berdampak, dan koreksi
// (PRD FR07, ARCHITECTURE §8). Saringan hidup di URL query (from, to, type, walletId, categoryId, q)
// supaya tautan dari layar lain mendarat sudah terfilter dan tombol Kembali bekerja (DESIGN.md "Layout").
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SelectControl } from '../../components/forms/fields.tsx';
import { useShell } from '../../components/layout/AppShell.tsx';
import { DataError } from '../../components/layout/DataError.tsx';
import { IconAlert, IconCalendar, IconFilter, IconTransfer } from '../../components/icons.tsx';
import {
  AmountInput, Button, Card, Chip, ConfirmDialog, EmptyState, Field, IconTile, LedgerRow, LoadingRows,
  Money, PageHeader, SearchField, Sheet, SignMark, StatusPill, Textarea, TextInput, useToast,
} from '../../components/ui.tsx';
import {
  api, ApiError, type Category, type Transaction, type TxPage, type TxStatus, type TxType, type Wallet,
} from '../../lib/api.ts';
import {
  currentPeriod, directionOf, formatDateLong, formatDateShort, formatIDR, parseIso, relativeDay,
  STATUS_LABEL, toMinor, todayIso, TYPE_LABEL, WALLET_TYPE_LABEL,
} from '../../lib/format.ts';
import { useAsync, useDebounced } from '../../lib/hooks.ts';

const PAGE_SIZE = 20;

type TypeFilter = TxType | 'all';

/** Saringan jenis yang ditawarkan lembar saringan; sisa jenis jarang dipakai jadi tidak dijejalkan. */
const TYPE_CHIPS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'expense', label: 'Pengeluaran' },
  { id: 'income', label: 'Pendapatan' },
  { id: 'transfer', label: 'Transfer' },
];

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Dicatat manual',
  import: 'Impor berkas',
  automatic: 'Otomatis',
  system: 'Sistem',
};

/** Koreksi hanya untuk jenis yang bisa dicatat ulang dari form ini (ARCHITECTURE §8). */
const CORRECTABLE: TxType[] = ['income', 'expense', 'transfer'];

function isTxType(value: string | null): value is TxType {
  return value !== null && value in TYPE_LABEL;
}

/** Tanggal ISO bergeser sekian hari; dipakai rentang cepat 7 dan 30 hari. */
function isoShift(days: number, from: string = todayIso()): string {
  const { y, m, d } = parseIso(from);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Hari pertama dan terakhir sebuah periode bulan, mis. "2026-09" jadi 1 sampai 30 September. */
function monthBounds(period: string = currentPeriod()): { from: string; to: string } {
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y ?? 2026, m ?? 1, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * Nada kotak tanda mengikuti arah uang, bukan warnanya saja: masuk hijau, keluar merah,
 * jenis tanpa arah tetap kotak netral (DESIGN.md "Colors", NFR06).
 */
function rowTone(type: TxType): 'in' | 'out' | 'neutral' {
  const direction = directionOf(type);
  if (direction === 'in') return 'in';
  if (direction === 'out') return 'out';
  return 'neutral';
}

/** Nada label status: rencana menunggu, batal keluar dari arus uang, sisanya netral. */
function statusTone(status: TxStatus): 'in' | 'out' | 'warn' | 'neutral' {
  if (status === 'planned') return 'warn';
  if (status === 'cancelled') return 'out';
  return 'neutral';
}

/** Nama dompet baris tanpa pengulangan: satu transfer bisa punya beberapa kaki di dompet yang sama. */
function rowWallets(tx: Transaction): string {
  const names = [...new Set(tx.wallets.map((leg) => leg.walletName))];
  return names.length > 0 ? names.join(', ') : 'Tanpa dompet';
}

/** Judul baris: kategori untuk pengeluaran/pendapatan, kedua dompet untuk transfer. */
function rowTitle(tx: Transaction): string {
  if (tx.type === 'transfer') {
    const from = tx.wallets.find((leg) => leg.direction === 'out')?.walletName;
    const to = tx.wallets.find((leg) => leg.direction === 'in')?.walletName;
    if (from && to) return `${from} → ${to}`;
  }
  if (tx.category?.name) return tx.category.name;
  if (tx.counterparty?.name) return tx.counterparty.name;
  return TYPE_LABEL[tx.type] ?? tx.type;
}

/**
 * Baris meta: dompet lalu catatan (DESIGN.md "Components": dua baris teks per baris daftar).
 * Transfer sudah menyebut kedua dompet di judulnya, jadi posisi itu diisi jenisnya supaya
 * tidak ada kata yang muncul dua kali dalam satu baris.
 */
function rowMeta(tx: Transaction): string {
  const parts = [tx.type === 'transfer' ? 'Transfer' : rowWallets(tx)];
  if (tx.counterparty?.name) parts.push(tx.counterparty.name);
  if (tx.note?.trim()) parts.push(tx.note.trim());
  return parts.join(' · ');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Total hari itu: satu angka bersih bertanda di ujung kepala kelompok, supaya kelompok tanggal
 * menjawab "hari ini uang bergerak berapa" sebelum satu baris pun dibaca.
 */
function DayTotal({ items }: { items: Transaction[] }) {
  const net = items.reduce((sum, tx) => {
    // Kaki dompet lebih jujur daripada nominal baris: biaya transfer berdiri di kaki terpisah,
    // jadi menjumlahkan nominal barisnya saja akan menghilangkan biaya itu.
    if (tx.wallets.length === 0) {
      const minor = toMinor(tx.amount);
      return sum + (directionOf(tx.type) === 'out' ? -minor : minor);
    }
    return tx.wallets.reduce(
      (legs, leg) => legs + (leg.direction === 'in' ? toMinor(leg.amount) : -toMinor(leg.amount)),
      sum,
    );
  }, 0);
  // Tanda mengikuti tanda totalnya, bukan arah uang masuk atau keluar: kepala kelompok adalah angka
  // bersih hari itu, jadi titik netral hanya akan menyembunyikan arahnya.
  const direction = net > 0 ? 'in' : net < 0 ? 'out' : 'zero';
  return <Money value={net} direction={direction} size="sm" />;
}

/** Satu kelompok chip saringan dengan labelnya sendiri; label isian formulir tetap boleh. */
function ChipGroup({ id, label, scroll = false, children }: { id: string; label: string; scroll?: boolean; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2">
      <p id={id} className="text-xs font-semibold text-muted">{label}</p>
      <div className={`flex flex-wrap gap-2 ${scroll ? 'max-h-64 content-start overflow-y-auto' : ''}`}>{children}</div>
    </div>
  );
}

export function TransaksiPage() {
  const { dataVersion, notifyDataChanged, openQuickEntry } = useShell();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL adalah satu-satunya sumber kebenaran saringan: tautan dari Beranda sudah terfilter, dan
  // tombol Kembali mengembalikan saringan sebelumnya (kontrak lintas layar).
  const params = useMemo(() => {
    const rawType = searchParams.get('type');
    return {
      from: searchParams.get('from') ?? '',
      to: searchParams.get('to') ?? '',
      type: (isTxType(rawType) ? rawType : 'all') as TypeFilter,
      walletId: searchParams.get('walletId') ?? '',
      categoryId: searchParams.get('categoryId') ?? '',
      q: searchParams.get('q') ?? '',
    };
  }, [searchParams]);

  const [queryText, setQueryText] = useState(params.q);
  const debouncedQuery = useDebounced(queryText, 300);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pickDates, setPickDates] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState<Record<number, TxPage>>({});
  const [detailId, setDetailId] = useState<string | null>(null);

  // Identitas penutup lembar harus stabil: Sheet memasang efek [open, onClose] dan mengembalikan
  // fokus ke elemen yang aktif saat lembar dibuka, jadi fungsi baru tiap render akan melepas fokus
  // dari baris yang baru saja ditekan.
  const closeFilters = useCallback(() => setFilterOpen(false), []);
  const closeDetail = useCallback(() => setDetailId(null), []);

  function updateParams(patch: Record<string, string | null>, options: { replace?: boolean } = {}) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: options.replace ?? false });
  }

  // Ketikan mencari baru ditulis ke URL setelah berhenti 300ms, dan menimpa entri riwayat yang
  // sama supaya riwayat tidak dibanjiri satu langkah per huruf.
  useEffect(() => {
    if (debouncedQuery === params.q) return;
    updateParams({ q: debouncedQuery.trim() || null }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // URL berubah dari luar (tombol Kembali, tautan): isian pencarian ikut menyesuaikan.
  useEffect(() => {
    setQueryText(params.q);
  }, [params.q]);

  const listQuery = useMemo(
    () => ({
      from: params.from || undefined,
      to: params.to || undefined,
      type: params.type === 'all' ? undefined : params.type,
      walletId: params.walletId || undefined,
      categoryId: params.categoryId || undefined,
      q: params.q.trim() || undefined,
    }),
    [params],
  );

  const pageQuery = useMemo(() => ({ ...listQuery, page, pageSize: PAGE_SIZE }), [listQuery, page]);
  const list = useAsync(() => api.transactions(pageQuery), [pageQuery, dataVersion]);
  const options = useAsync(async () => {
    const [wallets, categories] = await Promise.all([api.wallets(), api.categories()]);
    return { wallets, categories };
  }, [dataVersion]);

  // Saringan berubah, atau ada mutasi di tempat lain: buang halaman yang sudah diambil dan mulai
  // lagi dari halaman pertama supaya daftar tidak mencampur dua saringan berbeda.
  useEffect(() => {
    setPages({});
    setPage(1);
  }, [listQuery, dataVersion]);

  useEffect(() => {
    const chunk = list.data;
    if (!chunk) return;
    setPages((previous) => (previous[chunk.page] ? previous : { ...previous, [chunk.page]: chunk }));
  }, [list.data]);

  const items = useMemo(() => {
    const out: Transaction[] = [];
    for (let index = 1; index <= page; index += 1) {
      const chunk = pages[index];
      if (!chunk) break;
      out.push(...chunk.items);
    }
    return out;
  }, [pages, page]);

  const total = pages[1]?.total ?? 0;
  const hasMore = items.length < total;
  const loadingMore = list.loading && page > 1;

  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    for (const tx of items) {
      const bucket = byDate.get(tx.effectiveDate);
      if (bucket) bucket.push(tx);
      else byDate.set(tx.effectiveDate, [tx]);
    }
    return [...byDate];
  }, [items]);

  const wallets = options.data?.wallets ?? [];
  const categories = options.data?.categories ?? [];
  // Kata kunci pencarian ikut dihitung sebagai saringan, tapi tidak dimasukkan ke lencana tombol
  // Filter (lencana itu milik lembar saringan). Tanpa ini, pencarian tanpa hasil akan disalahartikan
  // sebagai buku yang masih kosong.
  const activeFilters = [
    params.type !== 'all',
    Boolean(params.walletId),
    Boolean(params.categoryId),
    Boolean(params.from || params.to),
  ].filter(Boolean).length;
  const filtered = activeFilters > 0 || params.q.trim().length > 0;

  const today = todayIso();
  const quickRanges = useMemo(() => {
    const month = monthBounds();
    return [
      { id: '7-hari', label: '7 hari', from: isoShift(-6, today), to: today },
      { id: '30-hari', label: '30 hari', from: isoShift(-29, today), to: today },
      { id: 'bulan-ini', label: 'Bulan ini', from: month.from, to: month.to },
    ];
  }, [today]);

  function resetFilters() {
    setQueryText('');
    setPickDates(false);
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  let subtitle = 'Riwayat seluruh transaksi';
  if (params.from && params.to) subtitle = `Riwayat ${formatDateLong(params.from)} sampai ${formatDateLong(params.to)}`;
  else if (params.from) subtitle = `Riwayat sejak ${formatDateLong(params.from)}`;
  else if (params.to) subtitle = `Riwayat sampai ${formatDateLong(params.to)}`;

  return (
    <div>
      {/* Tanpa tombol aksi di kepala: menambah transaksi sudah punya satu pintu dari cangkang
          aplikasi (tombol di rel kiri dan tombol tengah bilah bawah), jadi tidak digandakan di sini. */}
      <PageHeader title="Transaksi" subtitle={subtitle} />

      {/* Pencarian dipin di puncak daftar: satu-satunya kendali yang harus selalu dalam jangkauan
          jempol saat riwayat digulir (DESIGN.md "Layout"). Latarnya permukaan kanvas, bukan garis. */}
      <div className="pin-under-head z-20 flex items-center gap-2 bg-surface py-2">
        <SearchField
          className="flex-1"
          value={queryText}
          onValueChange={setQueryText}
          label="Cari transaksi berdasarkan catatan"
          placeholder="Cari catatan transaksi"
        />
        <Button variant="secondary" aria-haspopup="dialog" onClick={() => setFilterOpen(true)}>
          <IconFilter size={18} />
          {activeFilters > 0 ? `Filter (${activeFilters})` : 'Filter'}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {list.loading && !pages[1] ? (
          <div className="flex flex-col gap-3">
            <p role="status" aria-live="polite" className="text-sm text-muted">
              Memuat daftar transaksi
            </p>
            <LoadingRows rows={8} label="Memuat daftar transaksi" />
          </div>
        ) : list.error && !pages[1] ? (
          <DataError error={list.error} onRetry={list.reload} />
        ) : items.length === 0 ? (
          filtered ? (
            <EmptyState
              title="Tidak ada transaksi untuk saringan ini"
              body="Periode, jenis, dompet, kategori, atau kata kunci yang dipakai belum menemukan baris apa pun. Bersihkan filter untuk melihat seluruh riwayat."
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  Bersihkan filter
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
            {groups.map(([date, rows]) => (
              <section key={date}>
                {/* Kepala kelompok dibedakan dari baris: latar tenggelam, garis bawah, jumlah baris
                    (hanya kalau lebih dari satu), dan total harian seluruh hari itu. */}
                <div className="head-band -mx-4 flex items-baseline justify-between gap-3 px-4 py-2">
                  <h2 className="flex min-w-0 items-baseline gap-2 text-sm font-semibold text-fg">
                    <span className="truncate">{formatDateLong(date)}</span>
                    {rows.length > 1 ? <span className="shrink-0 text-xs font-normal text-muted">{rows.length} transaksi</span> : null}
                  </h2>
                  <DayTotal items={rows} />
                </div>
                <ul className="flex flex-col">
                  {rows.map((tx) => (
                    <LedgerRow
                      key={tx.id}
                      as="li"
                      onClick={() => setDetailId(tx.id)}
                      leading={
                        // Arah uang terbaca sebelum satu digit pun dibaca, dan seluruh tandanya lurus
                        // dalam satu kolom (DESIGN.md "Kolom tanda"). Baris netral (transfer antar dompet) tidak
                        // punya arah tanda, jadi kotaknya memakai glif transfer, bukan kolom kosong.
                        <IconTile tone={rowTone(tx.type)}>
                          {directionOf(tx.type) === 'zero' ? (
                            <IconTransfer />
                          ) : (
                            <span className="figure text-base font-medium">
                              <SignMark value={tx.amount} direction={directionOf(tx.type)} />
                            </span>
                          )}
                        </IconTile>
                      }
                      trailing={
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Money value={tx.amount} direction={directionOf(tx.type)} size="md" />
                          {tx.status !== 'posted' ? (
                            <StatusPill tone={statusTone(tx.status)}>{STATUS_LABEL[tx.status] ?? tx.status}</StatusPill>
                          ) : null}
                        </div>
                      }
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{rowTitle(tx)}</p>
                          {/* Di desktop meta pindah ke kolom tengah, jadi baris register terbaca tiga
                              kolom dan mata tidak melompat jauh dari nama ke nominal (DESIGN.md "Layout"). */}
                          <p className="truncate text-xs text-muted lg:hidden">{rowMeta(tx)}</p>
                        </div>
                        <p className="hidden w-64 shrink-0 truncate text-right text-xs text-muted lg:block">{rowMeta(tx)}</p>
                      </div>
                    </LedgerRow>
                  ))}
                </ul>
              </section>
            ))}

            <div className="flex flex-col items-center gap-2 border-t border-hairline pt-3">
              <p className="text-xs text-muted" aria-live="polite">
                {`Menampilkan ${items.length} dari ${total} transaksi`}
              </p>
              {/* Muat lebih banyak, bukan penomoran halaman: riwayat ini digulir satu tangan di
                  390px, dan menekan satu tombol besar di ujung daftar lebih murah daripada membidik
                  nomor halaman kecil. `total` dari server membuat sisa barisnya selalu jujur. */}
              {hasMore ? (
                <Button variant="secondary" block loading={loadingMore} onClick={() => setPage((value) => value + 1)}>
                  Muat lebih banyak
                </Button>
              ) : null}
            </div>
          </Card>
        )}

        {list.error && pages[1] ? (
          <Card className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-out" role="status">Daftar terakhir gagal diperbarui: {list.error.display}</p>
              <Button variant="ghost" onClick={list.reload}>
                Coba lagi
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      <Sheet
        open={filterOpen}
        onClose={closeFilters}
        title="Saringan transaksi"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button block onClick={closeFilters}>
              Terapkan
            </Button>
            <Button variant="ghost" block onClick={resetFilters}>
              Bersihkan
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            Chip yang ditekan langsung menyaring daftar di belakang lembar ini, dan alamat halaman
            ikut berubah supaya saringan bisa dibagikan atau dibuka lagi.
          </p>

          <ChipGroup id="saring-jenis" label="Jenis">
            {TYPE_CHIPS.map((option) => (
              <Chip
                key={option.id}
                selected={params.type === option.id}
                onClick={() => updateParams({ type: option.id === 'all' ? null : option.id })}
              >
                {option.label}
              </Chip>
            ))}
          </ChipGroup>

          <ChipGroup id="saring-dompet" label="Dompet" scroll>
            <Chip selected={!params.walletId} onClick={() => updateParams({ walletId: null })}>
              Semua dompet
            </Chip>
            {wallets.map((wallet) => (
              <Chip
                key={wallet.id}
                selected={params.walletId === wallet.id}
                onClick={() => updateParams({ walletId: params.walletId === wallet.id ? null : wallet.id })}
              >
                {wallet.name}
              </Chip>
            ))}
          </ChipGroup>

          <ChipGroup id="saring-kategori" label="Kategori" scroll>
            <Chip selected={!params.categoryId} onClick={() => updateParams({ categoryId: null })}>
              Semua kategori
            </Chip>
            {categories.map((category) => (
              <Chip
                key={category.id}
                selected={params.categoryId === category.id}
                onClick={() => updateParams({ categoryId: params.categoryId === category.id ? null : category.id })}
              >
                {category.name}
              </Chip>
            ))}
          </ChipGroup>

          <ChipGroup id="saring-rentang" label="Rentang tanggal">
            {quickRanges.map((range) => (
              <Chip
                key={range.id}
                selected={params.from === range.from && params.to === range.to}
                onClick={() => {
                  setPickDates(false);
                  updateParams({ from: range.from, to: range.to });
                }}
              >
                {range.label}
              </Chip>
            ))}
            <Chip selected={pickDates} onClick={() => setPickDates((value) => !value)}>
              <IconCalendar size={16} />
              Pilih tanggal
            </Chip>
          </ChipGroup>

          {pickDates ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Dari tanggal" htmlFor="saring-dari">
                <TextInput
                  id="saring-dari"
                  type="date"
                  value={params.from}
                  onChange={(event) => updateParams({ from: event.target.value || null }, { replace: true })}
                />
              </Field>
              <Field label="Sampai tanggal" htmlFor="saring-sampai">
                <TextInput
                  id="saring-sampai"
                  type="date"
                  value={params.to}
                  onChange={(event) => updateParams({ to: event.target.value || null }, { replace: true })}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </Sheet>

      {detailId ? (
        <DetailPanel
          key={detailId}
          id={detailId}
          wallets={wallets}
          categories={categories}
          onClose={closeDetail}
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

  // Server mengembalikan transaksi ini sendiri di dalam rantai riwayatnya, jadi baris itu dibuang
  // lebih dulu supaya daftar hanya berisi versi lain: pembalikan atau penggantinya.
  const revisions = (tx?.history ?? []).filter((entry) => entry.id !== tx?.id);

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

  // Sama seperti lembar saringan: identitas penutup yang stabil menjaga fokus tetap di tempatnya.
  const closeCancel = useCallback(() => setCancelOpen(false), []);

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
  let dialogConfirm = closeCancel;

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
      dialogConfirm = closeCancel;
    }
  } else if (impact.error) {
    dialogTitle = 'Dampak pembatalan tidak dapat diperiksa';
    dialogBody = `${impact.error.display} Periksa koneksi, lalu tekan Batalkan transaksi lagi.`;
    dialogConfirmLabel = 'Tutup';
    dialogConfirm = closeCancel;
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
              <Button variant="ghost" block onClick={onClose}>
                Tutup
              </Button>
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
            <div className="flex flex-col gap-2 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-fg">{TYPE_LABEL[tx.type] ?? tx.type}</span>
                <StatusPill tone={statusTone(tx.status)}>{STATUS_LABEL[tx.status] ?? tx.status}</StatusPill>
              </div>
              <Money value={tx.amount} direction={directionOf(tx.type)} size="hero" sign={false} />
              <p className="text-sm text-muted">
                {/* relativeDay jatuh kembali ke tanggal singkat untuk selisih lebih dari sepekan,
                    dan itu hanya mengulang tanggal di sebelahnya, jadi lambangnya dibuang. */}
                {formatDateLong(tx.effectiveDate)}
                {relativeDay(tx.effectiveDate) === formatDateShort(tx.effectiveDate)
                  ? ''
                  : ` (${relativeDay(tx.effectiveDate)})`}
              </p>
            </div>

            <dl className="flex flex-col">
              {tx.category ? <DetailRow label="Kategori">{tx.category.name}</DetailRow> : null}
              <DetailRow label="Dompet">{rowWallets(tx)}</DetailRow>
              <DetailRow label="Catatan">{tx.note ?? 'Tanpa catatan'}</DetailRow>
              {tx.counterparty ? <DetailRow label="Pihak">{tx.counterparty.name}</DetailRow> : null}
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
              {revisions.length === 0 ? (
                <p className="py-2 text-sm text-muted">Belum ada koreksi atau pembalikan untuk transaksi ini.</p>
              ) : (
                <ul className="flex flex-col">
                  {revisions.map((entry) => (
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
        onCancel={closeCancel}
      />
    </>
  );
}
