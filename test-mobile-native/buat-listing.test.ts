// Suite mobilewright (NATIVE Android) - BUAT/CREATE LISTING oleh agen.
//
// Target : $MOBILE_APP_PACKAGE (applicationId dari env, lihat config/env.ts). APK tidak
//          disertakan di repo ini - set MOBILE_APK_PATH ke APK milik Anda.
//          App di-install + diluncurkan otomatis oleh mobilewright (autoAppLaunch) dan
//          selalu mendarat di Home tamu, jadi tiap test login ulang sebagai agen uji.
// Konfig : mobilewright.config.ts. Page object: pages/mobile/BuatListingMobilePage.ts.
//
// PRASYARAT (WAJIB):
//   1. ONLINE + build yang lolos version-check. Build usang membuat Home memunculkan
//      dialog "Pembaruan Aplikasi" yang memblokir navigasi.
//   2. APK ter-install dengan `adb install -r -g` (grant izin runtime).
//   3. Galeri emulator SUDAH di-seed dengan foto (untuk TC upload). Catatan lapangan:
//      di Android 11/API 30 broadcast MEDIA_SCANNER_SCAN_FILE NO-OP, jadi seed harus
//      memakai `content call scan_volume`.
//
// JALUR: Login agen -> tab "Propertiku" -> FAB "+" (btn_add_listing, pojok kanan bawah)
//   -> form "Tambah properti" (wizard 4 step). Alur form disamakan dengan versi web
//   di pages/web/BuatListingPage.ts sehingga cakupan lintas platform bisa dibandingkan.
//
// CAKUPAN:
//   TC-00 [smoke]  Login -> Propertiku -> FAB "+" -> form Create Listing terbuka.
//   TC-01 [+]      Upload 1 foto dari galeri -> slot foto terisi.
//   TC-02 [NEG]    Submit step 1 tanpa foto -> ditolak ("Mohon unggah minimal 1 foto").
//                  Catatan: "Selanjutnya" ada di dasar form panjang -> perlu scroll
//                  (banyak dump uiautomator). Di emulator lambat, scroll bisa kena
//                  timeout -> di-redam retries di config; bukan bug kode uji.
//   TC-03 [+]      (GUARDED) Buat listing penuh step 1-4 + submit - membuat data NYATA.
//                  Set RUN_BUAT_LISTING_SUBMIT=1 untuk mengaktifkan.
//                  Catatan tooling: saat memilih Tipe Transaksi "Jual", form menyisipkan
//                  field "Harga Jual" (re-render). Pada titik ini agent on-device
//                  mobilewright pernah konsisten menutup WebSocket-nya
//                  ("WebSocket connection closed code=1005") -> operasi berikutnya hang.
//                  Implementasi step 1-4 sudah lengkap & helper sudah resilient.
import { test, expect } from '@mobilewright/test';
import {
  BuatListingMobilePage,
  KREDENSIAL_DEFAULT,
  SEL,
} from '../pages/mobile/BuatListingMobilePage';

// Guard TC yang melakukan SUBMIT (membuat data nyata di lingkungan target).
const RUN_SUBMIT = process.env['RUN_BUAT_LISTING_SUBMIT'] === '1';

