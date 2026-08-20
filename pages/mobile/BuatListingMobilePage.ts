// Page Object (mobilewright / native Android) — Buat/Create Listing agen pada
// aplikasi properti (nama aplikasi & paket diambil dari env, lihat config/env.ts).
//
// App   : $MOBILE_APP_PACKAGE (selector terverifikasi di build 3.24.x).
// Runner: mobilewright (lihat mobilewright.config.ts) — meng-scan test-mobile-native/.
// Akun  : agen uji dari env (login native, TANPA reCAPTCHA — beda dari jalur web).
//
// ┌─ STATUS SELECTOR (diverifikasi via `mobilecli dump ui`, 2026-06-18) ───────────┐
// │ TERVERIFIKASI:                                                                  │
// │   Login (LoginActivity)  : edt_email, edt_password, btn_login                   │
// │   Home agen              : tab "Propertiku" (bottom-nav, paling kiri)           │
// │   Popup promo pasca-login: btn_close (tutup dulu sebelum navigasi)              │
// │   Propertiku             : btn_add_listing (FAB "+" pojok KANAN BAWAH)          │
// │   Form "Tambah properti" : wizard 4 step (state_progress_bar):                  │
// │       Info Umum → Detail Properti → Info Tambahan → Konfirmasi Listing          │
// │     Step 1 (Info Umum) field map: lihat SEL.step1 di bawah.                      │
// │     Upload foto: slot rv_photos → bottom-sheet ib_camera/ib_gallery →           │
// │       picker in-app ef_imagepicker (folder "Pictures" → thumbnail → "DONE").    │
// │                                                                                 │
// │ ⚠️ BELUM TERVERIFIKASI — Step 2..4 (Detail Properti / Info Tambahan /            │
// │   Konfirmasi): butuh lolos validasi step 1 dulu. Selector & tombol submit       │
// │   final WAJIB di-dump saat implementasi lanjutan. JANGAN submit saat recon →    │
// │   membuat listing NYATA di PRODUKSI.                                            │
// └────────────────────────────────────────────────────────────────────────────┘

import type { Locator, Screen } from '@mobilewright/core';
import { AGENT, MOBILE } from '../../config/env';

// applicationId APK diambil dari env (repo publik — tidak menyebut aplikasi klien).
const PKG = MOBILE.pkg;

