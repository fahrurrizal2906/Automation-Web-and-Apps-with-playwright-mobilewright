/**
 * Setup: login sekali secara HEADED lalu simpan sesi agen ke `storageState`.
 *
 * Latar belakangnya: reCAPTCHA invisible menolak sesi otomatis di langkah LOGIN,
 * tapi tidak melindungi form-form setelah login. Jadi login dilakukan sekali di
 * mesin lokal (headed + Chrome asli, yang lolos captcha), sesinya disimpan, dan
 * spec pasca-login memakainya untuk jalan HEADLESS — termasuk di CI.
 *
 *   npm run auth:agen                    # simpan sesi (butuh Chrome asli)
 *   npm run sesi:base64                  # cetak base64 untuk ditaruh di secret CI
 *
 * Berkas hasilnya berisi token sesi NYATA: ada di .gitignore dan tidak boleh
 * di-commit. Sesi juga punya masa kedaluwarsa, jadi perlu dibuat ulang berkala —
 * pendekatan ini cocok untuk run manual/dispatch, bukan untuk cron harian.
 */
import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { AgentLoginPage } from '../../pages/web/AgentLoginPage';
import { AGENT, SESI_AGEN_FILE, punyaKredensialAgen } from '../../config/env';

setup('simpan sesi agen ke storageState', async ({ page }) => {
  setup.skip(!process.env['TEST_BASE_URL'], 'TEST_BASE_URL belum diisi.');
  setup.skip(
    !punyaKredensialAgen,
    'TEST_AGENT_USERNAME / TEST_AGENT_PASSWORD belum diisi — lihat .env.example.',
  );
  setup.setTimeout(240_000);

  const login = new AgentLoginPage(page);
  await login.goto();
  await login.login(AGENT.username, AGENT.password);

  // Jangan simpan sesi yang sebenarnya gagal login: reCAPTCHA bisa menolak
  // secara DIAM-DIAM (tanpa toast, URL tetap di login). Menyimpannya akan
  // menghasilkan storageState kosong yang membuat spec lain gagal dengan
  // alasan yang menyesatkan.
  expect(
    await login.isStillOnLoginContext(),
    'Login tidak berhasil — kemungkinan reCAPTCHA menolak. Jalankan headed dengan Chrome asli.',
  ).toBe(false);

  fs.mkdirSync(path.dirname(SESI_AGEN_FILE), { recursive: true });
  await page.context().storageState({ path: SESI_AGEN_FILE });

  const isi = JSON.parse(fs.readFileSync(SESI_AGEN_FILE, 'utf8')) as {
    cookies?: unknown[];
    origins?: unknown[];
  };
  expect(
    (isi.cookies?.length ?? 0) + (isi.origins?.length ?? 0),
    'storageState tersimpan tapi kosong — sesi tidak terbentuk',
  ).toBeGreaterThan(0);

  console.log(`Sesi agen disimpan: ${SESI_AGEN_FILE}`);
});
