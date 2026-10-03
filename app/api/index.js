// api/index.js: entri fungsi Vercel yang di-commit. Vercel merencanakan fungsi dari pohon sumber
// *sebelum* perintah build berjalan, jadi berkas ini harus ada di git supaya `api/index.js`
// terdaftar sebagai fungsi (docs/DECISIONS.md D-24). Isinya diganti bundel mandiri oleh
// `scripts/build-api.mjs` pada langkah build, karena platform tidak menulis ulang spesifier impor
// `.ts` yang dipakai server (Node 24 menjalankan TypeScript langsung, D-03).
import handler from '../server/src/vercel.ts';

export default handler;