// --- Selector TERVERIFIKASI ---------------------------------------------------
export const SEL = {
  // Login (LoginActivity)
  edtEmail: `${PKG}:id/edt_email`,
  edtPassword: `${PKG}:id/edt_password`,
  btnLogin: `${PKG}:id/btn_login`,
  // Popup promo pasca-login
  btnClosePromo: `${PKG}:id/btn_close`,
  // Propertiku → FAB tambah listing
  fabTambah: `${PKG}:id/btn_add_listing`,
  // Form Create Listing — STEP 1 "Info Umum"
  rvPhotos: `${PKG}:id/rv_photos`,
  imgPlaceholder: `${PKG}:id/img_placeholder`, // slot foto kosong
  imgPhoto: `${PKG}:id/img_photo`, // slot foto terisi
  tieTitle: `${PKG}:id/tie_title`,
  tieDesc: `${PKG}:id/tie_desc`, // ⚠️ deskripsi WAJIB ≥120 karakter
  tieSellPrice: `${PKG}:id/tie_sell_price`, // Harga Jual* (input-mask ribuan)
  slType: `${PKG}:id/sl_type`, // picker Tipe Properti (Rumah/Tanah/Ruko/Apartment/Gudang/Villa/SOHO)
  tieComission: `${PKG}:id/tie_comission`, // Persentase Komisi* (%)
  slLegalDoc: `${PKG}:id/sl_legal_doc`, // picker Dokumen Legal (SHM/HGB/Surat Ijo/PPJB/Lain-lain)
  // Radio step 1 (TIDAK ada default — wajib dipilih). Tiap grup punya "Ya"/"Tidak"/opsi.
  rvTransactionType: `${PKG}:id/rv_transaction_type`, // Jual/Sewa/Jual-Sewa
  rvGrupListing: `${PKG}:id/rv_grup_listing`, // Primary/Secondary
  rvCanKpr: `${PKG}:id/rv_can_kpr`,
  rvImb: `${PKG}:id/rv_imb`,
  rvBlueprint: `${PKG}:id/rv_blueprint`,
  rvTypeListing: `${PKG}:id/rv_type_listing`, // Open/Sim/PAP
  rvCanBanner: `${PKG}:id/rv_can_banner`, // ⚠️ "Ya" memunculkan sub-form banner wajib → happy-path pilih "Tidak"
  // STEP 2 "Detail Properti" — lokasi (berantai async) + spesifikasi
  slCountry: `${PKG}:id/sl_country`,
  slProvince: `${PKG}:id/sl_province`,
  slCity: `${PKG}:id/sl_city`,
  slArea: `${PKG}:id/sl_area`,
  tieAddress: `${PKG}:id/tie_address`,
  tieNumber: `${PKG}:id/tie_number`, // Blok & Nomor
  slOrientation: `${PKG}:id/sl_orientation`, // Arah Hadap
  tieLt: `${PKG}:id/tie_lt`, // Luas Tanah
  tieLb: `${PKG}:id/tie_lb`, // Luas Bangunan
  tieKt: `${PKG}:id/tie_kt`, // Kamar Tidur
  tieKm: `${PKG}:id/tie_km`, // Kamar Mandi
  tieWidthProperty: `${PKG}:id/tie_width_property`,
  tieLengthProperty: `${PKG}:id/tie_length_property`,
  slElectricity: `${PKG}:id/sl_electricity`, // Tegangan Listrik
  rvMapShow: `${PKG}:id/rv_map_show`, // Tampilkan di Peta?
  tieLinkVideo: `${PKG}:id/tie_link_video`,
  tilCountTelephone: `${PKG}:id/til_count_telephone`, // Jumlah Telepon
  slWater: `${PKG}:id/sl_water`, // Jenis/Tipe Air (PDAM/Sumur/Tangki/Water Treatment) — WAJIB. TODO(verify id pasti)
  // STEP 3 "Info Tambahan" — vendor
  tilVendorName: `${PKG}:id/til_vendor_name`,
  tilWaVendor: `${PKG}:id/til_wa_vendor`,
  btnPhonebook: `${PKG}:id/btn_phonebook`,
  // Navigasi wizard — ID STABIL di semua step (label berubah; step 4 btn_next = "Submit")
  btnNext: `${PKG}:id/btn_next`,
  btnBack: `${PKG}:id/btn_back`,
  // Komponen upload (picker in-app)
  ibGallery: `${PKG}:id/ib_gallery`,
  ibCamera: `${PKG}:id/ib_camera`,
  pickerImage: `${PKG}:id/image_view`,
  // Kotak "Cari" di dalam picker list (Negara/Provinsi/Kota/Tipe Properti/dst.)
  tieSearch: `${PKG}:id/tie_search`,
  // Foto step 1 — tombol unggah & progress upload per-slot
  btnUploadPhotos: `${PKG}:id/btn_upload_photos`,
  tvProgress: `${PKG}:id/tv_progress`, // indikator status/persentase upload per foto
  // ── REQ-8968: Editor "Potong / Putar 90°" (CropImageActivity, Android-Image-Cropper) ──
  // Dibuka dari action sheet per-foto (tap foto terpilih). Tanpa library baru — reuse editor Crop.
  btnPutar: `${PKG}:id/ic_rotate_right_24`, // ← FITUR REQ-8968: putar 90° CW tiap tekan
  btnBalik: `${PKG}:id/ic_flip_24`, // Balik (flip) horizontal
  btnPotong: `${PKG}:id/crop_image_menu_crop`, // "POTONG" — simpan hasil crop/putar
  cropImageView: `${PKG}:id/cropImageView`,
  imageViewImage: `${PKG}:id/ImageView_image`,
} as const;

// Label item pada action sheet per-foto (PopupMenu, android:id/title) — TERVERIFIKASI 2026-07-10.
export const ACTION_SHEET_FOTO = {
  buatUtama: 'Buat utama',
  ubah: 'Ubah',
  potongPutar: 'Potong / Putar 90°', // ← opsi Crop + Rotate (REQ-8968) menyatu di sini
  lihat: 'Lihat',
} as const;

export interface KredensialAgen {
  username: string;
  password: string;
}

// Kredensial agen dari env (TEST_AGENT_USERNAME / TEST_AGENT_PASSWORD).
// Tidak ada nilai default: suite yang butuh login akan di-skip bila env kosong.
export const KREDENSIAL_DEFAULT: KredensialAgen = {
  username: AGENT.username,
  password: AGENT.password,
};

// Home (guest + agen) punya banner carousel auto-scroll → uiautomator kadang tak
// pernah "idle" sehingga dump balik kosong ("no XML content" / "reading 'map'").
// Ini error LINGKUNGAN, bukan kegagalan fungsional. Wrapper ini mengulang aksi
// beberapa kali saat kena error dump tsb (pola dari login-agen-negatif.test.ts).
export async function tahanFlakyDump<T>(aksi: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 8; i++) {
    try {
      return await aksi();
    } catch (e: any) {
      const msg = String((e && e.message) || e);
      const dumpFlaky = msg.includes('no XML content') || msg.includes("reading 'map'");
      // Agent devicekit kadang DROP koneksi WS saat layar berat (mis. form re-render
      // menambah field kondisional): "No active session"/"connect()" atau langsung
      // "WebSocket connection closed (code=1005)". Beri jeda lebih panjang agar agent
      // re-connect, lalu ulang.
      const sessionDrop =
        msg.includes('No active session') ||
        msg.includes('connect()') ||
        msg.includes('WebSocket connection closed') ||
        msg.includes('code=1005');
      if (!dumpFlaky && !sessionDrop) throw e;
      await new Promise((r) => setTimeout(r, sessionDrop ? 4000 : 1500));
    }
  }
  return await aksi();
}

