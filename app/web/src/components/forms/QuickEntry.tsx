// components/forms/QuickEntry.tsx - input cepat (PRD §05, ARCHITECTURE §8).
// Nominal diisi lewat papan angka yang selalu terlihat; dompet, kategori, dan tanggal dipilih dari
// baris chip di atasnya. Jaringan gagal: isian disimpan sebagai draf lokal berlabel "Belum
// tersinkron", dan kata "Tersimpan" hanya muncul setelah server mengonfirmasi (PRD FR22).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey, type Category, type Preferences, type Wallet } from '../../lib/api.ts';
import { directionOf, formatDateLong, formatDateShort, formatIDR, formatSigned, todayIso, TYPE_LABEL, WALLET_TYPE_LABEL } from '../../lib/format.ts';
import { useAsync, useOnline } from '../../lib/hooks.ts';
import { clearDraft, listDrafts, saveDraft, type Draft } from '../../lib/offline.ts';
import { useSession } from '../../lib/session.tsx';
import { IconAlert, IconChevronDown, IconChevronLeft, IconCloudOff } from '../icons.tsx';
import { AmountInput, Button, Chip, Field, Money, OfflineBadge, Sheet, StatusPill, TextInput, Textarea, useToast } from '../ui.tsx';

export type QuickEntryType = 'expense' | 'income' | 'transfer';

export interface QuickEntryInit {
  type?: QuickEntryType;
}

const FORM_ID = 'form-input-cepat';
const DRAFT_KINDS: QuickEntryType[] = ['expense', 'income', 'transfer'];

const TYPE_CHOICES: { id: QuickEntryType; label: string }[] = [
  { id: 'expense', label: 'Pengeluaran' },
  { id: 'income', label: 'Pendapatan' },
  { id: 'transfer', label: 'Transfer' },
];

function pickWallet(active: Wallet[], preferences: Preferences): string {
  const preferred = preferences.lastWalletId ?? preferences.defaultWalletId;
  const match = active.find((wallet) => wallet.id === preferred);
  return (match ?? active[0])?.id ?? '';
}

function pickCategory(list: Category[], preferences: Preferences): string {
  const match = list.find((category) => category.id === preferences.lastCategoryId);
  return (match ?? list[0])?.id ?? '';
}

// Batas P0 untuk satu peristiwa (AGENTS.md aturan 1): papan angka berhenti di sini, bukan membulatkan.
const AMOUNT_MAX = 999_999_999_999;

function appendDigits(current: number, digits: string): number {
  const merged = `${current}${digits}`.replace(/^0+(?=\d)/, '');
  const next = Number(merged);
  return Number.isSafeInteger(next) && next <= AMOUNT_MAX ? next : current;
}

function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Papan angka 3x4: angka, "000", dan hapus satu angka. Semua tombol setinggi 48px. */
function Keypad({ onDigit, onBackspace }: { onDigit: (digits: string) => void; onBackspace: () => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onDigit(key)}
          className="tnum press h-12 rounded-control bg-sunken text-lg font-semibold text-fg transition-colors duration-150 hover:bg-fg/8"
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        onClick={onBackspace}
        aria-label="Hapus satu angka"
        className="press inline-flex h-12 items-center justify-center rounded-control bg-sunken text-muted transition-colors duration-150 hover:bg-fg/8 hover:text-fg"
      >
        <IconChevronLeft size={22} />
      </button>
    </div>
  );
}

