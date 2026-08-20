/**
 * Registrasi Agen — perilaku FORM (tanpa submit). Bisa jalan headless & di CI.
 *
 * Kenapa spec ini dipisah dari `registrasi.spec.ts`:
 * reCAPTCHA invisible hanya menghalangi **langkah terakhir** (kirim data), bukan
 * pengisian formnya. Menaruh seluruh alur dalam satu test membuat semua yang bisa
 * diverifikasi ikut tergerbangi oleh captcha — padahal validasi field, dropdown
 * berantai, validasi tipe berkas, tanda tangan canvas, dan dialog konfirmasi
 * semuanya bisa dibuktikan tanpa mengirim apa pun.
 *
 * Konsekuensi yang disengaja: spec ini TIDAK PERNAH membuat pengajuan nyata.
 * Test terakhir berhenti di dialog konfirmasi lalu membatalkannya. Pengiriman
 * sebenarnya + halaman sukses tetap diuji `registrasi.spec.ts` (headed, digerbangi).
 *
 * TC-01 [NEG] Lanjutkan dengan form kosong        → tetap di Step 1
 * TC-02 [+]   Isi data pribadi + Keterangan       → nilai benar-benar tersimpan
 * TC-03 [NEG] Unggah berkas non-gambar (.txt)     → pesan tipe file tidak valid
 * TC-04 [+]   Unggah foto (PNG)                   → tidak ditolak sebagai tipe salah
 * TC-05 [+]   Dropdown sumber informasi           → daftar opsi terbaca & unik
 * TC-06 [+]   Step 1 lengkap → Lanjutkan          → sampai di Step 2
 * TC-07 [+]   Step 2 + tanda tangan → Submit Data → dialog konfirmasi, lalu BATAL
 *
 * Menjalankan:
 *   TEST_BASE_URL=https://situs-uji.example npx playwright test test/web/registrasi-form.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import { RegistrasiPage } from '../../pages/web/RegistrasiPage';
import { dataRegistrasiUnik, type DataRegistrasi } from '../data/registrasi';

test.describe('Registrasi Agen — perilaku form (tanpa submit)', () => {
  test.skip(
    !process.env['TEST_BASE_URL'],
    'TEST_BASE_URL belum diisi — salin .env.example dan arahkan ke lingkungan uji Anda.',
  );

  test.setTimeout(120_000);

  let halaman: RegistrasiPage;
  let data: DataRegistrasi;

  test.beforeEach(async ({ page }) => {
    halaman = new RegistrasiPage(page);
    data = dataRegistrasiUnik();
    await halaman.goto();
  });

  /** Isi seluruh field wajib Step 1 (dipakai TC yang perlu lanjut ke Step 2). */
  async function isiStep1Lengkap(halaman: RegistrasiPage, data: DataRegistrasi) {
    await halaman.isiDataPribadi(
      data.namaLengkap,
      data.nomorWhatsApp,
      data.email,
      data.alamatDomisili,
    );
    await halaman.uploadFotoKTP(data.fotoKTP);
    await halaman.pilihKendaraan(data.kendaraan);
    await halaman.pilihMemilikiSIM(data.memilikiSIM);
    await halaman.pilihSumberInformasi(data.sumberInformasi);
    await halaman.pilihPernahBergabung(data.pernahBergabung);
  }

  // ── TC-01 : form kosong tidak boleh lolos ke step berikutnya ───────────────
  test('TC-01 [NEG] Lanjutkan dengan form kosong — tetap di Step 1', async ({ page }, testInfo) => {
    await halaman.klikLanjutkan();
    await page.waitForTimeout(1000);

    await testInfo.attach('setelah-klik-lanjutkan', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    expect(
      await halaman.diStep1(),
      'Form kosong seharusnya tidak lolos ke Step 2 (validasi field wajib tidak jalan)',
    ).toBe(true);
    expect(await halaman.diStep2(), 'Tidak boleh sudah berada di Step 2').toBe(false);
  });

  // ── TC-02 : nilai yang diisi benar-benar tersimpan di field ────────────────
  test('TC-02 [+] Data pribadi + Keterangan opsional tersimpan di field', async () => {
    await halaman.isiDataPribadi(
      data.namaLengkap,
      data.nomorWhatsApp,
      data.email,
      data.alamatDomisili,
    );
    await halaman.isiKeterangan(data.keterangan);

    // Field "Keterangan" opsional — yang diuji: kalau diisi, nilainya tidak hilang
    // saat form re-render (dropdown di bawahnya memicu re-render).
    expect(await halaman.getKeterangan()).toBe(data.keterangan);
  });

  // ── TC-03 : validasi tipe berkas (client-side) ─────────────────────────────
  test('TC-03 [NEG] Unggah berkas non-gambar — ditolak dengan pesan tipe file', async ({ page }, testInfo) => {
    await halaman.uploadFotoKTP(data.berkasBukanGambar);
    await page.waitForTimeout(2500);

    const adaPesan = await halaman.adaPesanTipeFileTidakValid();
    await testInfo.attach('penolakan-tipe-file', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    expect(
      adaPesan,
      'Berkas .txt harus ditolak dengan pesan tipe file tidak valid (hanya JPEG/JPG/PNG)',
    ).toBe(true);
  });

  // ── TC-04 : berkas gambar yang sah tidak ikut tertolak ─────────────────────
  test('TC-04 [+] Unggah PNG — tidak ditolak sebagai tipe file salah', async ({ page }, testInfo) => {
    await halaman.mulaiUploadFotoKTP(data.fotoKTP);

    // Amati sebentar: yang diuji BUKAN keberhasilan upload di server (tergantung
    // jaringan lingkungan uji), tapi bahwa PNG tidak ditolak validasi tipe file.
    const hasil = await halaman.amatiStateUpload(12_000);
    await testInfo.attach('timeline-upload', {
      body: JSON.stringify(hasil, null, 2),
      contentType: 'application/json',
    });

    expect(
      await halaman.adaPesanTipeFileTidakValid(),
      'PNG tidak boleh ditolak sebagai tipe file tidak valid',
    ).toBe(false);
    expect(
      hasil.munculToastUpload || hasil.munculProgress || hasil.munculBerhasil,
      'Harus ada umpan balik upload (toast/progress/berhasil), bukan diam tanpa tanda',
    ).toBe(true);
  });

  // ── TC-05 : daftar opsi dropdown sumber informasi ──────────────────────────
  test('TC-05 [+] Dropdown sumber informasi — daftar opsi terbaca & tanpa duplikat', async ({}, testInfo) => {
    const opsi = await halaman.ambilSemuaSumberInformasi();
    await testInfo.attach('opsi-sumber-informasi', {
      body: JSON.stringify(opsi, null, 2),
      contentType: 'application/json',
    });

    expect(opsi.length, 'Dropdown sumber informasi tidak boleh kosong').toBeGreaterThan(0);
    expect(new Set(opsi).size, 'Tidak boleh ada opsi duplikat').toBe(opsi.length);
  });

  // ── TC-06 : Step 1 lengkap membawa ke Step 2 ───────────────────────────────
  test('TC-06 [+] Step 1 lengkap → Lanjutkan → sampai di Step 2', async ({ page }, testInfo) => {
    await isiStep1Lengkap(halaman, data);
    await halaman.klikLanjutkan();

    const diStep2 = await halaman.diStep2();
    await testInfo.attach('step-2', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    expect(diStep2, 'Step 1 yang lengkap harus lolos ke Step 2').toBe(true);
  });

  // ── TC-07 : tanda tangan + dialog konfirmasi, lalu dibatalkan ──────────────
  test('TC-07 [+] Tanda tangan → Submit Data → dialog konfirmasi muncul, lalu dibatalkan', async ({ page }, testInfo) => {
    await isiStep1Lengkap(halaman, data);
    await halaman.klikLanjutkan();
    expect(await halaman.diStep2(), 'Harus sudah di Step 2').toBe(true);

    await halaman.pilihPendidikan(data.pendidikan);
    await halaman.pilihPengalaman(data.pengalaman);
    await halaman.buatTandaTangan();

    await halaman.klikSubmitData();
    const adaDialog = await halaman.adaDialogKonfirmasi();
    await testInfo.attach('dialog-konfirmasi', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    expect(adaDialog, 'Submit Data harus memunculkan dialog konfirmasi, bukan langsung mengirim').toBe(true);

    // BATALKAN — spec ini tidak boleh membuat pengajuan nyata.
    await halaman.batalkanDialogKonfirmasi();
    expect(
      await halaman.adaDialogKonfirmasi(),
      'Dialog konfirmasi harus tertutup setelah dibatalkan (data tidak terkirim)',
    ).toBe(false);
  });
});
