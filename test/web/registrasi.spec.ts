import { test, expect } from '@playwright/test';
import fs from 'fs';
import { RegistrasiPage } from '../../pages/web/RegistrasiPage';
import { LABEL } from '../../config/env';

function generateTestData() {
  const timestamp = Date.now();

  return {
    namaLengkap: 'rini',
    nomorWhatsApp: `0812${timestamp.toString().slice(-7)}`,
    email: `rini.test${timestamp}@gmail.com`,
    alamatDomisili: 'Jl unda',
    keterangan: `Keterangan uji otomatis ${timestamp}`,
    fotoKTP: 'fixtures/sample-id-card.png', // fixture sintetis (bukan dokumen nyata)
    kendaraan: 'Motor',
    memilikiSIM: 'Tidak',
    sumberInformasi: LABEL.sumberInformasi,
    pernahBergabung: 'Tidak',
    pendidikan: 'D3',
    pengalaman: 'Fresh Graduate',
  };
}

test.describe('Registrasi Agen — happy path (web)', () => {
  let registrasiPage: RegistrasiPage;

  test.skip(
    !process.env['TEST_BASE_URL'],
    'TEST_BASE_URL belum diisi — salin .env.example dan arahkan ke lingkungan uji Anda.',
  );

  test.beforeEach(async ({ page }) => {
    registrasiPage = new RegistrasiPage(page);
    await registrasiPage.goto();
  });

  test.afterEach(async ({ page }, testInfo) => {
    const videoPath = await page.video()?.path();
    if (videoPath) {
      await page.close(); // pastikan video selesai ditulis
      testInfo.attach('video', {
        path: videoPath,
        contentType: 'video/webm',
      });
    }
  });

  test('berhasil mendaftar sebagai agent baru', async ({ page }, testInfo) => {
    // reCAPTCHA invisible selalu men-challenge bot di runner headless -> skip default.
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
    const isCI = Boolean(env.CI);
    const forceRun = env.FORCE_RUN_RECAPTCHA === 'true';
    test.skip(isCI && !forceRun, 'Skip default di CI (reCAPTCHA). Override via FORCE_RUN_RECAPTCHA=true.');

    const testData = generateTestData();

    await test.step('Generate test data dinamis', async () => {
      console.log(`Email: ${testData.email} | WA: ${testData.nomorWhatsApp}`);
    });

    await test.step('Step 1: Isi data pribadi', async () => {
      await registrasiPage.isiDataPribadi(
        testData.namaLengkap,
        testData.nomorWhatsApp,
        testData.email,
        testData.alamatDomisili,
      );
    });

    await test.step('Step 1: Isi field Keterangan (opsional)', async () => {
      await registrasiPage.isiKeterangan(testData.keterangan);
      // Verifikasi field benar-benar terisi
      expect(await registrasiPage.getKeterangan()).toBe(testData.keterangan);
    });

    await test.step('Step 1: Upload foto KTP', async () => {
      await registrasiPage.uploadFotoKTP(testData.fotoKTP);
    });

    await test.step('Step 1: Pilih kendaraan, SIM, sumber informasi, pernah bergabung', async () => {
      await registrasiPage.pilihKendaraan(testData.kendaraan);
      await registrasiPage.pilihMemilikiSIM(testData.memilikiSIM);
      await registrasiPage.pilihSumberInformasi(testData.sumberInformasi);
      await registrasiPage.pilihPernahBergabung(testData.pernahBergabung);
    });

    await test.step('Step 1: Lanjut ke step berikutnya', async () => {
      await registrasiPage.klikLanjutkan();
    });

    await test.step('Step 2: Pilih pendidikan dan pengalaman', async () => {
      await registrasiPage.pilihPendidikan(testData.pendidikan);
      await registrasiPage.pilihPengalaman(testData.pengalaman);
    });

    await test.step('Step 2: Buat tanda tangan', async () => {
      await registrasiPage.buatTandaTangan();
    });

    await test.step('Step 2: Klik Submit Data dan verifikasi dialog konfirmasi', async () => {
      await registrasiPage.klikSubmitData();
      await expect(page.getByRole('button', { name: 'Setuju' })).toBeVisible({ timeout: 10000 });

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Dialog Konfirmasi', {
        body: screenshot,
        contentType: 'image/png',
      });
    });

    await test.step('Step 3: Klik Setuju dan verifikasi mengarah ke halaman berhasil mendaftar', async () => {
      await registrasiPage.klikSetuju();

      const hasil = await registrasiPage.tungguHalamanBerhasil();
      console.log(`Halaman sukses URL: ${hasil.url}`);
      console.log(`Teks sukses: ${hasil.teksSukses}`);

      // Verifikasi indikator halaman berhasil mendaftar (regex strict — bukan toast upload)
      await expect(
        page
          .getByText(
            /Pendaftaran Berhasil|Terima Kasih|Selamat Bergabung|Berhasil Mendaftar|Pendaftaran Anda Telah Diterima|Registrasi Berhasil|Pendaftaran Sukses/i
          )
          .first(),
        'Halaman harus menampilkan teks indikasi berhasil mendaftar'
      ).toBeVisible({ timeout: 15000 });

      const screenshot = await page.screenshot({ fullPage: true });
      await testInfo.attach('Expected Result - Halaman Berhasil Mendaftar', {
        body: screenshot,
        contentType: 'image/png',
      });
    });
  });
});
