// Suite mobilewright - LOGIN AGEN (NEGATIF) pada aplikasi NATIVE Android.
//
// Target     : $MOBILE_APP_PACKAGE (applicationId diambil dari env, lihat config/env.ts).
//              APK tidak disertakan di repo ini; set MOBILE_APK_PATH ke APK Anda.
// Lingkungan : emulator Android (AVD API 30). App di-install + diluncurkan otomatis
//              oleh mobilewright sebelum tiap test (autoAppLaunch).
//
// PRASYARAT (kalau diabaikan, suite hang atau gagal semua):
//   1. App harus dalam keadaan LOGOUT. Saat sesi masih aktif, tab "Akun" membuka
//      halaman profil agen, BUKAN layar login.
//   2. Device OFFLINE (airplane mode) bila build yang dipasang dianggap USANG oleh
//      backend: begitu ada jaringan, Home memunculkan dialog modal "Pembaruan
//      Aplikasi" yang terus muncul kembali dan MEMBLOKIR navigasi ke layar login.
//      Saat offline, version-check gagal -> dialog tidak muncul -> Home tamu bersih.
//      LoginActivity sendiri bebas dari dialog ini, tapi initial launch selalu
//      mendarat di Home. Set manual: `adb shell svc wifi disable && adb shell svc data disable`.
//
// LAYAR LOGIN (LoginActivity) - selector terverifikasi lewat `mobilecli dump ui`:
//   - edt_email     : input "Email/Phone" (username bisa email atau no. HP)
//   - edt_password  : input "Sandi" (tersamar / masked secara default)
//   - btn_login     : tombol "Masuk"
//
// PERILAKU NEGATIF TERVERIFIKASI (capture langsung dari app):
//   - Username kosong (apa pun isi sandi) -> toast "Mohon memasukkan username".
//   - Username terisi, sandi kosong       -> toast "Mohon memasukkan sandi".
//   - Kredensial format valid tapi salah  -> tetap di layar login (tidak terautentikasi).
//        Saat ONLINE muncul toast dari server, TAPI toast tsb TIDAK terekspos di
//        accessibility tree (hanya terlihat visual) - jadi assertion utama adalah
//        "tetap di layar login", bukan teks toast-nya. Ini pembeda penting versus
//        pengujian web, di mana toast bisa dibaca dari DOM.
//   - Sandi selalu tersamar saat diketik.
//
// Cakupan:
//   TC-01 [NEG] Username & sandi kosong -> tolak ("Mohon memasukkan username").
//   TC-02 [NEG] Username terisi, sandi kosong -> tolak ("Mohon memasukkan sandi").
//   TC-03 [NEG] Sandi terisi, username kosong -> tolak ("Mohon memasukkan username").
//   TC-04 [NEG] Kredensial salah (format valid) -> tidak terautentikasi (tetap di login).
//   TC-05 [SEC] Sandi tersamar saat diketik (plaintext tidak tampil).
//   TC-06 [SEC] Bateri SQL injection (banyak payload) -> app tidak crash & tidak login.
//   TC-07 [STRESS] Klik tombol Masuk berkali-kali (rapid) -> app tidak crash, tetap responsif.
import { test, expect } from '@mobilewright/test';
import type { Screen } from '@mobilewright/core';
import { MOBILE } from '../config/env';

const PKG = MOBILE.pkg;
const EDT_EMAIL = `${PKG}:id/edt_email`;
const EDT_PASSWORD = `${PKG}:id/edt_password`;
const BTN_LOGIN = `${PKG}:id/btn_login`;

