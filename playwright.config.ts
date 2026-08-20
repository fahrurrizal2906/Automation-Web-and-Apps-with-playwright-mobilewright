import { defineConfig, devices } from '@playwright/test';

/**
 * Konfigurasi Playwright untuk suite WEB.
 *
 * Pemilihan project di sini dipetakan ke FOLDER (`testDir` per project), bukan ke
 * daftar `testMatch` yang panjang. Alasannya pengalaman lapangan: dengan daftar
 * allowlist/denylist manual, spec mobile-web yang lupa didaftarkan ikut jalan di
 * project desktop dan gagal dengan alasan yang menyesatkan. Dengan pemetaan folder,
 * lokasi file menentukan viewport-nya: test/web → desktop, test/mobile → Pixel 5.
 *
 * Runner mobile NATIVE tidak diatur di sini — lihat mobilewright.config.ts.
 * Playwright hanya men-scan `test/`, mobilewright men-scan `test-mobile-native/`,
 * jadi kedua runner tidak saling bentrok.
 */
export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  // Lingkungan uji pihak ketiga mudah kena rate limit → CI dibatasi 1 worker.
  workers: process.env['CI'] ? 1 : undefined,
  retries: process.env['CI'] ? 1 : 0,
  timeout: 120_000,
  reporter: [['line'], ['allure-playwright', { outputFolder: 'allure-results' }]],
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'on',
    trace: 'retain-on-failure',
    launchOptions: {
      // Mengurangi sinyal otomasi yang paling gampang dideteksi + mematikan
      // popup blocker yang bikin flow login modal jadi flaky.
      args: ['--disable-blink-features=AutomationControlled', '--disable-popup-blocking'],
    },
  },
  projects: [
    {
      name: 'chromium',
      testDir: './test/web',
      use: {
        ...devices['Desktop Chrome'],
        // USE_CHROME_CHANNEL=true → pakai Chrome asli, bukan Chromium bundled.
        // Dipakai flow ber-reCAPTCHA: skor Chromium bundled sering ditolak.
        ...(process.env['USE_CHROME_CHANNEL'] ? { channel: 'chrome' } : {}),
      },
    },
    {
      // Emulasi mobile-web (viewport Pixel 5). Taruh spec mobile-web di test/mobile/.
      name: 'chromium-mobile',
      testDir: './test/mobile',
      use: {
        ...devices['Pixel 5'],
        ...(process.env['USE_CHROME_CHANNEL'] ? { channel: 'chrome' } : {}),
      },
    },
  ],
});