export function QuickEntry({
  open, init, onClose, onSaved,
}: {
  open: boolean;
  init: QuickEntryInit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user, preferences } = useSession();
  const { push } = useToast();
  const online = useOnline();
  const workspaceId = user?.workspaceId ?? '';

  const [type, setType] = useState<QuickEntryType>('expense');
  const [amount, setAmount] = useState(0);
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [fee, setFee] = useState(0);
  const [date, setDate] = useState(() => todayIso());
  const [note, setNote] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [key, setKey] = useState(() => newIdempotencyKey());
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const opened = useRef(false);

  const wallets = useAsync(() => api.wallets(), [], { enabled: open });
  const categories = useAsync(
    () => api.categories({ kind: type === 'income' ? 'income' : 'expense' }),
    [type],
    { enabled: open && type !== 'transfer' },
  );

  const activeWallets = (wallets.data ?? []).filter((wallet) => !wallet.archivedAt);
  const categoryList = categories.data ?? [];

  // Setiap kali lembar dibuka: bersihkan isian, lalu pulihkan draf terlama yang belum terkirim.
  useEffect(() => {
    if (!open) {
      opened.current = false;
      return;
    }
    if (opened.current) return;
    opened.current = true;

    setBusy(false);
    setFormError(null);
    setFieldErrors({});
    setDetailOpen(false);
    setDraft(null);
    setType(init?.type ?? 'expense');
    setAmount(0);
    setWalletId('');
    setToWalletId('');
    setCategoryId('');
    setFee(0);
    setDate(todayIso());
    setNote('');
    setKey(newIdempotencyKey());

    const found = workspaceId
      ? listDrafts(workspaceId).find((entry) => DRAFT_KINDS.includes(entry.kind as QuickEntryType))
      : undefined;
    if (!found) return;

    const payload = found.payload as Record<string, unknown>;
    setType(found.kind as QuickEntryType);
    setAmount(Number(payload.amount ?? 0) || 0);
    setWalletId(typeof payload.walletId === 'string' ? payload.walletId : '');
    setToWalletId(typeof payload.toWalletId === 'string' ? payload.toWalletId : '');
    setCategoryId(typeof payload.categoryId === 'string' ? payload.categoryId : '');
    setFee(Number(payload.fee ?? 0) || 0);
    setDate(typeof payload.effectiveDate === 'string' ? payload.effectiveDate : todayIso());
    setNote(typeof payload.note === 'string' ? payload.note : '');
    setKey(found.idempotencyKey);
    setDraft(found);
  }, [open, workspaceId, init]);

  // Dompet terakhir terisi otomatis (PRD §03), kecuali pengguna sudah memilih sendiri.
  useEffect(() => {
    if (!open || activeWallets.length === 0) return;
    setWalletId((current) => (current && activeWallets.some((wallet) => wallet.id === current) ? current : pickWallet(activeWallets, preferences)));
  }, [open, wallets.data, preferences]);

  // Kategori terakhir untuk jenis yang sedang dipilih.
  useEffect(() => {
    if (!open || type === 'transfer' || categoryList.length === 0) return;
    setCategoryId((current) => (current && categoryList.some((category) => category.id === current) ? current : pickCategory(categoryList, preferences)));
  }, [open, type, categories.data, preferences]);

  // Papan fisik dan papan angkat HP tetap bekerja: angka menambah, Backspace mengurangi. Fokus di
  // isian teks (catatan, biaya, tanggal) tidak diganggu.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        setAmount((current) => appendDigits(current, event.key));
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        setAmount((current) => Math.floor(current / 10));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const selectedWallet = activeWallets.find((wallet) => wallet.id === walletId) ?? null;
  const selectedToWallet = activeWallets.find((wallet) => wallet.id === toWalletId) ?? null;
  const today = todayIso();
  const yesterday = shiftIsoDate(today, -1);
  const customDate = date !== today && date !== yesterday;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const errors: Record<string, string> = {};
    if (amount <= 0) errors.amount = 'Nominal harus lebih dari Rp0. Isi nominal lalu simpan lagi.';
    if (!walletId) errors.walletId = 'Pilih dompet untuk transaksi ini.';
    if (type === 'transfer') {
      if (!toWalletId) errors.toWalletId = 'Pilih dompet tujuan.';
      else if (toWalletId === walletId) errors.toWalletId = 'Dompet tujuan harus berbeda dari dompet asal.';
    } else if (!categoryId) {
      errors.categoryId = type === 'income' ? 'Pilih kategori pendapatan.' : 'Pilih kategori pengeluaran.';
    }
    if (!date) errors.effectiveDate = 'Isi tanggal transaksi.';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError('Ada isian yang perlu diperbaiki sebelum disimpan.');
      return;
    }

    const payload: Record<string, unknown> = { type, amount: String(amount), effectiveDate: date, walletId };
    if (note.trim()) payload.note = note.trim();
    if (type === 'transfer') {
      payload.toWalletId = toWalletId;
      if (fee > 0) payload.fee = String(fee);
    } else {
      payload.categoryId = categoryId;
    }

    setBusy(true);
    setFormError(null);
    try {
      const created = await api.createTransaction(payload, key);
      clearDraft(workspaceId, type);
      setDraft(null);
      onSaved();
      push(
        'success',
        `${TYPE_LABEL[created.type] ?? 'Transaksi'} tersimpan: ${formatSigned(created.amount, directionOf(created.type))} pada ${formatDateShort(created.effectiveDate)}.`,
      );
      onClose();
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      if (error?.code === 'offline') {
        const saved = saveDraft(workspaceId, type, payload, key);
        setDraft(saved);
        setFormError('Tidak ada koneksi ke server. Transaksi disimpan sebagai draf di perangkat ini dan belum mengubah saldo. Kirim ulang saat jaringan tersedia.');
      } else if (error?.code === 'unauthorized') {
        setFormError('Sesi berakhir. Masuk lagi untuk menyimpan transaksi. Isian di layar ini tetap ada.');
      } else if (error) {
        setFieldErrors(error.fields);
        setFormError(error.display);
      } else {
        setFormError('Transaksi gagal disimpan. Periksa isian lalu simpan lagi.');
      }
    } finally {
      setBusy(false);
    }
  }

  const futureDate = date > todayIso();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Catat transaksi"
      footer={
        <div className="flex flex-col gap-3">
          {draft ? (
            <div className="flex flex-wrap items-center gap-2">
              <OfflineBadge savedAt={draft.savedAt} />
              <StatusPill tone="warn">Belum tersinkron</StatusPill>
            </div>
          ) : null}
          {formError ? (
            <p role="alert" className="flex items-start gap-2 rounded-control bg-out/8 px-3 py-2 text-xs text-fg">
              <IconAlert size={16} className="mt-0.5 shrink-0 text-out" />
              <span>{formError}</span>
            </p>
          ) : null}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-2xs font-semibold text-muted">Nominal</span>
            <span aria-live="polite" className="figure text-3xl text-fg">
              {formatIDR(amount)}
            </span>
          </div>
          {fieldErrors.amount ? (
            <p role="alert" className="text-xs text-out">
              {fieldErrors.amount}
            </p>
          ) : null}
          <Keypad
            onDigit={(digits) => setAmount((current) => appendDigits(current, digits))}
            onBackspace={() => setAmount((current) => Math.floor(current / 10))}
          />
          <Button type="submit" form={FORM_ID} size="lg" block loading={busy}>
            {draft ? 'Kirim ulang transaksi' : 'Simpan transaksi'}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div role="group" aria-label="Jenis transaksi" className="flex flex-col gap-2">
          <span className="text-2xs font-semibold text-muted">Jenis</span>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_CHOICES.map((choice) => (
              <Chip key={choice.id} selected={choice.id === type} onClick={() => setType(choice.id)} className="justify-center">
                {choice.label}
              </Chip>
            ))}
          </div>
        </div>

        {wallets.error ? (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-control bg-out/8 px-4 py-3">
            <p className="text-sm text-fg">{wallets.error.display}</p>
            <Button variant="secondary" onClick={wallets.reload}>
              Muat ulang dompet
            </Button>
          </div>
        ) : null}

        <div role="group" aria-label={type === 'transfer' ? 'Dompet asal' : 'Dompet'} className="flex flex-col gap-2">
          <span className="text-2xs font-semibold text-muted">{type === 'transfer' ? 'Dompet asal' : 'Dompet'}</span>
          {wallets.loading ? <p className="text-xs text-muted">Memuat daftar dompet.</p> : null}
          {!wallets.loading && activeWallets.length === 0 ? (
            <p className="text-xs text-warn">Belum ada dompet aktif. Buat dompet lebih dulu di layar Profil.</p>
          ) : null}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {activeWallets.map((wallet) => (
              <Chip key={wallet.id} selected={wallet.id === walletId} onClick={() => setWalletId(wallet.id)}>
                {wallet.name}
              </Chip>
            ))}
          </div>
          {selectedWallet ? (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span>{WALLET_TYPE_LABEL[selectedWallet.type] ?? selectedWallet.type}</span>
              <span aria-hidden="true">·</span>
              {/* Saldo dompet yang dipilih adalah angka tunggal, bukan kolom angka: tanpa kolom
                  tanda, karena pemisah "·" di sebelahnya sudah memisahkan label dari nominal. */}
              <Money value={selectedWallet.balance} size="sm" sign={false} />
            </p>
          ) : null}
          {fieldErrors.walletId ? (
            <p role="alert" className="text-xs text-out">
              {fieldErrors.walletId}
            </p>
          ) : null}
        </div>

        {type === 'transfer' ? (
          <div role="group" aria-label="Dompet tujuan" className="flex flex-col gap-2">
            <span className="text-2xs font-semibold text-muted">Dompet tujuan</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {activeWallets
                .filter((wallet) => wallet.id !== walletId)
                .map((wallet) => (
                  <Chip key={wallet.id} selected={wallet.id === toWalletId} onClick={() => setToWalletId(wallet.id)}>
                    {wallet.name}
                  </Chip>
                ))}
            </div>
            {selectedToWallet ? (
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <span>{WALLET_TYPE_LABEL[selectedToWallet.type] ?? selectedToWallet.type}</span>
                <span aria-hidden="true">·</span>
                <Money value={selectedToWallet.balance} size="sm" sign={false} />
              </p>
            ) : null}
            {fieldErrors.toWalletId ? (
              <p role="alert" className="text-xs text-out">
                {fieldErrors.toWalletId}
              </p>
            ) : null}
          </div>
        ) : (
          <div role="group" aria-label="Kategori" className="flex flex-col gap-2">
            <span className="text-2xs font-semibold text-muted">Kategori</span>
            {categories.loading ? <p className="text-xs text-muted">Memuat daftar kategori.</p> : null}
            {!categories.loading && categoryList.length === 0 ? (
              <p className="text-xs text-warn">Belum ada kategori untuk jenis ini. Buat kategori lebih dulu di layar Profil.</p>
            ) : null}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categoryList.map((category) => (
                <Chip key={category.id} selected={category.id === categoryId} onClick={() => setCategoryId(category.id)}>
                  {category.name}
                </Chip>
              ))}
            </div>
            {fieldErrors.categoryId ? (
              <p role="alert" className="text-xs text-out">
                {fieldErrors.categoryId}
              </p>
            ) : null}
          </div>
        )}

        <div role="group" aria-label="Tanggal transaksi" className="flex flex-col gap-2">
          <span className="text-2xs font-semibold text-muted">Tanggal</span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip selected={date === today} onClick={() => setDate(today)}>
              Hari ini
            </Chip>
            <Chip selected={date === yesterday} onClick={() => setDate(yesterday)}>
              Kemarin
            </Chip>
            <Chip
              selected={customDate}
              aria-expanded={datePickerOpen}
              aria-controls="qe-date"
              onClick={() => setDatePickerOpen((value) => !value)}
            >
              {customDate ? formatDateShort(date) : 'Pilih tanggal'}
            </Chip>
          </div>
          {customDate || datePickerOpen ? (
            <div id="qe-date">
              <TextInput
                aria-label="Tanggal transaksi"
                type="date"
                value={date}
                invalid={Boolean(fieldErrors.effectiveDate)}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          ) : null}
          {fieldErrors.effectiveDate ? (
            <p role="alert" className="text-xs text-out">
              {fieldErrors.effectiveDate}
            </p>
          ) : (
            <p className="text-xs text-muted">
              {futureDate ? 'Tanggal setelah hari ini disimpan sebagai rencana dan belum mengubah saldo.' : `Hari ini ${formatDateLong(today)}.`}
            </p>
          )}
        </div>

        <div className="pt-1">
          <button
            type="button"
            aria-expanded={detailOpen}
            aria-controls="qe-detail"
            onClick={() => setDetailOpen((value) => !value)}
            className="press flex min-h-[44px] w-full items-center justify-between gap-2 rounded-control text-left text-sm font-semibold text-fg"
          >
            Detail tambahan
            <IconChevronDown size={18} className={`transition-transform duration-150 ${detailOpen ? 'rotate-180' : ''}`} />
          </button>
          {detailOpen ? (
            <div id="qe-detail" className="flex flex-col gap-4 pt-2">
              <Field label="Catatan" htmlFor="qe-note" hint="Opsional, maksimal 500 karakter.">
                <Textarea
                  id="qe-note"
                  value={note}
                  maxLength={500}
                  placeholder="Misalnya: makan siang"
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
              {type === 'transfer' ? (
                <Field label="Biaya transfer" htmlFor="qe-fee" hint="Opsional. Dicatat sebagai pengeluaran biaya, terpisah dari nilai transfer.">
                  <AmountInput id="qe-fee" value={fee} onValueChange={setFee} label="Biaya transfer" />
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>

        {!online ? (
          <p className="flex items-start gap-2 text-xs text-warn">
            <IconCloudOff size={16} className="mt-0.5 shrink-0" />
            Tidak ada koneksi. Menyimpan sekarang menaruh transaksi sebagai draf di perangkat ini, bukan di server.
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