// Home tamu punya banner carousel auto-scroll sehingga uiautomator kadang
// tak pernah "idle" -> dump accessibility tree balik kosong ("no XML content found in
// uiautomator dump") atau undefined ("Cannot read properties of undefined (reading 'map')").
// Ini error LINGKUNGAN, bukan kegagalan fungsional. Wrapper ini mengulang aksi beberapa
// kali saat kena error dump tsb (memberi carousel waktu untuk dapat frame stabil); error
// lain (mis. elemen memang tak ada) tetap dilempar apa adanya.
async function tahanFlakyDump<T>(aksi: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 6; i++) {
    try {
      return await aksi();
    } catch (e: any) {
      const msg = String((e && e.message) || e);
      const flakyDump = msg.includes('no XML content') || msg.includes("reading 'map'");
      if (!flakyDump) throw e;
      await new Promise((r) => setTimeout(r, 1500)); // beri carousel waktu settle
    }
  }
  return await aksi(); // percobaan terakhir: biarkan error asli muncul kalau masih gagal
}

// Navigasi andal dari Home tamu (guest) ke layar login: tap tab "Akun".
// Tiap langkah dibungkus tahanFlakyDump karena Home + transisi rentan dump kosong.
async function bukaLayarLogin(screen: Screen) {
  // Home tamu menampilkan greeting tanpa nama + kolom "Cari Properti".
  await tahanFlakyDump(() => expect(screen.getByText('Cari Properti', { exact: false })).toBeVisible());
  await tahanFlakyDump(() => screen.getByText('Akun', { exact: true }).tap());
  // Layar login siap: input email & tombol Masuk tampil.
  await tahanFlakyDump(() => expect(screen.getByTestId(EDT_EMAIL)).toBeVisible());
  await expect(screen.getByTestId(BTN_LOGIN)).toBeVisible();
}

// Invarian negatif: setelah percobaan login gagal, user TIDAK terautentikasi —
// form login masih tampil (tombol Masuk + input email belum berpindah ke Home agen).
async function pastikanMasihDiLogin(screen: Screen) {
  await expect(screen.getByTestId(BTN_LOGIN)).toBeVisible();
  await expect(screen.getByTestId(EDT_EMAIL)).toBeVisible();
}

