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

### Web — Registrasi agen (2 spec: form vs submit)

reCAPTCHA invisible hanya menghalangi **langkah terakhir** (kirim data). Menaruh
seluruh alur dalam satu test membuat semua yang sebenarnya bisa diverifikasi ikut
tergerbangi captcha — jadi spec-nya dipecah:

`test/web/registrasi-form.spec.ts` — perilaku form, **tanpa submit**, jalan headless
di CI dan tidak pernah membuat pengajuan nyata:

| TC | Skenario | Asersi inti |
| --- | --- | --- |
| TC-01 | Lanjutkan dengan form kosong | tetap di Step 1 (validasi field wajib jalan) |
| TC-02 | Data pribadi + Keterangan opsional | nilai tidak hilang saat form re-render |
| TC-03 | Unggah berkas `.txt` | ditolak dengan pesan tipe file tidak valid |
| TC-04 | Unggah PNG | tidak ditolak sebagai tipe salah + ada umpan balik upload |
| TC-05 | Dropdown sumber informasi | daftar opsi terbaca & tanpa duplikat |
| TC-06 | Step 1 lengkap → Lanjutkan | sampai di Step 2 |
| TC-07 | Tanda tangan → Submit Data | dialog konfirmasi muncul, lalu **dibatalkan** |

`test/web/registrasi.spec.ts` — happy path penuh sampai halaman sukses (data dinamis
email/WA unik per run, **tanda tangan canvas** via `mouse.move/down/up`, dialog
konfirmasi). Ini yang benar-benar mengirim data, jadi tetap digerbangi & headed.

### Web — Buat listing (`test/web/buat-listing.spec.ts`)

Login → dashboard agen (SPA) → upload foto (crop & upload) → 4 kelompok field
(info dasar, lokasi berantai, spesifikasi, vendor) → submit → verifikasi listing
muncul di daftar. Page object-nya **adaptif**: field yang tidak muncul untuk tipe
properti tertentu (mis. kamar tidur pada "Tanah") dilewati, bukan bikin gagal.

Captcha di alur ini ada di **langkah login**, bukan di form listing-nya. Karena itu
spec ini punya dua jalur masuk: memakai **sesi tersimpan** (`npm run auth:agen`) yang
melewati login sehingga bisa jalan headless di CI, atau login biasa dengan kredensial
yang menuntut mode headed.

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
npm run test:registrasi-form           # perilaku form registrasi (headless, tanpa submit)
npm run test:registrasi                # headed — submit sebenarnya, ber-reCAPTCHA
npm run test:buat-listing              # butuh sesi tersimpan atau kredensial agen
```

Sesi agen — dipakai agar spec pasca-login bisa jalan headless:

```bash
npm run auth:agen                      # login sekali HEADED (Chrome asli), simpan sesi
npm run sesi:base64                    # cetak base64-nya untuk secret CI
```

`npm run auth:agen` memakai Chrome asli karena reCAPTCHA v3 memberi skor lebih rendah
pada Chromium bundled sampai login ditolak diam-diam (`npx playwright install chrome`
bila belum ada). Hasilnya `playwright/.auth/agen.json` — berisi token sesi nyata,
ada di `.gitignore`, dan punya masa kedaluwarsa sehingga perlu dibuat ulang berkala.

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

### Suite ber-reCAPTCHA di CI

Strateginya bukan "melawan captcha", tapi memisahkan apa yang benar-benar terhalang
captcha dari apa yang tidak:

| Yang diuji | Di CI? | Caranya |
| --- | --- | --- |
| Perilaku form registrasi (7 TC) | ✅ headless | spec terpisah, berhenti sebelum submit |
| Buat listing end-to-end | ✅ headless | sesi tersimpan dari secret `AGENT_STORAGE_STATE_B64` |
| Submit registrasi + halaman sukses | ⚠️ manual | job `gated`: headed via `xvfb-run` + Chrome asli |

Job `gated` hanya jalan lewat **Run workflow** manual dengan input
`force_run_recaptcha = true`, `--workers=1`, dan report-nya jadi artifact tersendiri
(tidak diterbitkan ke Pages).

Yang perlu disadari:

- Untuk submit registrasi, skor reCAPTCHA v3 tetap jatuh dari IP datacenter runner
  GitHub. Supaya benar-benar hijau, lingkungan uji harus memakai **test key
  reCAPTCHA** atau meng-allowlist CI — itu pekerjaan sisi aplikasi, bukan sisi test.
  Karena itu job-nya `continue-on-error`.
- Spec yang **menulis data nyata** (submit registrasi & buat listing) harus diarahkan
  ke lingkungan yang datanya boleh kotor, jangan ke produksi.
- Tanpa secrets, semuanya skip dengan alasan tertulis — bukan gagal.

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
- **Pisahkan yang terhalang captcha dari yang tidak.** reCAPTCHA hanya menjaga satu
  langkah (login, atau submit akhir). Menggerbangi seluruh spec karena satu langkah
  itu berarti membuang cakupan yang sebenarnya bisa diverifikasi setiap hari.
- **Sesi tersimpan yang kosong lebih berbahaya daripada tidak ada sesi.**
  `storageState` dari login yang gagal tetap berbentuk JSON valid
  (`{"cookies":[],"origins":[]}`). Kalau itu dianggap "ada sesi", spec menempuh jalur
  tanpa login lalu gagal di dashboard dengan alasan yang menyesatkan — jadi
  `adaSesiAgen()` memeriksa isinya, bukan cuma keberadaan berkasnya.
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
