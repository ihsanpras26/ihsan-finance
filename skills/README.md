# Skills

Skill agen yang dipakai proyek ini, disalin ke dalam repositori supaya proyek tetap dapat
dikerjakan tanpa mengambil ulang dari internet. Semuanya pihak ketiga berlisensi terbuka; teks
lisensi aslinya ada di berkas `LICENSE-*` di folder ini.

## Isi

| Folder | Skill | Sumber | Lisensi |
|---|---|---|---|
| `superpowers/` | 15 skill metodologi: brainstorming, writing-plans, executing-plans, test-driven-development, systematic-debugging, verification-before-completion, requesting-code-review, receiving-code-review, subagent-driven-development, dispatching-parallel-agents, using-git-worktrees, finishing-a-development-branch, writing-skills, using-superpowers, diagnosing-superpowers | [obra/superpowers](https://github.com/obra/superpowers) | MIT |
| `creative/antislop*` | 6 skill filter anti-slop: inti, kode, copywriting, human, layoutmobile, ui | [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop) | MIT |
| `creative/taste-skill`, `creative/redesign-skill`, `creative/output-skill` | rasa visual, audit redesain, disiplin keluaran | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT |
| `creative/impeccable` | arah desain dan kerajinan antarmuka | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache 2.0 |
| `productivity/grill-me`, `productivity/grilling` | interogasi rencana sebelum dibangun | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT |

Daftar lengkap dengan alasan pemasangan ada di `docs/SKILLS.md`.

## Atribusi

Masing-masing karya tetap milik penulisnya. Berkas `LICENSE-*` di folder ini adalah salinan teks
lisensi dari repositori sumber, disertakan karena MIT dan Apache 2.0 mensyaratkannya saat karya
didistribusikan ulang. Tidak ada perubahan isi pada skill pihak ketiga.

## Pemasangan di luar repositori

Hermes dan agen lain membaca skill dari direktori pengguna, bukan dari sini. Untuk memasangnya:

```bash
# Hermes global
cp -r skills/superpowers/*      "$HOME/AppData/Local/hermes/skills/superpowers/"
cp -r skills/creative/*         "$HOME/AppData/Local/hermes/skills/creative/"
cp -r skills/productivity/*     "$HOME/AppData/Local/hermes/skills/productivity/"

# agen yang membaca .claude/skills
mkdir -p .claude/skills && cp -r skills/*/* .claude/skills/
```

Baris terakhir membuat `.claude/skills/` bila alat yang Anda pakai memerlukannya. Folder itu
sengaja tidak disimpan di repositori supaya isi skill tidak ada dua kali.
