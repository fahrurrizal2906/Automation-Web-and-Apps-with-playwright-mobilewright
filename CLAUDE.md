# CLAUDE.md

Panduan untuk Claude Code / agen lain yang bekerja di repo ini.

## Apa ini

Portofolio otomasi QA **publik**: suite Playwright (web) + mobilewright (Android
native) untuk sebuah platform properti, melaporkan ke Allure. Kode, komentar, judul
test, dan dokumentasi ditulis dalam **bahasa Indonesia** — ikuti itu saat menambah
apa pun.

## Aturan mutlak: repo ini PUBLIK

Yang **tidak boleh** masuk ke berkas mana pun (termasuk pesan commit):

- nama klien/employer atau singkatannya
- host internal (situs, staging, gateway, dashboard agen)
- prefiks/nomor tiket dari issue tracker internal
- username & password akun uji
- `applicationId`/bundle id aplikasi klien, dan APK itu sendiri

Semua nilai nyata masuk lewat environment variable yang dibaca **hanya** di
[`config/env.ts`](config/env.ts). Page object dan spec tidak boleh membaca
`process.env` untuk target/kredensial — impor dari `config/env.ts`.

Sebelum commit atau push: `npm run audit:sanitasi`. Skrip itu memeriksa working tree
**dan seluruh riwayat commit**; temuan di riwayat tidak hilang dengan mengedit
berkas — riwayat harus ditulis ulang sebelum push pertama.

## Perintah

```bash
npm test                        # semua spec web (project chromium) + Allure
npm run test:login-negatif      # satu suite
npm run mobile:test             # suite Android native (butuh device + APK)
npm run fixtures                # regenerate fixture gambar sintetis
npm run report:generate         # allure-results → allure-report
npm run audit:sanitasi          # audit kebocoran
npx tsc --noEmit                # type-check (tidak ada build step)
```

Tidak ada build atau lint step — Playwright menjalankan TypeScript langsung.

## Arsitektur

**Page Object Model.** `test/**/*.spec.ts` memegang skenario + asersi;
`pages/**` memegang selector dan interaksi. Spec tidak boleh berisi selector mentah.

**Pemilihan project.** Berbeda dari pola `testMatch` panjang, di sini project
dipetakan ke folder lewat `testDir` per project:

- `test/web/` → project `chromium` (Desktop Chrome)
- `test/mobile/` → project `chromium-mobile` (Pixel 5, mobile-web)
- `test-mobile-native/` → **bukan** Playwright; di-scan mobilewright
  (`mobilewright.config.ts`)

Menambah spec = taruh di folder yang benar; tidak ada daftar yang perlu disunting.

**Sesi agen (`storageState`).** reCAPTCHA menjaga langkah **login**, bukan form
setelahnya. `npm run auth:agen` (project `setup`, headed, Chrome asli) menyimpan sesi
ke `playwright/.auth/agen.json`; spec pasca-login memakainya lewat
`test.use({ storageState: adaSesiAgen() ? SESI_AGEN_FILE : undefined })` sehingga bisa
jalan headless di CI. Di CI, berkasnya dipulihkan dari secret `AGENT_STORAGE_STATE_B64`
(`scripts/sesi-agen.mjs`). Berkas sesi berisi token nyata — jangan pernah di-commit.

**Dua bentuk login.** `LOGIN_MODE` (`config/env.ts`) menentukan apakah form login
ada di modal (`'modal'`, pola produksi) atau berdiri sendiri di `/agent/login`
(`'page'`, pola dev/staging). `AgentLoginPage` bercabang pada nilai itu.

## Konvensi saat menambah test

1. Buka spec dengan komentar doc: tujuan, environment, lalu daftar TC
   (`TC-01 [NEG] …`) yang memetakan skenario ke asersi.
2. Kasus negatif memakai `attemptLogin()` (tanpa wait navigasi), bukan `login()`.
3. Test yang butuh kredensial/target: `test.skip(...)` dengan **alasan yang
   menyebut env var yang kurang** — jangan biarkan gagal seperti bug produk.
4. Test yang membuat data nyata harus digerbangi env var opt-in.
5. Lampirkan bukti lewat `testInfo.attach` (screenshot, JSON observasi) supaya
   Allure report bisa dibaca tanpa menjalankan ulang.
6. Bedakan **flake lingkungan** dari **bug produk**: bungkus batasan alat dengan
   retry helper (mis. `tahanFlakyDump()`), jangan melunakkan asersi fungsional.

## Jebakan yang sudah pernah menggigit

- **mobilewright `deviceName`** harus cocok dengan `name` yang dilaporkan
  `mobilecli devices` (biasanya model, mis. `sdk_gphone`), **bukan** nama AVD.
  Regex yang tidak match membuat run **hang diam-diam** di "setting up device",
  bukan memberi error jelas.
- **Dialog "Pembaruan Aplikasi"** muncul terus-menerus dan memblokir navigasi bila
  build APK dianggap usang oleh backend. Untuk suite login, jalankan device offline.
- **Toast server di Android tidak ada di accessibility tree** — asersi harus
  bersandar pada state layar, bukan teks toast.
- **reCAPTCHA invisible menolak Chromium bundled headless.** Spec terkait skip di CI
  kecuali `FORCE_RUN_RECAPTCHA=true`; lokal jalankan headed (`USE_CHROME_CHANNEL=true`
  memakai Chrome asli).
- **Berkas `*.setup.ts` tidak cocok `testMatch` default Playwright**
  (`**/*.@(spec|test).ts`). Tanpa `testMatch: '**/*.setup.ts'` di project `setup`,
  hasilnya "No tests found" — bukan error yang menunjuk sebabnya.
- **`storageState` dari login gagal tetap JSON valid tapi kosong.** Periksa isinya
  (`adaSesiAgen()`), jangan cuma `fs.existsSync` — kalau tidak, spec menempuh jalur
  "sudah login" lalu gagal di tempat yang jauh dari akar masalahnya.
- **`npm run x ; npm run y` tidak jalan di Windows** (npm memakai cmd.exe, `;` bukan
  operator chain). Itu sebabnya ada `scripts/jalankan.mjs`.