// Page Object di atas fixture `screen` mobilewright (API mirip Playwright).
// Diketik `any` agar tidak bergantung pada tipe internal mobilewright.
export class BuatListingMobilePage {
  constructor(private screen: Screen) {}

  // ── Login agen ──────────────────────────────────────────────────────────────
  // Dari Home tamu (guest): tab "Akun" → LoginActivity → isi kredensial → "Masuk".
  // Setelah sukses, app mendarat di Home agen (greeting "Hi, <NAMA>") dan tab
  // "Propertiku" muncul. Sering ada popup promo → ditutup oleh tutupPopupPromo().
  async loginAgen(kredensial: KredensialAgen, expect: any) {
    // ⚠️ Popup promo (WebView) muncul BEBERAPA DETIK setelah launch & MENUTUPI seluruh
    // layar (saat tampil tree cuma systemui + btn_close). Karena itu jangan cek
    // login/guest sekali jalan — pakai loop yang menutup popup berulang sampai layar
    // benar-benar "settle", baru putuskan sudah-login vs tamu.
    const sudahLogin = await this.settleDanCekLogin();
    if (sudahLogin) return;

    // Home tamu siap (kolom "Cari Properti" tampil). Buka layar login via tab "Akun".
    await tahanFlakyDump(() =>
      expect(this.screen.getByText('Cari Properti', { exact: false })).toBeVisible(),
    );
    await tahanFlakyDump(() => this.screen.getByText('Akun', { exact: true }).tap());

    // ⚠️ Tab "Akun" hanya membuka LoginActivity kalau BENAR-BENAR tamu; kalau sesi masih
    // hidup ia membuka HALAMAN PROFIL AGEN (lihat login-agen-negatif.test.ts). Karena
    // sinyal tamu "Cari Properti" tidak eksklusif (ada juga di home agen), verdict tamu
    // bisa salah saat dump lambat → dulu gagal keras di expect(edt_email). Sekarang:
    // kalau layar login tak muncul, cek apakah ternyata sudah login → BACK lalu lanjut.
    const email = this.screen.getByTestId(SEL.edtEmail);
    const layarLogin = await tahanFlakyDump(() => email.isVisible({ timeout: 5000 })).catch(
      () => false,
    );
    if (layarLogin !== true) {
      await this.screen.pressButton('BACK').catch(() => {});
      await new Promise((r) => setTimeout(r, 1200));
      if (await this.settleDanCekLogin()) return; // ternyata sesi masih hidup → idempotent
      // Bukan layar login DAN bukan sesi hidup → gagal beneran, lempar error eksplisit.
      await tahanFlakyDump(() => expect(email).toBeVisible());
    }
    await email.fill(kredensial.username);
    await this.screen.getByTestId(SEL.edtPassword).fill(kredensial.password);
    // ⚠️ Setelah isi password, soft-keyboard (IME) MENGGESER/menutupi `btn_login` keluar
    // dari accessibility tree → tap() balik "no matching element after 5000ms". Tutup
    // keyboard dulu (BACK menutup IME lebih dulu & TETAP di LoginActivity), beri jeda
    // settle, lalu pastikan tombol tampil sebelum tap.
    await this.screen.pressButton('BACK').catch(() => {});
    await new Promise((r) => setTimeout(r, 700));
    const btnLogin = this.screen.getByTestId(SEL.btnLogin);
    await tahanFlakyDump(() => btnLogin.scrollIntoViewIfNeeded({ maxSwipes: 4 })).catch(() => {});
    await tahanFlakyDump(() => expect(btnLogin).toBeVisible());
    await btnLogin.tap();

    // Pasca-login: mendarat di Home agen + popup promo (kadang telat muncul).
    // Loop settle lagi sampai tab "Propertiku" (bukti agen) tampil.
    const ok = await this.settleDanCekLogin();
    if (!ok) {
      // Percobaan terakhir → lempar error eksplisit kalau tetap gagal.
      await tahanFlakyDump(() =>
        expect(this.screen.getByText('Propertiku', { exact: true })).toBeVisible(),
      );
    }
  }

