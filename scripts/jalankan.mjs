#!/usr/bin/env node
/**
 * Runner tipis: jalankan test lalu SELALU generate Allure report — juga saat test
 * gagal, karena laporan kegagalan justru yang paling dibutuhkan.
 *
 * Kenapa tidak cukup `playwright test ... ; allure generate` di package.json:
 * npm di Windows menjalankan script lewat cmd.exe, dan `;` bukan operator chain
 * di cmd (sedangkan `&&` melewatkan report saat test gagal). Runner ini bikin
 * perilakunya sama di Windows, macOS, dan Linux.
 *
 *   node scripts/jalankan.mjs [--mobile] [argumen runner...]
 *
 *   --mobile   pakai runner mobilewright (suite native) alih-alih Playwright
 */
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const mobile = argv.includes('--mobile');
const argsRunner = argv.filter((a) => a !== '--mobile');

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
// Windows: Node 20+ menolak menjalankan .cmd tanpa shell (perbaikan CVE-2024-27980),
// dan kegagalannya SENYAP kalau `error`/`status` tidak diperiksa — gejalanya "test
// jalan tapi tidak ada output sama sekali". Karena itu shell dinyalakan di win32
// dan hasil spawn selalu diperiksa.
const opsi = { stdio: 'inherit', shell: process.platform === 'win32' };

function jalankan(label, args) {
  console.log(`\n▶ ${label}\n`);
  const hasil = spawnSync(npx, args, opsi);
  if (hasil.error) {
    console.error(`✖ Gagal menjalankan ${label}: ${hasil.error.message}`);
    return 1;
  }
  return hasil.status ?? 1;
}

const runner = mobile ? ['mobilewright', 'test'] : ['playwright', 'test'];
const statusTest = jalankan(
  `${mobile ? 'mobilewright' : 'playwright'} test ${argsRunner.join(' ')}`.trim(),
  [...runner, ...argsRunner],
);

const statusReport = jalankan('allure generate (selalu, termasuk saat test gagal)', [
  'allure',
  'generate',
  'allure-results',
  '--clean',
  '-o',
  'allure-report',
]);

if (statusReport !== 0) {
  console.error('⚠ Allure report gagal digenerate — cek apakah allure-results kosong.');
}

// Exit code mengikuti hasil TEST, bukan hasil generate report.
process.exit(statusTest);
