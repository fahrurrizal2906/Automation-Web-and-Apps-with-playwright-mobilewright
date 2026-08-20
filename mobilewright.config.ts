import { defineConfig } from 'mobilewright';
import { MOBILE } from './config/env';

/**
 * Konfigurasi automation mobile NATIVE (mobilewright) — terpisah dari Playwright.
 * Playwright hanya men-scan `test/`, mobilewright men-scan `test-mobile-native/`,
 * jadi kedua runner tidak bentrok.
 *
 *   npx mobilewright test        jalankan suite native
 *   npx mobilewright devices     cek device/emulator yang terdeteksi
 *   npx mobilewright doctor      cek prasyarat (adb, mobilecli, dsb.)
 *
 * Target aplikasi (applicationId, APK, nama device) diambil dari environment —
 * lihat `.env.example`. APK TIDAK disertakan di repo ini.
 */
export default defineConfig({
  testDir: 'test-mobile-native',

  // --- Target aplikasi ------------------------------------------------------
  platform: 'android',
  bundleId: MOBILE.pkg,
  // PENTING: cocokkan ke `name` yang DILAPORKAN mobilecli (`mobilecli devices`),
  // BUKAN nama AVD. Emulator berjalan melaporkan name = model (mis. "sdk_gphone_x86"),
  // bukan "Pixel_2_API_30". Regex yang tak match → NoDeviceAvailableError, dan
  // mobilewright HANG diam-diam di fase "setting up device" (bukan error jelas).
  deviceName: MOBILE.deviceName,
  // APK di-install ulang tiap run supaya state bersih.
  installApps: MOBILE.apk,

  // --- Perilaku run --------------------------------------------------------
  // 300 dtk: fase "setup device" (install APK + launch + tunggu foreground) berat di
  // emulator tanpa akselerasi hardware. Jalur login FRESH (sesudah install baru) jauh
  // lebih panjang — Home tamu → tab Akun → LoginActivity → isi kredensial → Home agen
  // → popup promo — dan sempat menembus 180 dtk. Turunkan lagi bila hypervisor aktif.
  timeout: 300_000,
  // Assertion default mobilewright 5 dtk — terlalu pendek untuk emulator lambat yang
  // relaunch app tiap test (konten Home render bertahap).
  expect: { timeout: 30_000 },
  // Aksi (tap/fill) default 5 dtk — terlalu pendek setelah relaunch app → tap flaky.
  // CATATAN: `actionTimeout` HANYA dikenali di dalam `use` (MobilewrightUseOptions).
  // Ditulis di level atas, TypeScript menolaknya dan runner memakai default 5 dtk —
  // gejalanya tap flaky yang mudah disalahartikan sebagai bug aplikasi.
  use: { actionTimeout: 15_000 },
  // Home punya banner carousel auto-scroll → pembacaan accessibility tree kadang
  // menangkap state transisi. retries meredam flake LINGKUNGAN ini (bukan bug produk).
  retries: process.env['CI'] ? 2 : 3,
  viewTree: 'on-failure', // lampirkan accessibility tree saat test gagal

  // mobilewright berbasis Playwright, jadi reporter Playwright bisa dipakai.
  // Hasil menumpuk di allure-results/ → `npm run report:generate`.
  reporter: [['line'], ['allure-playwright', { resultsDir: 'allure-results' }]],
});