  // Loop "settle": tiap iterasi tutup popup (bila ada), lalu cek state layar.
  //   return true  → sudah login (tab "Propertiku" tampil).
  //   return false → home TAMU siap (Cari Properti tampil, tanpa popup) → siap login.
  // Visibility dibungkus tahanFlakyDump karena Home/popup ber-animasi → dump flaky.
  private async settleDanCekLogin(): Promise<boolean> {
    // ⚠️ "Cari Properti" BUKAN sinyal eksklusif tamu — kolom pencarian itu tampil juga di
    // home agen yang sudah login. Jadi kalau cek "Propertiku" meleset sesaat (dump lambat
    // di emulator terbebani), loop bisa salah menyimpulkan "tamu". Mitigasi: timeout cek
    // Propertiku dilonggarkan, dan verdict tamu baru diambil setelah MELESET dua iterasi
    // berturut-turut — bukan sekali jalan.
    let sinyalTamu = 0;
    for (let i = 0; i < 14; i++) {
      const tutup = await this.tutupPopupPromo();

      const propertiku = await tahanFlakyDump(() =>
        this.screen.getByText('Propertiku', { exact: true }).isVisible({ timeout: 2500 }),
      ).catch(() => false);
      if (propertiku === true) return true;

      // Hanya nilai "tamu" kalau TIDAK ada popup yang baru ditutup (beri waktu settle).
      if (!tutup) {
        const tamu = await tahanFlakyDump(() =>
          this.screen.getByText('Cari Properti', { exact: false }).isVisible({ timeout: 1200 }),
        ).catch(() => false);
        if (tamu === true) {
          sinyalTamu += 1;
          if (sinyalTamu >= 2) return false;
        } else {
          sinyalTamu = 0;
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }

  // Tutup popup promo (banner kampanye) yang kadang muncul pasca-login dan
  // menutupi navigasi. Aman bila popup tidak muncul (skip diam-diam).
  async tutupPopupPromo(): Promise<boolean> {
    // Popup promo = WebView ber-spinner → dump uiautomator flaky (bungkus tahanFlakyDump).
    // ⚠️ Tombol close-nya ImageView TANPA atribut `visible` → isVisible()/tap() bawaan
    // mobilewright TIDAK andal (isVisible balik false → tak pernah di-tap). Andalkan
    // boundingBox() + screen.tap(x,y) (terbukti menutup popup) sebagai gantinya.
    const box = await tahanFlakyDump(() =>
      this.screen.getByTestId(SEL.btnClosePromo).boundingBox({ timeout: 1500 }),
    ).catch(() => null);
    if (!box) return false;
    await this.screen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await new Promise((r) => setTimeout(r, 800));
    return true;
  }

  // ── Navigasi ke form Create Listing ──────────────────────────────────────────
  // Propertiku (tab bawah) → FAB "+" (btn_add_listing) → form "Tambah properti".
  async bukaFormBuatListing(expect: any) {
    await tahanFlakyDump(() => this.screen.getByText('Propertiku', { exact: true }).tap());
    // Daftar Propertiku siap → FAB "+" (pojok kanan bawah). FAB = ImageView tanpa
    // atribut `visible` → tap lewat boundingBox (lihat tutupPopupPromo).
    await this.tapByBox(SEL.fabTambah, expect);
    // Form wizard step 1: judul "Tambah properti" + step "Info Umum".
    await expect(this.screen.getByText('Tambah properti', { exact: false })).toBeVisible();
    await expect(this.screen.getByText('Info Umum', { exact: false })).toBeVisible();
  }

  // Tap elemen via boundingBox + screen.tap(x,y) — andal untuk ImageView/komponen
  // tanpa atribut `visible` yang membuat isVisible()/tap() bawaan tak bekerja.
  private async tapByBox(testId: string, expect: any) {
    const box = await tahanFlakyDump(() => this.screen.getByTestId(testId).boundingBox());
    expect(box, `Elemen ${testId} tidak ditemukan (boundingBox null)`).toBeTruthy();
    await this.screen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }

  // Form Create Listing terbuka (indikator field judul/foto step 1 tampil).
  async pastikanFormTerbuka(expect: any) {
    await expect(this.screen.getByText('Foto Listing', { exact: false })).toBeVisible();
    await expect(this.screen.getByText('Draft Judul Listing', { exact: false })).toBeVisible();
  }

  // ── Upload foto (picker in-app ef_imagepicker) ────────────────────────────────
  // Prasyarat: galeri emulator SUDAH di-seed (lihat scripts/seed-galeri-mobile.sh —
  // pakai `content call scan_volume`, BUKAN broadcast MEDIA_SCANNER yang no-op di API 30).
  // Alur: slot foto → bottom-sheet "Gallery" → folder "Pictures" → thumbnail → "DONE".
  // `jumlah` = banyak foto yang dipilih (picker mendukung multi-select, maks 8).
  async uploadFoto(expect: any, jumlah = 1) {
    // Tap tombol unggah (atau slot foto kosong pertama).
    const tombolUnggah = this.screen.getByText('+ Unggah foto', { exact: false });
    if (await tombolUnggah.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tombolUnggah.tap();
    } else {
      await this.screen.getByTestId(SEL.imgPlaceholder).first().tap();
    }

    // Bottom-sheet pilihan sumber → "Gallery".
    await expect(this.screen.getByTestId(SEL.ibGallery)).toBeVisible();
    await this.screen.getByTestId(SEL.ibGallery).tap();

    // Picker in-app: buka folder "Pictures".
    await tahanFlakyDump(() =>
      expect(this.screen.getByText('Pictures', { exact: false }).first()).toBeVisible(),
    );
    await this.screen.getByText('Pictures', { exact: false }).first().tap();

    // Grid foto: pilih `jumlah` thumbnail pertama.
    const thumbs = this.screen.getByTestId(SEL.pickerImage);
    await expect(thumbs.first()).toBeVisible();
    for (let i = 0; i < jumlah; i++) {
      await thumbs.nth(i).tap();
    }

    // Konfirmasi pilihan.
    await this.screen.getByText('DONE', { exact: false }).tap();

    // Kembali ke form: slot foto kini terisi (img_photo) / label "Ubah".
    await expect(this.screen.getByTestId(SEL.imgPhoto).first()).toBeVisible();
  }

  // ── Pengisian field step 1 (sebagian; dropdown step 1 + step 2..4 menyusul) ───
  // Diisi adaptif (skip-if-absent) mengikuti pola desktop BuatListingPage.
  async isiInfoDasar(data: { judul?: string; deskripsi?: string; komisi?: string }) {
    await this.isiJikaAda(SEL.tieTitle, data.judul);
    await this.isiJikaAda(SEL.tieDesc, data.deskripsi);
    await this.isiJikaAda(SEL.tieComission, data.komisi);
  }

  // Tekan tombol "Selanjutnya" (di bawah form panjang → scroll dulu agar masuk viewport).
  // Pakai swipe-until-visible manual (lebih tahan dari scrollIntoViewIfNeeded yang kadang
  // timeout karena re-render/animasi form → flaky).
  // Tekan tombol lanjut wizard. ✅ Tombol next/back punya RESOURCE-ID STABIL `btn_next`/
  // `btn_back` di SEMUA step (label berubah: "Selanjutnya"→"Selanjutnya"→"Lanjut & Buat
  // Rekomendasi Deskripsi"→"Submit") → pakai testId, jauh lebih andal dari cari teks.
  // Tombol di dasar form panjang → scroll dulu, lalu tap via boundingBox (bypass
  // resolveActionable yang flaky di tepi bawah).
  async tekanSelanjutnya() {
    const next = this.screen.getByTestId(SEL.btnNext);
    await tahanFlakyDump(() => next.scrollIntoViewIfNeeded({ maxSwipes: 12 })).catch(() => {});
    let box: { x: number; y: number; width: number; height: number } | null = null;
    for (let i = 0; i < 6; i++) {
      box = await tahanFlakyDump(() => next.boundingBox({ timeout: 1500 })).catch(() => null);
      if (box) break;
      await this.screen.swipe('up');
      await new Promise((r) => setTimeout(r, 600));
    }
    if (!box) throw new Error('Tombol lanjut (btn_next) tidak ditemukan setelah scroll.');
    await this.screen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }

  // Pilih chip/radio berteks (mis. Tipe Transaksi "Jual", Grup "Secondary").
  async pilihOpsiTeks(teks: string) {
    const loc = this.screen.getByText(teks, { exact: true }).first();
    if (await loc.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loc.tap();
    }
  }

  private async isiJikaAda(testId: string, value?: string) {
    if (!value) return;
    const el = this.screen.getByTestId(testId).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.fill(value);
    }
  }

  // ─── Helper umum untuk TC-03 (isi penuh wizard) ──────────────────────────────
  private jeda(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // Bungkus promise dengan batas waktu keras → hang berubah jadi error (bukan gantung 180s).
  private async withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: any;
    const to = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new Error(`TIMEOUT ${ms}ms: ${label}`)), ms);
    });
    try {
      return (await Promise.race([p, to])) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // Bawa locator ke viewport (best-effort; abaikan error transient).
  private async scrollKe(loc: any) {
    await tahanFlakyDump(() => loc.scrollIntoViewIfNeeded({ maxSwipes: 14 })).catch(() => {});
  }

  // Tutup keyboard tanpa risiko navigasi: tap teks toolbar "Tambah properti" (non-editable,
  // di y~136) untuk melepas fokus input → keyboard tersembunyi. ⚠️ JANGAN pakai BACK: kalau
  // keyboard sudah tertutup, BACK akan keluar dari form.
  private async tutupKeyboard() {
    await this.screen.tap(540, 136);
    await this.jeda(500);
  }

  // Tap locator via boundingBox + screen.tap (bypass resolveActionable yang flaky).
  // Resilient: kalau elemen belum di viewport (boundingBox null ATAU posisinya di luar
  // pita terlihat), swipe untuk memunculkan lalu ulang. Android tak selalu mengekspos /
  // menempatkan elemen off-screen di posisi yang bisa di-tap.
  private async tapBoxLoc(loc: Locator, label = 'elemen') {
    const PITA_ATAS = 300; // di bawah toolbar+progress bar
    const PITA_BAWAH = 1750; // mencakup tombol bawah (Selanjutnya/Submit ~1678); di atas nav bar
    for (let i = 0; i < 6; i++) {
      const box = await tahanFlakyDump(() => loc.boundingBox({ timeout: 4000 })).catch(() => null);
      const cy = box ? box.y + box.height / 2 : -1;
      if (box && cy >= PITA_ATAS && cy <= PITA_BAWAH) {
        await this.screen.tap(box.x + box.width / 2, cy);
        return;
      }
      await this.screen.swipe('up'); // konten naik → elemen bawah masuk pita terlihat
      await this.jeda(700);
    }
    // Upaya terakhir: tap apa adanya bila ketemu (walau di tepi).
    const box = await tahanFlakyDump(() => loc.boundingBox({ timeout: 4000 })).catch(() => null);
    if (!box) throw new Error(`${label} tidak ditemukan (boundingBox null).`);
    await this.screen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }

  // Isi textfield (EditText) lewat locator: scroll → fill.
  // ⚠️ JANGAN pressButton('BACK') di sini: fill() menulis via accessibility tanpa membuka
  // keyboard, jadi BACK malah MENAVIGASI MUNDUR (keluar form) — bukan menutup keyboard.
  private async isiTeksLoc(loc: any, value?: string, label = 'field') {
    if (value == null) return;
    // eslint-disable-next-line no-console
    console.error(`[isiTeks] ${label}`);
    // Field bisa di luar viewport / belum masuk accessibility tree (Android tak selalu
    // ekspos elemen off-screen) → coba: scroll ke field → fill; kalau "no matching element",
    // swipe untuk memunculkan lalu ulang.
    for (let i = 0; i < 6; i++) {
      await this.withTimeout(this.scrollKe(loc), 40000, `scrollKe ${label}`);
      try {
        await this.withTimeout(tahanFlakyDump(() => loc.fill(value, { timeout: 8000 })), 40000, `fill ${label}`);
        await this.tutupKeyboard(); // fill() membuka keyboard → tutup
        return;
      } catch (e: any) {
        const msg = String((e && e.message) || e);
        const bisaRetry = msg.includes('no matching element') || msg.includes('TIMEOUT');
        if (!bisaRetry) throw e;
        await this.screen.swipe('up'); // konten naik → field bawah muncul
        await this.jeda(700);
      }
    }
    throw new Error(`Gagal mengisi field "${label}" setelah beberapa kali scroll/retry.`);
  }

  // Isi textfield berdasar resource-id EditText (tie_*).
  async isiTeks(testId: string, value?: string) {
    await this.isiTeksLoc(this.screen.getByTestId(testId), value, testId);
  }

  // Isi textfield berdasar placeholder/hint (untuk field tanpa id EditText, mis. vendor).
  async isiTeksPlaceholder(placeholder: string, value?: string) {
    await this.isiTeksLoc(this.screen.getByPlaceholder(placeholder), value, placeholder);
  }

  // Pilih opsi dari picker list (bottom-sheet ber-"Cari"). triggerTestId = sl_* dropdown.
  //   search=true → ketik di kotak `tie_search` dulu (untuk list panjang: Provinsi/Kota).
  // Opsi diambil via getByText(exact).last() — saat search, teks query juga muncul di kotak
  // cari (echo) → .last() memilih item list (di-render setelah kotak cari).
  async pilihPicker(triggerTestId: string, optionText: string, opts: { search?: boolean } = {}) {
    // eslint-disable-next-line no-console
    console.error(`[pilihPicker] ${triggerTestId} = "${optionText}"${opts.search ? ' (search)' : ''}`);
    const trigger = this.screen.getByTestId(triggerTestId);
    await this.scrollKe(trigger);
    await this.tapBoxLoc(trigger, `dropdown ${triggerTestId}`);
    await this.jeda(1800); // picker buka (+async load opsi)

    if (opts.search) {
      await tahanFlakyDump(() => this.screen.getByTestId(SEL.tieSearch).fill(optionText));
      await this.jeda(1500);
    }
    const opt = this.screen.getByText(optionText, { exact: true }).last();
    await this.tapBoxLoc(opt, `opsi "${optionText}"`);
    await this.jeda(1800); // picker tutup (+async load dropdown berikutnya utk lokasi berantai)
  }

  // Pilih opsi radio (RadioButton `rdb_item`) di dalam grup `rv_*`.
  async pilihRadio(groupTestId: string, optionText: string) {
    // eslint-disable-next-line no-console
    console.error(`[pilihRadio] ${groupTestId} = "${optionText}"`);
    const group = this.screen.getByTestId(groupTestId);
    await this.scrollKe(group);
    const opt = group.getByText(optionText, { exact: true });
    await this.tapBoxLoc(opt, `radio ${groupTestId}="${optionText}"`);
    // Sebagian radio memunculkan field kondisional (mis. Transaksi "Jual" → "Harga Jual",
    // "Bisa Pasang Banner" → sub-form). Beri jeda agar form re-render & a11y settle.
    await this.jeda(2000);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // REQ-8968 — Rotate Image di Add Listing
  // ══════════════════════════════════════════════════════════════════════════════

  // Tap langsung sebuah locator via boundingBox+screen.tap TANPA batas pita/scroll.
  // Dipakai untuk elemen di action bar ATAS (y < 300) — tapBoxLoc tak cocok karena
  // menganggap y<300 "di luar viewport" lalu swipe (malah menggeser editor).
  private async tapLangsung(loc: Locator, label = 'elemen') {
    const box = await tahanFlakyDump(() => loc.boundingBox({ timeout: 8000 })).catch(() => null);
    if (!box) throw new Error(`${label} tidak ditemukan (boundingBox null).`);
    await this.screen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }

  // Buka action sheet per-foto: tap foto ke-`index` (default 0, slot pertama terisi).
  // Prasyarat: minimal 1 foto sudah ter-upload (img_photo tampil).
  async bukaActionSheetFoto(expect: any, index = 0) {
    const foto = this.screen.getByTestId(SEL.imgPhoto).nth(index);
    await tahanFlakyDump(() => expect(foto).toBeVisible());
    const box = await tahanFlakyDump(() => foto.boundingBox({ timeout: 8000 }));
    expect(box, `Slot foto #${index} (img_photo) tidak ditemukan — upload foto dulu`).toBeTruthy();
    await this.screen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await this.jeda(1600);
    // Action sheet muncul (PopupMenu) — item "Potong / Putar 90°" jadi penanda.
    await tahanFlakyDump(() =>
      expect(this.screen.getByText(ACTION_SHEET_FOTO.potongPutar, { exact: false })).toBeVisible(),
    );
  }

  // Daftar label opsi action sheet yang benar-benar tampil (untuk assertion TC-01).
  async opsiActionSheetTampil(): Promise<string[]> {
    const hasil: string[] = [];
    for (const label of Object.values(ACTION_SHEET_FOTO)) {
      const ada = await tahanFlakyDump(() =>
        this.screen.getByText(label, { exact: false }).isVisible({ timeout: 2000 }),
      ).catch(() => false);
      if (ada) hasil.push(label);
    }
    return hasil;
  }

  // Dari action sheet → tap "Potong / Putar 90°" → editor crop/rotate terbuka.
  // Penanda editor siap: tombol "POTONG" (crop_image_menu_crop) tampil.
  async bukaEditorPotongPutar(expect: any) {
    const opsi = this.screen.getByText(ACTION_SHEET_FOTO.potongPutar, { exact: false }).first();
    await this.tapLangsung(opsi, 'opsi "Potong / Putar 90°"');
    await this.jeda(2500);
    await tahanFlakyDump(() =>
      expect(this.screen.getByText('POTONG', { exact: false })).toBeVisible(),
    );
  }

  // Locator tombol "Putar": utamakan resource-id, fallback content-desc/label "Putar".
  private locPutar() {
    return this.screen.getByTestId(SEL.btnPutar);
  }

  // Editor terbuka: tombol Putar (rotate) + POTONG (apply) hadir.
  async pastikanEditorPutarTampil(expect: any) {
    const putarVisible =
      (await this.locPutar().isVisible({ timeout: 8000 }).catch(() => false)) ||
      (await this.screen.getByLabel('Putar').isVisible({ timeout: 4000 }).catch(() => false));
    expect(putarVisible, 'Tombol "Putar" (rotate 90° CW) harus tampil di editor').toBe(true);
    await expect(this.screen.getByText('POTONG', { exact: false })).toBeVisible(); // apply crop/rotate
  }

  // Tekan tombol "Putar" (rotate 90° CW). Panggil berkali-kali untuk kelipatan 90°.
  async tekanPutar() {
    // Utamakan resource-id; fallback ke content-desc "Putar" bila boundingBox id null.
    let box = await tahanFlakyDump(() => this.locPutar().boundingBox({ timeout: 6000 })).catch(() => null);
    if (!box) {
      box = await tahanFlakyDump(() => this.screen.getByLabel('Putar').boundingBox({ timeout: 4000 })).catch(
        () => null,
      );
    }
    if (!box) throw new Error('Tombol Putar tidak ditemukan (boundingBox null).');
    await this.screen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await this.jeda(1200);
  }

  // Simpan hasil crop/putar: tap "POTONG" → kembali ke form step 1.
  async simpanPotong(expect: any) {
    await this.tapLangsung(this.screen.getByText('POTONG', { exact: false }).first(), 'tombol POTONG');
    await this.jeda(2500);
    // Kembali ke form: slot foto (img_photo) tampil lagi.
    await tahanFlakyDump(() => expect(this.screen.getByTestId(SEL.imgPhoto).first()).toBeVisible());
  }

  // Apakah tombol lanjut (btn_next) TERJANGKAU (form wizard step 1 masih utuh)?
  // btn_next ada di DASAR form panjang → tak tampil tanpa scroll. Mirror tekanSelanjutnya
  // tapi tidak menekan — hanya memastikan bisa ditemukan (bukti alur upload tak berubah).
  async btnNextTerjangkau(): Promise<boolean> {
    const next = this.screen.getByTestId(SEL.btnNext);
    await tahanFlakyDump(() => next.scrollIntoViewIfNeeded({ maxSwipes: 12 })).catch(() => {});
    for (let i = 0; i < 6; i++) {
      const box = await tahanFlakyDump(() => next.boundingBox({ timeout: 1500 })).catch(() => null);
      if (box) return true;
      await this.screen.swipe('up');
      await this.jeda(600);
    }
    return false;
  }

  // boundingBox area gambar crop (untuk diff piksel). Fallback ke pita tengah layar
  // bila id cropImageView tak resolve boundingBox.
  async boxAreaGambar(): Promise<{ x: number; y: number; width: number; height: number }> {
    const cand = [SEL.imageViewImage, SEL.cropImageView];
    for (const id of cand) {
      const b = await tahanFlakyDump(() => this.screen.getByTestId(id).boundingBox({ timeout: 4000 })).catch(
        () => null,
      );
      if (b && b.width > 200 && b.height > 200) return b;
    }
    // Fallback: area di bawah action bar, di atas nav bar (layar 1080x1920 emulator).
    return { x: 40, y: 320, width: 1000, height: 1300 };
  }

  // Screenshot penuh layar (Buffer PNG) — dipakai spec untuk diff piksel rotasi.
  async tangkapLayar(): Promise<Buffer> {
    return await this.screen.screenshot();
  }

  // Baca teks progress upload foto slot pertama (indikator "reset status upload"
  // pasca-rotate — REQ-8968). Kembalikan string (bisa "", "10%", "Uploading", dst.)
  // atau null bila node tak ada.
  async bacaProgressFoto(index = 0): Promise<string | null> {
    return await tahanFlakyDump(async () => {
      const el = this.screen.getByTestId(SEL.tvProgress).nth(index);
      if (!(await el.isVisible({ timeout: 1500 }).catch(() => false))) return null;
      return (await el.getText({ timeout: 1500 }).catch(() => null)) as string | null;
    }).catch(() => null);
  }

  // ─── Submit final (step 4 Konfirmasi) — ⚠️ MEMBUAT LISTING NYATA DI PROD ──────
  async submitFinal(expect: any, testInfo?: any) {
    const next = this.screen.getByTestId(SEL.btnNext); // di step 4, label = "Submit"
    await this.scrollKe(next);
    await this.tapBoxLoc(next, 'tombol Submit');
    await this.jeda(4000);

    // Dialog konfirmasi opsional (Ya/Lanjut/OK) — klik bila muncul.
    for (const t of ['Ya', 'Lanjut', 'OK', 'Setuju', 'Kirim']) {
      const btn = this.screen.getByText(t, { exact: true });
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.tapBoxLoc(btn, `konfirmasi "${t}"`).catch(() => {});
        break;
      }
    }
    await this.jeda(3000);

    if (testInfo) {
      await testInfo.attach('setelah-submit', {
        body: await this.screen.screenshot(),
        contentType: 'image/png',
      });
    }
    // Sukses = keluar dari form: tombol Submit/btn_next tak lagi tampil ATAU Propertiku muncul.
    const masihDiForm = await this.screen
      .getByTestId(SEL.btnNext)
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(masihDiForm, 'Setelah submit seharusnya keluar dari form wizard').toBe(false);
  }
}