test.describe('Buat Listing — Agen (native Android)', () => {
  // Tanpa kredensial agen di env, seluruh TC di-skip (bukan gagal palsu).
  test.skip(
    !KREDENSIAL_DEFAULT.username || !KREDENSIAL_DEFAULT.password,
    'TEST_AGENT_USERNAME / TEST_AGENT_PASSWORD belum diisi — lihat .env.example.',
  );

  test('TC-00 [smoke] login agen → Propertiku → FAB → form Create Listing terbuka', async ({
    screen,
  }, testInfo) => {
    const app = new BuatListingMobilePage(screen);
    await app.loginAgen(KREDENSIAL_DEFAULT, expect);
    await app.tutupPopupPromo();
    await app.bukaFormBuatListing(expect);
    await app.pastikanFormTerbuka(expect);

    await testInfo.attach('form-create-listing', {
      body: await screen.screenshot(),
      contentType: 'image/png',
    });
  });

  test('TC-01 [+] upload 1 foto dari galeri → slot foto terisi', async ({ screen }, testInfo) => {
    const app = new BuatListingMobilePage(screen);
    await app.loginAgen(KREDENSIAL_DEFAULT, expect);
    await app.tutupPopupPromo();
    await app.bukaFormBuatListing(expect);

    await app.uploadFoto(expect, 1);

    await testInfo.attach('foto-terupload', {
      body: await screen.screenshot(),
      contentType: 'image/png',
    });
  });

  test('TC-02 [NEG] submit step 1 tanpa foto ditolak', async ({ screen }, testInfo) => {
    const app = new BuatListingMobilePage(screen);
    await app.loginAgen(KREDENSIAL_DEFAULT, expect);
    await app.tutupPopupPromo();
    await app.bukaFormBuatListing(expect);

    // Tekan "Selanjutnya" tanpa mengisi apa pun → validasi foto muncul.
    await app.tekanSelanjutnya();
    await expect(
      screen.getByText('Mohon unggah minimal 1 foto', { exact: false }),
    ).toBeVisible();

    await testInfo.attach('validasi-foto-wajib', {
      body: await screen.screenshot(),
      contentType: 'image/png',
    });
  });

  test('TC-03 [+] buat listing penuh + submit (data nyata)', async ({ screen }, testInfo) => {
    test.skip(
      !RUN_SUBMIT,
      'Submit membuat listing NYATA di lingkungan target. Set RUN_BUAT_LISTING_SUBMIT=1 ' +
        'untuk menjalankan, dan pastikan akun uji memang boleh membuat data.',
    );

    const app = new BuatListingMobilePage(screen);
    await app.loginAgen(KREDENSIAL_DEFAULT, expect);
    await app.bukaFormBuatListing(expect);

    // ── STEP 1 — Info Umum ─────────────────────────────────────────────────────
    await app.uploadFoto(expect, 1);
    await app.isiTeks(SEL.tieTitle, 'QA OTOMASI - MOBILE NATIVE - Rumah Test');
    // Deskripsi WAJIB ≥120 karakter.
    await app.isiTeks(
      SEL.tieDesc,
      'Listing uji otomasi mobile native. Data uji bukan listing asli, mohon jangan ' +
        'dipublikasikan. Lokasi contoh dekat fasilitas umum untuk keperluan pengujian.',
    );
    await app.pilihRadio(SEL.rvTransactionType, 'Jual');
    await app.isiTeks(SEL.tieSellPrice, '500000000');
    await app.pilihRadio(SEL.rvGrupListing, 'Secondary');
    await app.pilihPicker(SEL.slType, 'Rumah');
    await app.isiTeks(SEL.tieComission, '2');
    await app.pilihRadio(SEL.rvCanKpr, 'Ya');
    await app.pilihRadio(SEL.rvImb, 'Ya');
    await app.pilihRadio(SEL.rvBlueprint, 'Ya');
    await app.pilihRadio(SEL.rvTypeListing, 'Open');
    await app.pilihRadio(SEL.rvCanBanner, 'Tidak'); // "Ya" memunculkan sub-form banner wajib
    await app.pilihPicker(SEL.slLegalDoc, 'SHM');
    await app.tekanSelanjutnya();

    // ── STEP 2 — Detail Properti ───────────────────────────────────────────────
    await app.pilihPicker(SEL.slCountry, 'Indonesia');
    await app.pilihPicker(SEL.slProvince, 'Jawa Timur', { search: true });
    await app.pilihPicker(SEL.slCity, 'Surabaya', { search: true });
    await app.pilihPicker(SEL.slArea, 'Veteran');
    await app.isiTeks(SEL.tieAddress, 'Jalan Pengujian Otomasi No 1');
    await app.isiTeks(SEL.tieNumber, 'Blok A/1');
    await app.isiTeks(SEL.tieLt, '100');
    await app.isiTeks(SEL.tieLb, '80');
    await app.isiTeks(SEL.tieKt, '3');
    await app.isiTeks(SEL.tieKm, '2');
    await app.pilihPicker(SEL.slElectricity, '2200');
    await app.pilihPicker(SEL.slWater, 'PDAM');
    await app.tekanSelanjutnya();

    // ── STEP 3 — Info Tambahan (Vendor) ────────────────────────────────────────
    await app.isiTeksPlaceholder('Masukkan nama vendor', 'Vendor Otomasi QA');
    await app.isiTeksPlaceholder('Contoh: 0813xxxxx', '081234567890');
    await app.tekanSelanjutnya(); // → step 4 Konfirmasi

    // ── STEP 4 — Konfirmasi → SUBMIT (listing nyata di PROD) ────────────────────
    await app.submitFinal(expect, testInfo);
  });
});
