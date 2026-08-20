# Portofolio Otomasi QA — Web (Playwright) + Android Native (mobilewright)

Contoh kerja otomasi QA end-to-end untuk sebuah **platform properti**: tiga alur web
(login agen, registrasi agen, buat listing) dan dua suite aplikasi **Android native**
(login agen negatif, buat listing), semuanya melaporkan ke **Allure**.

Fokus repo ini bukan "test yang hijau", melainkan hal-hal yang biasanya menentukan
apakah sebuah suite berguna atau menyesatkan: pemisahan page object vs skenario,
uji negatif dan keamanan yang punya asersi tegas, penanganan flake lingkungan yang
dibedakan dari bug produk, serta test yang **skip dengan alasan jelas** ketimbang
lulus/gagal palsu.

> **Tentang sanitasi.** Kode ini generalisasi dari pekerjaan nyata. Tidak ada nama
> klien, host internal, kredensial, atau APK di dalam repo. Semua target datang dari
> environment variable (lihat [`.env.example`](.env.example)); tanpa `TEST_BASE_URL`
> suite web di-skip dengan pesan yang menjelaskan penyebabnya. Ada pula
> [`npm run audit:sanitasi`](scripts/audit-sanitasi.mjs) yang memeriksa working tree
> **dan seluruh riwayat commit** sebelum push.

---

## Stack

