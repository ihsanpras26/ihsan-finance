// routes/auth/Auth.tsx - masuk, daftar, dan pemulihan akses dalam satu layar (PRD FR01).
// Pemulihan akses dibuka dari tautan di panel masuk, bukan tab tersendiri, karena kode pemulihan
// hanya dipakai saat kata sandi terlupa; kode itu ditampilkan sekali sebelum sesi dipasang.
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SelectControl } from '../../components/forms/fields.tsx';
import { Button, Card, Field, TabPanel, Tabs, TextInput, useToast } from '../../components/ui.tsx';
import { IconAlert } from '../../components/icons.tsx';
import { api, ApiError, type SessionUser } from '../../lib/api.ts';
import { useSession } from '../../lib/session.tsx';

type Mode = 'masuk' | 'daftar' | 'pulihkan';
type TabId = 'masuk' | 'daftar';

const TABS: { id: TabId; label: string }[] = [
  { id: 'masuk', label: 'Masuk' },
  { id: 'daftar', label: 'Daftar' },
];

const TIMEZONES = ['Asia/Jakarta', 'Asia/Pontianak', 'Asia/Makassar', 'Asia/Jayapura'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthPage() {
  const { setUser, refresh } = useSession();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [mode, setMode] = useState<Mode>('masuk');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [timezone, setTimezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
    } catch {
      return 'Asia/Jakarta';
    }
  });
  const [pendingUser, setPendingUser] = useState<SessionUser | null>(null);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const timezoneOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];
  const activeTab: TabId = mode === 'daftar' ? 'daftar' : 'masuk';

  function switchMode(next: Mode) {
    setMode(next);
    setFormError(null);
    setFieldErrors({});
    setCopied(false);
  }

  function finishSignIn(user: SessionUser) {
    setUser(user);
    void refresh();
    navigate(from, { replace: true });
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = mode === 'pulihkan' ? 'Isi email akun yang akan dipulihkan.' : 'Isi email yang dipakai untuk masuk.';
    else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Format email belum benar. Contoh: nama@contoh.id.';

    if (mode === 'daftar') {
      if (!displayName.trim()) errors.displayName = 'Isi nama yang ditampilkan di aplikasi.';
      if (!password) errors.password = 'Isi kata sandi.';
      else if (password.length < 8) errors.password = 'Kata sandi minimal 8 karakter.';
    }

    if (mode === 'masuk' && !password) errors.password = 'Isi kata sandi.';

    if (mode === 'pulihkan') {
      if (!recoveryCode.trim()) errors.recoveryCode = 'Isi kode pemulihan yang disimpan saat mendaftar.';
      if (!newPassword) errors.newPassword = 'Isi kata sandi baru.';
      else if (newPassword.length < 8) errors.newPassword = 'Kata sandi minimal 8 karakter.';
    }
    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError('Beberapa isian belum benar. Perbaiki isian yang ditandai, lalu kirim lagi.');
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      if (mode === 'masuk') {
        const result = await api.login({ email: email.trim(), password });
        push('success', `Selamat datang, ${result.user.displayName}.`);
        finishSignIn(result.user);
      } else if (mode === 'daftar') {
        const result = await api.register({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
          timezone,
          workspaceName: workspaceName.trim() || undefined,
        });
        if (result.recoveryCode) {
          // Kode ditampilkan sekali; sesi dipasang setelah pengguna mengakui sudah menyimpannya.
          setPendingUser(result.user);
          setIssuedCode(result.recoveryCode);
        } else {
          push('success', 'Akun dibuat. Ruang keuangan pribadi sudah siap.');
          finishSignIn(result.user);
        }
      } else {
        const result = await api.recover({
          email: email.trim(),
          recoveryCode: recoveryCode.trim(),
          newPassword,
        });
        push('success', 'Akses dipulihkan. Kata sandi baru sudah dipakai.');
        finishSignIn(result.user);
      }
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      if (error?.code === 'rate_limited') {
        setFormError('Terlalu banyak percobaan masuk untuk email ini. Tunggu 15 menit, lalu coba lagi. Bila kata sandi terlupa, pulihkan akses dengan kode pemulihan.');
      } else if (error?.code === 'unauthorized' && mode === 'masuk') {
        setFormError('Email atau kata sandi tidak cocok. Periksa ejaannya, lalu coba lagi.');
      } else if (error?.code === 'unauthorized' && mode === 'pulihkan') {
        setFormError('Kode pemulihan tidak cocok dengan email ini. Periksa kode yang disimpan saat mendaftar, lalu coba lagi.');
      } else if (error?.code === 'not_found') {
        setFormError('Email ini belum terdaftar. Pilih Daftar untuk membuat akun baru.');
      } else if (error?.code === 'offline') {
        setFormError('Tidak ada koneksi ke server. Periksa jaringan, lalu kirim lagi.');
      } else if (error) {
        setFieldErrors(error.fields);
        setFormError(error.display);
      } else {
        setFormError('Permintaan gagal diproses. Periksa isian, lalu coba lagi.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(issuedCode);
      setCopied(true);
      push('success', 'Kode pemulihan disalin ke papan klip.');
    } catch {
      push('error', 'Papan klip tidak dapat diakses. Salin kode langsung dari kotak di layar.');
    }
  }

  const submitLabel = mode === 'masuk' ? 'Masuk ke akun' : mode === 'daftar' ? 'Buat akun' : 'Simpan kata sandi baru';

  const formFields = (
    <>
      {mode === 'daftar' ? (
        <Field label="Nama tampilan" htmlFor="auth-name" required error={fieldErrors.displayName}>
          <TextInput
            id="auth-name"
            autoComplete="name"
            value={displayName}
            invalid={Boolean(fieldErrors.displayName)}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Field>
      ) : null}

      <Field label="Email" htmlFor="auth-email" required error={fieldErrors.email}>
        <TextInput
          id="auth-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          invalid={Boolean(fieldErrors.email)}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>

      {mode === 'masuk' || mode === 'daftar' ? (
        <Field
          label="Kata sandi"
          htmlFor="auth-password"
          required
          error={fieldErrors.password}
          hint={mode === 'daftar' ? 'Minimal 8 karakter.' : undefined}
        >
          <TextInput
            id="auth-password"
            type="password"
            autoComplete={mode === 'daftar' ? 'new-password' : 'current-password'}
            value={password}
            invalid={Boolean(fieldErrors.password)}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
      ) : null}

      {mode === 'masuk' ? (
        <Button variant="ghost" size="sm" className="self-start -ml-3" onClick={() => switchMode('pulihkan')}>
          Lupa kata sandi
        </Button>
      ) : null}

      {mode === 'daftar' ? (
        <>
          <Field label="Zona waktu" htmlFor="auth-timezone" hint="Dipakai untuk menentukan tanggal transaksi dan batas periode laporan.">
            <SelectControl id="auth-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </SelectControl>
          </Field>
          <Field label="Nama ruang keuangan" htmlFor="auth-workspace" hint="Opsional. Boleh dikosongkan, nama bawaan akan dipakai.">
            <TextInput
              id="auth-workspace"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
            />
          </Field>
        </>
      ) : null}

      {mode === 'pulihkan' ? (
        <>
          <Field
            label="Kode pemulihan"
            htmlFor="auth-recovery"
            required
            error={fieldErrors.recoveryCode}
            hint="Kode yang ditampilkan sekali saat pendaftaran."
          >
            <TextInput
              id="auth-recovery"
              autoComplete="off"
              value={recoveryCode}
              invalid={Boolean(fieldErrors.recoveryCode)}
              onChange={(event) => setRecoveryCode(event.target.value)}
            />
          </Field>
          <Field label="Kata sandi baru" htmlFor="auth-new-password" required error={fieldErrors.newPassword} hint="Minimal 8 karakter.">
            <TextInput
              id="auth-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              invalid={Boolean(fieldErrors.newPassword)}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
        </>
      ) : null}

      {formError ? (
        <div role="alert" className="flex items-start gap-2 rounded-control bg-out/8 px-4 py-3">
          <IconAlert size={18} className="mt-0.5 shrink-0 text-out" />
          <span className="text-sm text-fg">{formError}</span>
        </div>
      ) : null}

      <Button type="submit" size="lg" block loading={busy}>
        {submitLabel}
      </Button>
    </>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-4 py-10">
      <Card className="px-5 py-6">
        {/* Penanda merek: monogram yang sama dengan rel aplikasi (DESIGN.md "lencana merek"), bukan
            berkas logo — pemilik belum menyetujui logo resmi, jadi tidak ada aset baru yang dibuat. */}
        <div className="flex items-center gap-2.5">
          <span className="inline-flex size-9 items-center justify-center rounded-control bg-accent-solid text-base font-bold text-accent-fg" aria-hidden="true">
            IF
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-fg">Ihsan Finance</h1>
        </div>
        <p className="mt-3 text-sm text-muted">
          Buku kas pribadi: catat pendapatan, pengeluaran, utang, piutang, dan tujuan tabungan dalam satu tempat.
        </p>

        {issuedCode ? (
          <section className="mt-6" aria-labelledby="kode-pemulihan">
            <h2 id="kode-pemulihan" className="text-lg font-semibold text-fg">
              Simpan kode pemulihan
            </h2>
            <p className="mt-2 text-sm text-muted">
              Kode ini dipakai untuk masuk kembali bila kata sandi terlupa. Kode hanya ditampilkan sekali di layar ini.
            </p>
            <p className="tnum mt-4 select-all rounded-control bg-sunken px-3 py-3 text-lg font-semibold tracking-wide text-fg">
              {issuedCode}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="secondary" block onClick={() => void copyCode()}>
                {copied ? 'Kode tersalin' : 'Salin kode pemulihan'}
              </Button>
              <Button
                block
                disabled={!pendingUser}
                onClick={() => {
                  if (pendingUser) finishSignIn(pendingUser);
                }}
              >
                Kode sudah disimpan, lanjut ke Beranda
              </Button>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-warn">
              <IconAlert size={15} className="mt-0.5 shrink-0" />
              <span>Tanpa kode ini, pemulihan akses tidak bisa dilakukan dari aplikasi.</span>
            </p>
          </section>
        ) : mode === 'pulihkan' ? (
          <section className="mt-6" aria-labelledby="pulihkan-akses">
            <h2 id="pulihkan-akses" className="text-lg font-semibold text-fg">
              Pulihkan akses akun
            </h2>
            <p className="mt-2 text-sm text-muted">
              Isi email akun dan kode pemulihan yang disimpan saat mendaftar, lalu tetapkan kata sandi baru.
            </p>
            <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
              {formFields}
              <Button variant="ghost" size="sm" className="self-start -ml-3" onClick={() => switchMode('masuk')}>
                Kembali ke masuk
              </Button>
            </form>
          </section>
        ) : (
          <>
            <div className="mt-6">
              <Tabs tabs={TABS} active={activeTab} onChange={switchMode} label="Pilihan akses akun" idBase="auth" />
            </div>
            <TabPanel idBase="auth" id={activeTab} className="mt-4">
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                {formFields}
              </form>
            </TabPanel>
          </>
        )}
      </Card>

      <p className="mt-4 text-xs text-muted">
        Aplikasi ini mencatat dan merangkum keuangan. Rilis awal tidak melakukan pembayaran dan tidak menyimpan kredensial
        bank.
      </p>
    </div>
  );
}
