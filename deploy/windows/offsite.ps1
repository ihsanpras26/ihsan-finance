# deploy/windows/offsite.ps1: cadangan offsite harian dari Windows Task Scheduler.
#
# Dump logis basis data produksi (Turso bila IHSAN_DB_URL diisi, kalau tidak berkas IHSAN_DB_PATH)
# lalu unggah ke ember S3/R2. Cocok untuk PowerShell 5.1 bawaan Windows.
#
# Pemakaian manual:
#   powershell -NoProfile -ExecutionPolicy Bypass -File deploy\windows\offsite.ps1
# Pemakaian terjadwal (sekali, dari PowerShell sebagai pengguna yang sama):
#   schtasks /Create /TN "Ihsan offsite backup" /SC DAILY /ST 03:10 /TR ^
#     "powershell -NoProfile -ExecutionPolicy Bypass -File \"D:\Ihsan Finance\ihsan-finance\deploy\windows\offsite.ps1\""
#
# Nilai dikirim lewat berkas env di luar repositori (tidak pernah masuk git):
#   IHSAN_DB_URL, IHSAN_DB_TOKEN, IHSAN_DATA_DIR,
#   IHSAN_S3_ENDPOINT, IHSAN_S3_BUCKET, IHSAN_S3_REGION, IHSAN_S3_ACCESS_KEY_ID,
#   IHSAN_S3_SECRET_ACCESS_KEY, IHSAN_S3_PREFIX, IHSAN_OFFSITE_KEEP
param(
  [string]$EnvFile = (Join-Path $env:USERPROFILE '.ihsan-prod.env'),
  [string]$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$LogDir = (Join-Path $env:LOCALAPPDATA 'ihsan-offsite'),
  [int]$KeepDays = 90
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Berkas env tidak ditemukan: $EnvFile"
}
if (-not (Test-Path -LiteralPath (Join-Path $Repo 'app\package.json'))) {
  throw "Repositori tidak lengkap di $Repo (app\package.json tidak ada)."
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Baris `NAMA=nilai` dijadikan variabel lingkungan proses ini saja.
Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object {
  $parts = $_ -split '=', 2
  $name = $parts[0].Trim()
  $value = $parts[1].Trim()
  if ($name -and $value -and $value -notlike '*ISI_DI_SINI*') {
    Set-Item -Path ("Env:" + $name) -Value $value
  }
}

# Log lama dibuang supaya folder log tidak tumbuh tanpa batas.
Get-ChildItem -LiteralPath $LogDir -Filter 'offsite-*.log' -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  Remove-Item -Force -ErrorAction SilentlyContinue

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = Join-Path $LogDir ("offsite-$stamp.log")

Push-Location (Join-Path $Repo 'app')
try {
  # Lewat cmd.exe supaya pengalihan keluaran terjadi di tingkat proses: log berisi apa adanya tanpa
  # pembungkus error PowerShell 5.1 dan tanpa BOM UTF-16. Node dipanggil langsung (isi dari
  # `pnpm offsite`), jadi tugas terjadwal ini tidak bergantung pada ada-tidaknya pnpm di PATH.
  $commandLine = 'node "server\src\tools\offsite.ts" > "' + $log + '" 2>&1'
  cmd /c $commandLine
  $code = $LASTEXITCODE
}
finally {
  Pop-Location
}

[System.IO.File]::AppendAllText($log, "EXIT=$code" + [Environment]::NewLine)
Get-Content -LiteralPath $log -Encoding UTF8 | Write-Host
# Write-Error akan menghentikan skrip sebelum `exit $code` sehingga kode keluar tugas terjadwal
# selalu 1; pesannya cukup ditulis ke keluaran.
if ($code -ne 0) {
  Write-Host "offsite GAGAL (EXIT=$code). Lihat $log" -ForegroundColor Red
}
exit $code