| Lapisan | Alat |
| --- | --- |
| Web E2E | Playwright 1.59 + TypeScript |
| Mobile native (Android) | [mobilewright](https://www.npmjs.com/package/mobilewright) (API bergaya Playwright di atas accessibility tree) |
| Pelaporan | Allure (`allure-playwright` → `allure-report`) |
| CI | GitHub Actions + publikasi report ke GitHub Pages |

## Struktur

```
config/env.ts                 sumber tunggal target uji & label (semua dari env)
pages/web/                    page object web
  AgentLoginPage.ts             login agen: mode modal & mode halaman
  RegistrasiPage.ts             registrasi agen 2 langkah + tanda tangan canvas
  BuatListingPage.ts            wizard buat/edit listing (form terpanjang di repo)
pages/mobile/
  BuatListingMobilePage.ts      page object Android native (resource-id, picker, crop)
test/web/                     spec web  (project: chromium)
test/mobile/                  tempat spec mobile-web (project: chromium-mobile, Pixel 5)
test-mobile-native/           spec Android native (runner mobilewright)
scripts/
  jalankan.mjs                  runner: test → Allure selalu digenerate
  buat-fixture.mjs              membuat fixture gambar sintetis (tanpa dependensi)
  audit-sanitasi.mjs            audit kebocoran di berkas + riwayat git
```

## Cakupan

### Web — Login agen, negatif & keamanan (`test/web/agent-login-negative.spec.ts`)

| TC | Skenario | Asersi inti |
| --- | --- | --- |
| TC-01 | Username & password kosong | atribut `required` ada + `input:invalid` terdeteksi + tidak berpindah konteks |
| TC-02 | Username kosong, password terisi | field invalid adalah username/email |
| TC-03 | Username terisi, password kosong | field invalid adalah password |
| TC-04 | Kredensial whitespace-only | tidak pernah terautentikasi (client trim atau ditolak server, keduanya sah) |
| TC-05 | Kredensial acak | toast error muncul & cocok pola pesan gagal |
| TC-06 | SQL injection di username | tidak ada bypass |
| TC-07 | Payload XSS di username | `window.__pwned` tidak ter-set, tidak ada dialog |
| TC-08 | Kredensial 1500 karakter | halaman tidak crash, field masih responsif |
| TC-09 | 3× gagal berturut-turut | tetap di konteks login setiap kali |
| TC-10 | Tipe field password | `type="password"` |

### Web — Registrasi agen (`test/web/registrasi.spec.ts`)

Happy path 2 langkah dengan data dinamis (email/WA unik per run), upload foto,
dropdown berantai (opsi tertentu memunculkan field wajib baru), **tanda tangan
canvas** yang digambar lewat `mouse.move/down/up`, dialog konfirmasi, sampai
halaman sukses.

### Web — Buat listing (`test/web/buat-listing.spec.ts`)

Login → dashboard agen (SPA) → upload foto (crop & upload) → 4 kelompok field
(info dasar, lokasi berantai, spesifikasi, vendor) → submit → verifikasi listing
muncul di daftar. Page object-nya **adaptif**: field yang tidak muncul untuk tipe
properti tertentu (mis. kamar tidur pada "Tanah") dilewati, bukan bikin gagal.

### Android native — Login agen, negatif & keamanan (`test-mobile-native/login-agen-negatif.test.ts`)

7 TC: dua field kosong, sandi kosong, username kosong, kredensial salah, sandi
tersamar, **bateri 7 payload SQL injection**, dan stress 12× tap tombol Masuk.

Perbedaan penting versus web yang tercermin di asersinya: toast dari server **tidak
terekspos di accessibility tree** (hanya terlihat visual), jadi asersi utamanya
"tetap di layar login", bukan teks toast. Menuntut teks toast di sini akan
menghasilkan test yang gagal karena keterbatasan alat, bukan karena bug.

### Android native — Buat listing (`test-mobile-native/buat-listing.test.ts`)

Smoke (login → Propertiku → FAB → form), upload foto dari galeri, penolakan submit
tanpa foto, dan TC penuh 4 langkah + submit yang **digerbangi**
`RUN_BUAT_LISTING_SUBMIT=1` karena membuat data nyata.

---

## Menjalankan

```bash
npm install
npx playwright install chromium        # browser untuk suite web
cp .env.example .env                   # lalu isi target uji Anda
npm run fixtures                       # buat fixture gambar sintetis
```

### Suite web

```bash
npm test                               # semua spec web (project chromium)
npm run test:login-negatif             # suite negatif login
npm run test:registrasi                # headed — alur ber-reCAPTCHA
npm run test:buat-listing              # headed — butuh kredensial agen
```

Semua script di atas melalui [`scripts/jalankan.mjs`](scripts/jalankan.mjs) yang
**selalu** men-generate Allure report, termasuk saat test gagal — justru saat gagal
laporannya paling dibutuhkan.

### Suite Android native

Prasyarat: emulator/device Android terhubung, `adb` di PATH, dan APK aplikasi yang
diuji (tidak disertakan di repo — set `MOBILE_APK_PATH`).

```bash
npm run mobile:doctor                  # cek prasyarat
npm run mobile:devices                 # nama device HARUS cocok MOBILE_DEVICE_NAME
npm run mobile:test:login-negatif
npm run mobile:test:buat-listing
```

### Allure report

```bash
npm run report:generate                # allure-results → allure-report
npm run report:open
```

Di CI, report tiap run diunggah sebagai artifact dan versi `master` dipublikasikan ke
GitHub Pages.

---

## Catatan lapangan yang membentuk kode ini

Bagian ini yang paling banyak menghemat waktu saat suite dipakai berulang:

- **Login punya dua bentuk.** Di produksi form login ada di dalam modal (dibuka dari
  menu profil), di dev/staging berdiri sendiri di `/agent/login`. Satu page object
  melayani keduanya; mode dideteksi dari hostname dan bisa dipaksa via
  `TEST_LOGIN_MODE`. Tanpa ini, suite yang sama gagal di salah satu environment
  dengan alasan yang tidak berhubungan.
- **Jangan pakai jalur happy-path untuk kasus negatif.** `login()` menunggu
  navigasi, jadi akan timeout saat login memang seharusnya gagal. Kasus negatif
  memakai `attemptLogin()` yang submit tanpa menunggu navigasi.
- **Toast punya state "Loading…" lebih dulu.** `waitForErrorToast()` menunggu sampai
  teksnya bukan lagi loading, kalau tidak asersinya membaca state transisi.
- **Bedakan flake lingkungan dari bug produk.** Di Android, banner carousel yang
  auto-scroll membuat dump uiautomator kadang kembali kosong (`no XML content`).
  Itu batasan alat, ditangani wrapper retry `tahanFlakyDump()` — bukan alasan untuk
  melunakkan asersi fungsional.
- **Uji yang membuat data nyata harus digerbangi.** TC submit di suite mobile hanya
  jalan bila `RUN_BUAT_LISTING_SUBMIT=1`.
- **Fixture upload tidak di-commit.** Foto properti dan foto dokumen identitas tidak
  layak masuk repo publik, jadi fixture dibuat sintetis oleh skrip.
- **Report Allure lewat artifact Pages, bukan folder `docs/` yang di-commit.**
  Meng-commit report tiap run pernah membuat repo membengkak sampai ukuran yang
  tidak bisa di-deploy.

## Lisensi

MIT — lihat [LICENSE](LICENSE).

---

### About (EN)

QA automation portfolio: Playwright (web) and mobilewright (native Android) suites
for a real-estate platform, reporting to Allure. The code is a generalized version
of production work — no client names, internal hosts, credentials, or APKs are
included; every target comes from environment variables, and
`npm run audit:sanitasi` checks both the working tree and the full git history
before pushing.
