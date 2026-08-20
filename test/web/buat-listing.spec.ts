import { test, expect } from '@playwright/test';
import { AgentLoginPage } from '../../pages/web/AgentLoginPage';
import { BuatListingPage, ListingData } from '../../pages/web/BuatListingPage';
import { AGENT, punyaKredensialAgen } from '../../config/env';

// Kredensial agen HANYA dari env (TEST_AGENT_USERNAME / TEST_AGENT_PASSWORD).
// Repo ini publik — tidak ada kredensial yang dihardcode.

// Data listing yang akan dibuat
const LISTING_DATA: ListingData = {
  fotoPaths: [
    'fixtures/sample-property.png', // fixture sintetis, lihat scripts/buat-fixture.mjs
  ],
  judul: 'Rumah Murah dijual',
  deskripsi:
    'Rumah dengan luas 100m2 dekat dengan fasilitas umum yang bisa di manfaatkan dan juga murah sekali, jauh dari harga pasaran, baru di renov jadi tinggal menempati saja tanpa renov',
  hargaJual: '700.000.0000',
  grupListing: 'Secondary',
  tipeProperti: 'Rumah',
  komisi: '1,5',
  statusListing: 'OPEN',
  dokumenLegal: 'Sertifikat Hak Milik',
  negara: 'Indonesia',
  provinsi: 'Jawa Timur',
  kota: 'Surabaya',
  area: 'Sukolilo',
  alamat: 'Jl baru no 33',
  blokNomor: 'blok ab no 2',
  arahHadap: 'Timur',
  luasTanah: '100',
  luasBangunan: '150',
  kamarTidur: '2',
  kamarMandi: '3',
  lebarProperti: '10',
  panjangProperti: '10',
  dayaListrik: '7700 Watt',
  jenisAir: 'PDAM',
  namaVendor: 'tes',
  noTelpVendor: '09839444444',
};

test.describe('Buat Listing — Agen (web dashboard)', () => {
  test.setTimeout(600000); // 10 menit — flow form lengkap (foto + 6 step + submit)

  let loginPage: AgentLoginPage;
  let listingPage: BuatListingPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new AgentLoginPage(page);
    listingPage = new BuatListingPage(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    const videoPath = await page.video()?.path();
    if (videoPath) {
      await page.close();
      testInfo.attach('Recording', {
        path: videoPath,
        contentType: 'video/webm',
      });
    }
  });

  test('Berhasil membuat listing baru dan muncul di daftar listing', async ({ page }, testInfo) => {
    // reCAPTCHA invisible menolak Chromium headless di runner CI -> skip default.
    // Override: FORCE_RUN_RECAPTCHA=true (di CI dijalankan headed via xvfb-run).
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
    const isCI = Boolean(env.CI);
    const forceRun = env.FORCE_RUN_RECAPTCHA === 'true';
    test.skip(!process.env['TEST_BASE_URL'], 'TEST_BASE_URL belum diisi.');
    test.skip(!punyaKredensialAgen, 'TEST_AGENT_USERNAME / TEST_AGENT_PASSWORD belum diisi.');
    test.skip(isCI && !forceRun, 'Skip default di CI (reCAPTCHA). Override via FORCE_RUN_RECAPTCHA=true.');

    await test.step('Login sebagai agen', async () => {
      await loginPage.goto();
      await loginPage.login(AGENT.username, AGENT.password);

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Setelah Login', { body: screenshot, contentType: 'image/png' });
    });

    await test.step('Navigasi ke dashboard agen dan buka form buat listing', async () => {
      await listingPage.navigasiKeDashboard(AGENT.username, AGENT.password);
      await listingPage.bukaFormBuatListing();

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Form Buat Listing', { body: screenshot, contentType: 'image/png' });
    });

    await test.step('Upload foto listing', async () => {
      await listingPage.uploadFotoListing(LISTING_DATA.fotoPaths);

      // Expected: foto harus menampilkan "Sukses Upload" sebagai konfirmasi upload berhasil
      await expect(
        page.getByText('Sukses Upload').first(),
        'Foto listing harus menampilkan "Sukses Upload" setelah berhasil diupload'
      ).toBeVisible({ timeout: 30000 });

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Foto Terupload', { body: screenshot, contentType: 'image/png' });
    });

    await test.step('Isi informasi dasar listing', async () => {
      await listingPage.isiInfoDasar(LISTING_DATA);

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Info Dasar Terisi', { body: screenshot, contentType: 'image/png' });
    });

    await test.step('Isi lokasi properti', async () => {
      await listingPage.isiLokasi(LISTING_DATA);

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Lokasi Terisi', { body: screenshot, contentType: 'image/png' });
    });

    await test.step('Isi spesifikasi properti', async () => {
      await listingPage.isiSpesifikasi(LISTING_DATA);

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Spesifikasi Terisi', { body: screenshot, contentType: 'image/png' });
    });

    await test.step('Isi data vendor', async () => {
      await listingPage.isiVendor(LISTING_DATA);

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Vendor Terisi', { body: screenshot, contentType: 'image/png' });
    });

    await test.step('Submit listing', async () => {
      await listingPage.submitListing();
      await page.waitForLoadState('domcontentloaded');

      // Cek success message / toast notification
      const successMsg = await listingPage.getSuccessMessage();
      if (successMsg) {
        console.log('Success message:', successMsg);
        await testInfo.attach('Success Message', {
          body: successMsg,
          contentType: 'text/plain',
        });
      }

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Setelah Submit', { body: screenshot, contentType: 'image/png' });
    });

    await test.step('Expected Result: Listing berhasil dibuat dan muncul di daftar listing', async () => {
      await listingPage.verifikasiListingBerhasil(LISTING_DATA.judul);

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Expected Result - Listing Muncul di Daftar', {
        body: screenshot,
        contentType: 'image/png',
      });

      // Verifikasi judul listing muncul di halaman listing (case-insensitive, ambil first)
      await expect(
        page.getByText(LISTING_DATA.judul, { exact: false }).first(),
        `Listing "${LISTING_DATA.judul}" harus muncul di daftar listing`
      ).toBeVisible({ timeout: 15000 });
    });
  });
});
