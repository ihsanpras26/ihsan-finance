# SKILLS.md: Skill agen yang dipakai proyek ini

Dokumen ini mencatat skill mana yang membentuk cara proyek ini dikerjakan, dari mana asalnya, dan
lisensinya. Ditulis terbuka supaya atribusi pihak ketiga tidak hilang dan supaya jelas apa yang
sengaja tidak dipublikasikan.

## Yang disertakan di repositori

Seluruhnya pihak ketiga berlisensi terbuka. Teks lisensi asli disalin ke `skills/LICENSE-*`.

| Skill | Folder | Sumber | Lisensi | Dipakai untuk |
|---|---|---|---|---|
| brainstorming | `superpowers/` | [obra/superpowers](https://github.com/obra/superpowers) | MIT | Menajamkan maksud sebelum membangun fitur |
| writing-plans | `superpowers/` | obra/superpowers | MIT | Menyusun rencana dari spesifikasi PRD |
| executing-plans | `superpowers/` | obra/superpowers | MIT | Menjalankan rencana bertahap |
| test-driven-development | `superpowers/` | obra/superpowers | MIT | Tes lebih dulu pada perbaikan bug |
| systematic-debugging | `superpowers/` | obra/superpowers | MIT | Akar masalah sebelum menambal |
| verification-before-completion | `superpowers/` | obra/superpowers | MIT | Tidak mengklaim selesai tanpa bukti |
| requesting-code-review | `superpowers/` | obra/superpowers | MIT | Meninjau sebelum menyerahkan |
| receiving-code-review | `superpowers/` | obra/superpowers | MIT | Menerima temuan tanpa membela diri |
| subagent-driven-development | `superpowers/` | obra/superpowers | MIT | Mendelegasikan pekerjaan ke agen lain |
| dispatching-parallel-agents | `superpowers/` | obra/superpowers | MIT | Pekerjaan paralel yang mandiri |
| using-git-worktrees | `superpowers/` | obra/superpowers | MIT | Isolasi pekerjaan fitur |
| finishing-a-development-branch | `superpowers/` | obra/superpowers | MIT | Menutup cabang kerja |
| writing-skills | `superpowers/` | obra/superpowers | MIT | Menulis skill baru |
| using-superpowers | `superpowers/` | obra/superpowers | MIT | Aturan pemakaian kumpulan skill ini |
| diagnosing-superpowers | `superpowers/` | obra/superpowers | MIT | Menelusuri sesi yang berjalan salah |
| antislop | `creative/` | [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop) | MIT | Filter inti 38 aturan anti-slop |
| antislop-code | `creative/` | miqdadbadjuber/anti-slop | MIT | Kebersihan komentar kode |
| antislop-copywriting | `creative/` | miqdadbadjuber/anti-slop | MIT | Teks antarmuka tanpa gaya mesin |
| antislop-human | `creative/` | miqdadbadjuber/anti-slop | MIT | Kontras, papan tombol, aksesibilitas |
| antislop-layoutmobile | `creative/` | miqdadbadjuber/anti-slop | MIT | Tata letak layar kecil |
| antislop-ui | `creative/` | miqdadbadjuber/anti-slop | MIT | Warna, susunan, komponen, gerak |
| taste-skill | `creative/` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT | Rasa visual dan keputusan estetika |
| redesign-skill | `creative/` | Leonxlnx/taste-skill | MIT | Audit dan peningkatan antarmuka yang sudah ada |
| output-skill | `creative/` | Leonxlnx/taste-skill | MIT | Disiplin keluaran lengkap tanpa pemotongan |
| impeccable | `creative/` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache 2.0 | Arah desain, kerajinan, dan kritik antarmuka |
| grill-me | `productivity/` | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT | Interogasi rencana sebelum dibangun |
| grilling | `productivity/` | mattpocock/skills | MIT | Pendamping grill-me |

**27 skill dari 5 repositori.** Aturan pemakaiannya ada di `AGENTS.md`.

## Yang sengaja tidak dipublikasikan

Sebelum dokumen ini ditulis, folder `skills/` di mesin pengembang berisi salinan seluruh pustaka
skill pribadi pemilik mesin, bukan hanya skill proyek ini. Salinan itu mencakup 25 skill berikut,
yang tidak berhubungan dengan aplikasi keuangan dan yang **repositori sumbernya tidak tercatat
saat salinan dibuat**:

> airtable, architecture-diagram, ascii-video, baoyu-infographic, blocked-page-recovery, box,
> claude-design, design-md, document-to-action-items, docx, google-workspace, humanizer,
> manim-video, maps, meeting-action-items, notion, pdf, p5js, popular-web-designs, powerpoint,
> product-price-monitor, songwriting-and-ai-music, teams-meeting-pipeline, weekly-review-planning,
> xlsx

Alasan tidak dipublikasikan:

1. **Asal-usulnya tidak terverifikasi.** Sebagian besar tidak membawa berkas lisensi, dan tanpa
   lisensi yang jelas sebuah karya tidak boleh didistribusikan ulang. Menerbitkannya ke repositori
   publik akan melanggar hak penulisnya.
2. **Tidak berhubungan dengan proyek ini.** Skill tentang Notion, Airtable, Box, PDF, dan
   pembuatan video musik tidak membantu siapa pun yang membaca repositori aplikasi keuangan, dan
   membuat isinya membingungkan.

Bila pemilik ingin salah satunya ikut dipublikasikan, langkahnya: catat repositori sumbernya,
ambil berkas lisensinya, lalu tambahkan ke `skills/` dan ke tabel di atas. Beberapa di antaranya
memang sudah membawa berkas lisensi di mesin pengembang (docx, pdf, powerpoint, xlsx, humanizer),
tetapi sumbernya belum dicatat sehingga belum dimasukkan.

## Catatan tentang skill yang tidak disalin

`agent-browser` dipakai proyek ini untuk uji klik di peramban nyata, tetapi dipasang sebagai
perkakas baris perintah lewat `npm install -g agent-browser`, bukan sebagai skill, sehingga tidak
ada yang perlu disalin. Asalnya [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser),
lisensi Apache 2.0.
