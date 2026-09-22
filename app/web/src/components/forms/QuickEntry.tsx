// components/forms/QuickEntry.tsx - input cepat (PRD §05, ARCHITECTURE §8).
// Aturan yang dijaga di berkas ini:
// 1. Nominal tampil lebih dulu dengan papan angka; dompet dan tanggal selalu terlihat sebelum simpan.
// 2. Satu tombol simpan; menekan berulang memakai kunci idempotensi yang sama, jadi tidak menggandakan.
// 3. Jaringan gagal: isian disimpan sebagai draf lokal dan diberi label "Belum tersinkron".
//    Kata "Tersimpan" hanya muncul setelah server mengonfirmasi (PRD FR22).
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey, type Category, type Preferences, type Wallet } from '../../lib/api.ts';
import { directionOf, formatDateLong, formatDateShort, formatIDR, formatSigned, todayIso, TYPE_LABEL, WALLET_TYPE_LABEL } from '../../lib/format.ts';
import { useAsync, useOnline } from '../../lib/hooks.ts';
import { clearDraft, listDrafts, saveDraft, type Draft } from '../../lib/offline.ts';
import { useSession } from '../../lib/session.tsx';
import { IconAlert, IconChevronDown, IconCloudOff } from '../icons.tsx';
import { AmountInput, Button, Field, OfflineBadge, Sheet, StatusPill, TextInput, Textarea, useToast } from '../ui.tsx';
import { SelectControl } from './fields.tsx';

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
        <div className="flex flex-col gap-2">
          {draft ? (
            <div className="flex flex-wrap items-center gap-2">
              <OfflineBadge savedAt={draft.savedAt} />
              <StatusPill tone="warn">Belum tersinkron</StatusPill>
            </div>
          ) : null}
          <Button type="submit" form={FORM_ID} size="lg" block loading={busy}>
            {draft ? 'Kirim ulang transaksi' : 'Simpan transaksi'}
          </Button>
        </div>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qe-amount" className="text-xs font-semibold text-muted">
            Nominal
            <span className="ml-0.5 text-out" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (wajib)</span>
          </label>
          <AmountInput
            id="qe-amount"
            autoFocus
            value={amount}
            onValueChange={setAmount}
            invalid={Boolean(fieldErrors.amount)}
            label="Nominal transaksi"
          />
          {fieldErrors.amount ? (
            <p role="alert" className="flex items-start gap-1.5 text-xs text-out">
              <IconAlert size={15} className="mt-0.5 shrink-0" />
              <span>{fieldErrors.amount}</span>
            </p>
          ) : null}
        </div>

        <div role="group" aria-label="Jenis transaksi" className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">
            Jenis
            <span className="ml-0.5 text-out" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (wajib)</span>
          </span>
          <div className="grid grid-cols-3 gap-1 rounded-control bg-sunken p-1">
            {TYPE_CHOICES.map((choice) => {
              const selected = choice.id === type;
              return (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setType(choice.id)}
                  className={`press min-h-[44px] rounded-[8px] px-2 text-sm font-semibold transition-colors duration-150 ${
                    selected ? 'bg-raised text-fg shadow-[0_1px_2px_rgb(16_24_40/0.08)]' : 'text-muted hover:text-fg'
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
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

        <Field
          label={type === 'transfer' ? 'Dompet asal' : 'Dompet'}
          htmlFor="qe-wallet"
          required
          error={fieldErrors.walletId}
          hint={wallets.loading ? 'Memuat daftar dompet.' : activeWallets.length === 0 ? 'Belum ada dompet aktif. Buat dompet lebih dulu di layar Profil.' : undefined}
        >
          <SelectControl
            id="qe-wallet"
            value={walletId}
            invalid={Boolean(fieldErrors.walletId)}
            disabled={wallets.loading || activeWallets.length === 0}
            onChange={(event) => setWalletId(event.target.value)}
          >
            {activeWallets.length === 0 ? <option value="">Tidak ada dompet aktif</option> : null}
            {activeWallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {`${wallet.name} · ${WALLET_TYPE_LABEL[wallet.type] ?? wallet.type} · ${formatIDR(wallet.balance)}`}
              </option>
            ))}
          </SelectControl>
        </Field>

        {type === 'transfer' ? (
          <Field label="Dompet tujuan" htmlFor="qe-to-wallet" required error={fieldErrors.toWalletId}>
            <SelectControl
              id="qe-to-wallet"
              value={toWalletId}
              invalid={Boolean(fieldErrors.toWalletId)}
              disabled={wallets.loading || activeWallets.length === 0}
              onChange={(event) => setToWalletId(event.target.value)}
            >
              <option value="">Pilih dompet tujuan</option>
              {activeWallets
                .filter((wallet) => wallet.id !== walletId)
                .map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {`${wallet.name} · ${WALLET_TYPE_LABEL[wallet.type] ?? wallet.type} · ${formatIDR(wallet.balance)}`}
                  </option>
                ))}
            </SelectControl>
          </Field>
        ) : (
          <Field
            label="Kategori"
            htmlFor="qe-category"
            required
            error={fieldErrors.categoryId}
            hint={categories.loading ? 'Memuat daftar kategori.' : categoryList.length === 0 ? 'Belum ada kategori untuk jenis ini. Buat kategori lebih dulu di layar Profil.' : undefined}
          >
            <SelectControl
              id="qe-category"
              value={categoryId}
              invalid={Boolean(fieldErrors.categoryId)}
              disabled={categories.loading || categoryList.length === 0}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {categoryList.length === 0 ? <option value="">Tidak ada kategori</option> : null}
              {categoryList.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectControl>
          </Field>
        )}

        <Field
          label="Tanggal"
          htmlFor="qe-date"
          required
          error={fieldErrors.effectiveDate}
          hint={futureDate ? 'Tanggal setelah hari ini disimpan sebagai rencana dan belum mengubah saldo.' : `Hari ini ${formatDateLong(todayIso())}.`}
        >
          <TextInput
            id="qe-date"
            type="date"
            value={date}
            invalid={Boolean(fieldErrors.effectiveDate)}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>

        <div className="pt-3">
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
            <div id="qe-detail" className="flex flex-col gap-4 pt-1">
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

        {formError ? (
          <div role="alert" className="flex items-start gap-2 rounded-control bg-out/8 px-4 py-3">
            <IconAlert size={18} className="mt-0.5 shrink-0 text-out" />
            <span className="text-sm text-fg">{formError}</span>
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}
