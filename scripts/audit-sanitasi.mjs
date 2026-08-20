#!/usr/bin/env node
/**
 * Audit sanitasi untuk repo PUBLIK.
 *
 * Repo ini adalah generalisasi dari pekerjaan otomasi nyata. Yang tidak boleh
 * bocor: nama klien/employer, host internal, prefiks tiket, dan kredensial —
 * termasuk di RIWAYAT GIT, bukan hanya di working tree. Sekali ter-push, riwayat
 * hanya bisa dibersihkan dengan menulis ulang history.
 *
 *   npm run audit:sanitasi          # working tree + seluruh riwayat commit
 *
 * Daftar kata terlarang sengaja TIDAK ditulis di dalam skrip ini (menuliskannya
 * di sini justru membocorkannya). Taruh satu pola regex per baris di file
 * `.sanitasi-terlarang` — file itu ada di .gitignore. Lihat contoh formatnya di
 * `.sanitasi-terlarang.example`.
 *
 * Selain daftar itu, skrip selalu memeriksa pola generik: kredensial hardcode,
 * private key, token panjang, dan URL http(s) absolut yang bukan example/localhost.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const POLA_GENERIK = [
  { nama: 'password/secret hardcode', re: /(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"\s]{6,}['"]/i },
  { nama: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nama: 'bearer token panjang', re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  {
    nama: 'URL absolut non-contoh',
    re: /https?:\/\/(?!(?:[\w.-]*\.)?(?:example\.(?:com|org|net)|situs-uji\.example|agen\.situs-uji\.example|localhost|127\.0\.0\.1|github\.com|npmjs\.com|playwright\.dev|allurereport\.org|nodejs\.org|fonts\.googleapis\.com))[\w.-]+/,
  },
];

function polaKustom() {
  if (!existsSync('.sanitasi-terlarang')) return [];
  return readFileSync('.sanitasi-terlarang', 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => ({ nama: 'kata terlarang (daftar lokal)', re: new RegExp(l, 'i'), rahasia: true }));
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  } catch {
    return '';
  }
}

const pola = [...POLA_GENERIK, ...polaKustom()];
const temuan = [];

// --- 1. Working tree (hanya file yang dilacak git) ---------------------------
const berkas = git(['ls-files']).split(/\r?\n/).filter(Boolean);
for (const f of berkas) {
  if (/^scripts\/audit-sanitasi\.mjs$/.test(f)) continue; // skrip ini memuat pola itu sendiri
  let isi = '';
  try {
    isi = readFileSync(f, 'utf8');
  } catch {
    continue; // binary / tak terbaca
  }
  // Lockfile berisi ratusan URL registry npm yang sah — pemeriksaan URL di situ hanya
  // menghasilkan derau. Kata terlarang & kredensial tetap diperiksa.
  const lockfile = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(f);
  isi.split(/\r?\n/).forEach((baris, i) => {
    for (const p of pola) {
      if (lockfile && p.nama === 'URL absolut non-contoh') continue;
      if (p.re.test(baris)) {
        temuan.push({
          lokasi: `${f}:${i + 1}`,
          pola: p.nama,
          kutipan: p.rahasia ? '<disembunyikan>' : baris.trim().slice(0, 120),
        });
      }
    }
  });
}

// --- 2. Riwayat git (semua commit, semua branch) -----------------------------
const riwayat = git(['log', '-p', '--all', '--no-color']);
if (riwayat) {
  let commit = '(awal)';
  riwayat.split(/\r?\n/).forEach((baris) => {
    const m = /^commit ([0-9a-f]{7,40})/.exec(baris);
    if (m) commit = m[1].slice(0, 9);
    if (!baris.startsWith('+') || baris.startsWith('+++')) return;
    for (const p of pola) {
      if (p.re.test(baris)) {
        temuan.push({
          lokasi: `riwayat ${commit}`,
          pola: p.nama,
          kutipan: p.rahasia ? '<disembunyikan>' : baris.slice(1).trim().slice(0, 120),
        });
      }
    }
  });
}

// --- Laporan ----------------------------------------------------------------
if (!existsSync('.sanitasi-terlarang')) {
  console.log(
    'ℹ .sanitasi-terlarang tidak ada — hanya pola generik yang diperiksa.\n' +
      '  Salin .sanitasi-terlarang.example → .sanitasi-terlarang dan isi kata yang harus diblokir.\n',
  );
}

if (temuan.length === 0) {
  console.log(`✔ Bersih. ${berkas.length} berkas terlacak + seluruh riwayat commit diperiksa.`);
  process.exit(0);
}

console.error(`✖ ${temuan.length} temuan:\n`);
for (const t of temuan) console.error(`  ${t.lokasi}\n    [${t.pola}] ${t.kutipan}`);
console.error(
  '\nTemuan di RIWAYAT tidak hilang dengan sekadar mengedit berkas — riwayat harus ditulis ulang\n' +
    '(mis. git filter-repo) SEBELUM push pertama.',
);
process.exit(1);
