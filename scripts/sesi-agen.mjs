#!/usr/bin/env node
/**
 * Pindahkan sesi agen (`storageState`) antara berkas lokal dan secret CI.
 *
 *   node scripts/sesi-agen.mjs ke-base64     # cetak base64 → tempel ke secret
 *   node scripts/sesi-agen.mjs dari-base64   # tulis berkas sesi dari env di CI
 *
 * Kenapa base64: storageState adalah JSON multi-baris. Secret GitHub menyimpan
 * nilai apa pun, tapi JSON mentah gampang rusak saat lewat shell/YAML — base64
 * satu baris menghilangkan seluruh kelas masalah itu.
 *
 * Isi berkas ini adalah token sesi NYATA. Ia ada di .gitignore, dan di CI hanya
 * boleh datang dari secret (`AGENT_STORAGE_STATE_B64`), bukan dari repo.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const BERKAS =
  process.env['TEST_AGENT_STORAGE_STATE'] ?? join(process.cwd(), 'playwright', '.auth', 'agen.json');
const NAMA_ENV = 'AGENT_STORAGE_STATE_B64';
const perintah = process.argv[2];

if (perintah === 'ke-base64') {
  if (!existsSync(BERKAS)) {
    console.error(`✖ ${BERKAS} tidak ada. Jalankan dulu: npm run auth:agen`);
    process.exit(1);
  }
  const b64 = readFileSync(BERKAS).toString('base64');
  console.error(`# Tempel nilai di bawah ke secret ${NAMA_ENV} (${b64.length} karakter):\n`);
  console.log(b64);
  process.exit(0);
}

if (perintah === 'dari-base64') {
  const b64 = process.env[NAMA_ENV];
  if (!b64 || b64.trim() === '') {
    // Bukan error: tanpa sesi, spec pasca-login akan SKIP dengan alasan jelas.
    console.log(`ℹ ${NAMA_ENV} tidak diset — lanjut tanpa sesi agen (spec terkait akan skip).`);
    process.exit(0);
  }
  let isi;
  try {
    isi = Buffer.from(b64, 'base64').toString('utf8');
    JSON.parse(isi); // gagal cepat kalau secret-nya rusak/terpotong
  } catch (e) {
    console.error(`✖ ${NAMA_ENV} bukan base64 dari JSON storageState yang sah: ${e.message}`);
    process.exit(1);
  }
  mkdirSync(dirname(BERKAS), { recursive: true });
  writeFileSync(BERKAS, isi);
  console.log(`✔ Sesi agen dipulihkan ke ${BERKAS} (${isi.length} byte)`);
  process.exit(0);
}

console.error('Pemakaian: node scripts/sesi-agen.mjs <ke-base64|dari-base64>');
process.exit(1);