test.describe('Login Agen — Negatif (native Android)', () => {
  test.beforeEach(async ({ screen }) => {
    await bukaLayarLogin(screen);
  });

  // TC-01 — kedua field kosong
  test('TC-01 username & sandi kosong ditolak', async ({ screen }, testInfo) => {
    await screen.getByTestId(BTN_LOGIN).tap();

    // Validasi sisi klien: username divalidasi lebih dulu.
    await expect(screen.getByText('Mohon memasukkan username', { exact: false })).toBeVisible();
    await pastikanMasihDiLogin(screen);

    await testInfo.attach('tc01-kosong', { body: await screen.screenshot(), contentType: 'image/png' });
  });

  // TC-02 — username terisi, sandi kosong
  test('TC-02 sandi kosong ditolak', async ({ screen }, testInfo) => {
    await screen.getByTestId(EDT_EMAIL).fill('agen.uji@example.com');
    await screen.getByTestId(BTN_LOGIN).tap();

    await expect(screen.getByText('Mohon memasukkan sandi', { exact: false })).toBeVisible();
    await pastikanMasihDiLogin(screen);

    await testInfo.attach('tc02-sandi-kosong', { body: await screen.screenshot(), contentType: 'image/png' });
  });

  // TC-03 — sandi terisi, username kosong
  test('TC-03 username kosong ditolak', async ({ screen }) => {
    await screen.getByTestId(EDT_PASSWORD).fill('Rahasia123');
    await screen.getByTestId(BTN_LOGIN).tap();

    await expect(screen.getByText('Mohon memasukkan username', { exact: false })).toBeVisible();
    await pastikanMasihDiLogin(screen);
  });

  // TC-04 — kredensial format valid tapi salah
  test('TC-04 kredensial salah tidak terautentikasi', async ({ screen }, testInfo) => {
    await screen.getByTestId(EDT_EMAIL).fill('bukan.agen@example.com');
    await screen.getByTestId(EDT_PASSWORD).fill('SalahTotal123!');
    await screen.getByTestId(BTN_LOGIN).tap();

    // Tidak boleh masuk ke Home agen — tetap di layar login.
    // (Online: toast "Login failed, check again your email and password" — tak ter-assert
    //  karena toast server tidak ada di accessibility tree; cukup assert tetap di login.)
    await pastikanMasihDiLogin(screen);

    await testInfo.attach('tc04-kredensial-salah', { body: await screen.screenshot(), contentType: 'image/png' });
  });

  // TC-05 — sandi tersamar (security)
  test('TC-05 sandi tersamar saat diketik', async ({ screen }, testInfo) => {
    const plaintext = 'SandiRahasia987';
    await screen.getByTestId(EDT_PASSWORD).fill(plaintext);

    // Plaintext tidak boleh tampil di layar (field menampilkan bullet ••••).
    await expect(screen.getByText(plaintext, { exact: false })).not.toBeVisible();

    await testInfo.attach('tc05-sandi-tersamar', { body: await screen.screenshot(), contentType: 'image/png' });
  });

  // TC-06 — bateri SQL injection (security)
  // Daftar payload SQLi klasik — satu wakil per kelas serangan (auth-bypass/tautology,
  // komentar `--`, UNION-based, stacked query `DROP TABLE`, time-based blind, quote ganda).
  // Payload disuntik ke field USERNAME (Email/Phone) — vektor injeksi auth-bypass yang nyata.
  const SQLI_PAYLOADS = [
    "' OR '1'='1",                       // tautology / auth-bypass
    "' OR '1'='1' --",                   // tautology + komentar
    "admin' --",                         // komentar memotong cek sandi
    "' UNION SELECT NULL,NULL,NULL --",  // UNION-based
    "'; DROP TABLE users; --",           // stacked query destruktif
    "1' AND SLEEP(5) --",                // time-based blind
    "\" OR \"\"=\"",                     // varian quote ganda
  ];

  test('TC-06 bateri SQL injection tidak login & tidak crash', async ({ screen }, testInfo) => {
    // PERFORMA: tiap fill/tap membaca accessibility tree (mahal di emulator lambat). Untuk
    // muat di timeout per-test, sandi diisi SEKALI (payload disuntik di username saja) dan
    // TIDAK ada assertion per-iterasi — kalau ada payload yang bikin app crash, fill()/tap()
    // iterasi berikutnya otomatis gagal. Invarian "tidak login & tidak crash" dicek di akhir.
    await screen.getByTestId(EDT_PASSWORD).fill('Sandi#Dummy123');
    for (const payload of SQLI_PAYLOADS) {
      await screen.getByTestId(EDT_EMAIL).fill(payload);
      await screen.getByTestId(BTN_LOGIN).tap();
    }

    // Setelah semua payload: app tetap hidup & tidak terautentikasi (masih di layar login).
    await pastikanMasihDiLogin(screen);

    await testInfo.attach('tc06-sql-injection', { body: await screen.screenshot(), contentType: 'image/png' });
  });

  // TC-07 — stress: klik tombol Masuk berkali-kali (rapid double/multi-submit)
  test('TC-07 klik Masuk berkali-kali tidak membuat app crash', async ({ screen }, testInfo) => {
    await screen.getByTestId(EDT_EMAIL).fill('bukan.agen@example.com');
    await screen.getByTestId(EDT_PASSWORD).fill('SalahTotal123!');

    // Tekan tombol Masuk beruntun (simulasi user tidak sabar / double-submit).
    const KLIK = 12;
    for (let i = 0; i < KLIK; i++) {
      await screen.getByTestId(BTN_LOGIN).tap();
    }

    // App tetap hidup & responsif: layar login masih tampil (tidak crash / tidak ANR).
    await pastikanMasihDiLogin(screen);

    await testInfo.attach('tc07-rapid-click', { body: await screen.screenshot(), contentType: 'image/png' });
  });
});
