import { Page, Locator, TestInfo, FileChooser, expect } from '@playwright/test';
import { AGENT_DASHBOARD_URL } from '../../config/env';

export interface ListingData {
  // Wajib untuk semua tipe properti
  judul: string;
  deskripsi: string;
  hargaJual: string;
  grupListing: string;
  // Transaksi: toggle chip "Dijual" | "Disewa". Default (undefined) = "Dijual" (perilaku lama).
  // Bila "Disewa", field harga berganti ke "Harga Sewa" dan diisi dari `hargaSewa` (fallback hargaJual).
  transaksi?: string;
  hargaSewa?: string;
  tipeProperti: string;
  komisi: string;
  statusListing: string;
  dokumenLegal: string;
  negara: string;
  provinsi: string;
  kota: string;
  area: string;
  alamat: string;
  fotoPaths: string[];
  // Opsional — tergantung tipe properti / grup listing.
  // Diisi hanya jika field-nya muncul di UI (lihat helper isi* adaptif di bawah).
  // Mis. tipe "Tanah" umumnya tidak punya kamar tidur/mandi & luas bangunan.
  blokNomor?: string;
  arahHadap?: string;
  luasTanah?: string;
  luasBangunan?: string;
  kamarTidur?: string;
  kamarMandi?: string;
  lebarProperti?: string;
  panjangProperti?: string;
  dayaListrik?: string;
  jenisAir?: string;
  namaVendor?: string;
  noTelpVendor?: string;
  // Opsional khusus grup Primary (field proyek/developer — selector belum diobservasi)
  namaProyek?: string;
  developer?: string;
}

export class BuatListingPage {
  constructor(protected readonly page: Page) {}

  protected readonly agentDashboardUrl = AGENT_DASHBOARD_URL;

  // Pesan sukses (toast) terakhir yang tertangkap setelah submit/edit listing.
  protected lastSuccessMessage = '';

  // Jalur yang dipakai bukaEditListing untuk mencapai aksi "Ubah" pada terakhir kali:
  //   'direct'       → tombol/link "Ubah" langsung terlihat di kartu (umumnya desktop)
  //   'kebab'        → dibuka lewat menu "⋮"/overflow di kartu (umumnya mobile)
  //   'menu-overlay' → "Ubah" muncul sebagai overlay/menuitem di luar kartu (pasca-kebab)
  //   ''             → belum pernah/ gagal membuka
  // Dipakai TC mobile untuk memverifikasi jalur navigasi khas mobile & mencatatnya.
  private lastEditOpenPath: 'direct' | 'kebab' | 'menu-overlay' | '' = '';
  getLastEditOpenPath(): string {
    return this.lastEditOpenPath;
  }

  // --- Navigasi ---
  // Item "Listing" — di DESKTOP berupa sidebar button; di MOBILE sidebar collapse &
  // item nav di-render sebagai LINK (role=link), plus ada card "Listing" di dashboard
  // yang juga link. Cocokkan button ATAU link agar navigasi jalan di kedua viewport;
  // ambil first match untuk konsistensi (semuanya menuju daftar listing).
  private get menuListing() {
    return this.page
      .getByRole('button', { name: 'Listing', exact: true })
      .or(this.page.getByRole('link', { name: 'Listing', exact: true }))
      .first();
  }

  private get btnBuatListing() {
    return this.page.getByRole('button', { name: 'Buat Listing' });
  }

  // --- Upload Foto ---
  private get btnPilihFoto() {
    return this.page.getByRole('button', { name: 'Pilih Foto' });
  }

  private get btnCropUpload() {
    return this.page.getByRole('button', { name: 'Crop & Upload' });
  }

  private get btnSubmitCrop() {
    return this.page.getByRole('button', { name: 'Submit' });
  }

  // --- Form Fields ---
  protected get inputJudul() {
    return this.page.getByRole('textbox', { name: 'Judul Listing *' });
  }

  protected get inputDeskripsi() {
    return this.page.getByRole('textbox', { name: 'Deskripsi *' });
  }

  private get inputHargaJual() {
    return this.page.getByRole('textbox', { name: 'Harga Jual *' });
  }

  // Muncul menggantikan Harga Jual saat Transaksi = "Disewa".
  private get inputHargaSewa() {
    return this.page.getByRole('textbox', { name: 'Harga Sewa *' });
  }

  // Toggle chip transaksi (Dijual/Disewa). Klik hanya jika value ada & chip terlihat.
  private async pilihTransaksi(value?: string) {
    if (!value) return; // default UI = Dijual, biarkan apa adanya
    const chip = this.page.getByText(value, { exact: true }).first();
    if ((await chip.count()) > 0 && (await chip.isVisible().catch(() => false))) {
      await chip.click();
      await this.page.waitForTimeout(500); // beri waktu label field harga berganti
    }
  }

  private get dropdownGrupListing() {
    return this.page.getByRole('combobox').filter({ hasText: 'Pilih grup listing' });
  }

  private get dropdownTipeProperti() {
    return this.page.getByRole('combobox').filter({ hasText: 'Pilih tipe properti' });
  }

  private get inputKomisi() {
    return this.page.getByRole('textbox', { name: 'Komisi *' });
  }

  private get dropdownDokumenLegal() {
    return this.page.getByRole('combobox').filter({ hasText: 'Pilih dokumen legal' });
  }

  private get dropdownNegara() {
    return this.page.getByRole('combobox', { name: 'Negara *' });
  }

  private get dropdownProvinsi() {
    return this.page.getByRole('combobox', { name: 'Provinsi *' });
  }

  private get dropdownKota() {
    return this.page.getByRole('combobox', { name: 'Kota *' });
  }

  private get dropdownArea() {
    return this.page.getByRole('combobox', { name: 'Area *' });
  }

  protected get inputAlamat() {
    return this.page.getByRole('textbox', { name: 'Alamat (Tanpa blok/nomor) *' });
  }

  protected get inputBlokNomor() {
    return this.page.getByRole('textbox', { name: 'Blok dan Nomor *' });
  }

  private get dropdownArahHadap() {
    return this.page.getByRole('combobox').filter({ hasText: 'Pilih arah' });
  }

  // Combobox Arah Hadap SETELAH terisi (teks tak lagi "Pilih arah" → getter di atas tak
  // match). Cocokkan via enum arah mata angin agar nilai tersimpan bisa dibaca ulang.
  private get comboArahHadapTerisi() {
    return this.page
      .getByRole('combobox')
      .filter({
        hasText:
          /pilih arah|utara|selatan|timur laut|barat laut|barat daya|tenggara|timur|barat/i,
      })
      .first();
  }

  // Baca nilai Arah Hadap yang sedang tampil di form (string kosong bila tak ada).
  private async bacaArahHadap(): Promise<string> {
    const combo = this.comboArahHadapTerisi;
    if ((await combo.count()) === 0) return '';
    return (await combo.innerText().catch(() => '')).trim();
  }

  // Field spesifikasi: sebagian tipe (mis. Ruko/Gudang) merender input TANPA accessible-name
  // sehingga getByRole({name}) tak match — fallback ke placeholder yang selalu ada di semua tipe.
  private get inputLuasTanah() {
    return this.page.getByRole('textbox', { name: 'Luas Tanah *' })
      .or(this.page.getByPlaceholder('Masukkan luas tanah'));
  }

  private get inputLuasBangunan() {
    return this.page.getByRole('textbox', { name: 'Luas Bangunan *' })
      .or(this.page.getByPlaceholder('Masukkan luas bangunan'));
  }

  private get inputKamarTidur() {
    return this.page.getByRole('textbox', { name: 'Kamar Tidur *' })
      .or(this.page.getByPlaceholder('Masukkan jumlah kamar tidur'));
  }

  private get inputKamarMandi() {
    return this.page.getByRole('textbox', { name: 'Kamar Mandi *' })
      .or(this.page.getByPlaceholder('Masukkan jumlah kamar mandi'));
  }

  private get inputLebarProperti() {
    return this.page.getByRole('textbox', { name: 'Lebar Properti' })
      .or(this.page.getByPlaceholder('Masukkan lebar properti'));
  }

  private get inputPanjangProperti() {
    return this.page.getByRole('textbox', { name: 'Panjang Properti' })
      .or(this.page.getByPlaceholder('Masukkan panjang properti'));
  }

  private get dropdownDayaListrik() {
    return this.page.getByRole('combobox').filter({ hasText: 'Pilih daya listrik' });
  }

  private get dropdownJenisAir() {
    return this.page.getByRole('combobox').filter({ hasText: 'Pilih jenis air' });
  }

  private get inputNamaVendor() {
    return this.page.getByRole('textbox', { name: 'Nama Vendor *' });
  }

  private get inputNoTelpVendor() {
    return this.page.getByRole('textbox', { name: 'Nomor Telepon Vendor *' });
  }

  protected get btnSubmitFinal() {
    // Match berbagai variasi label tombol final submit di Create Listing
    return this.page
      .getByRole('button', { name: /^(Submit|Buat Listing|Tambah Listing|Simpan|Kirim)$/i })
      .last();
  }

  // --- Actions ---

  async navigasiKeDashboard(username?: string, password?: string) {
    // Di dev/staging, login() bisa langsung me-redirect ke domain dashboard agen
    // (mis. host dashboard khusus dev). Navigasi ulang ke URL yang sama saat
    // redirect SPA masih jalan memicu net::ERR_ABORTED — jadi skip goto kalau host
    // sudah cocok & bukan halaman login.
    const dashHost = (() => { try { return new URL(this.agentDashboardUrl).host; } catch { return ''; } })();
    const sudahDiDashboard =
      this.page.url().includes(dashHost) && !this.page.url().includes('/login');
    if (!sudahDiDashboard) {
      await this.page
        .goto(this.agentDashboardUrl, { waitUntil: 'domcontentloaded' })
        .catch(async () => {
          // ERR_ABORTED akibat race redirect — tunggu sebentar lalu lanjut.
          await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        });
    }
    await this.page.waitForTimeout(1000);

    // Portal agen punya halaman login sendiri jika belum login
    const currentUrl = this.page.url();
    const isLoginPage =
      currentUrl.includes('/agent/login') ||
      (await this.page.locator('text=Agent Login').isVisible({ timeout: 2000 }).catch(() => false));

    if (isLoginPage && username && password) {
      // reCAPTCHA v3 (invisible, badge kanan-bawah) bisa menolak sesi OTOMATIS
      // secara diam-diam → login gagal TANPA toast & URL tetap di /agent/login.
      // Karena itu: jangan sekadar klik sekali lalu blind-wait 30s. Coba beberapa
      // kali (isi form → klik Login → tunggu redirect; kalau masih login, reload
      // & ulang), dan kalau tetap gagal lempar pesan diagnostik yang jelas.
      const MAX_ATTEMPT = 3;
      let lastToast = '';
      for (let attempt = 1; attempt <= MAX_ATTEMPT; attempt++) {
        // SELURUH attempt (isi form + klik + tunggu redirect) dibungkus try +
        // diberi timeout eksplisit. Tanpa ini, fill bisa menggantung sampai test
        // timeout (600s) kalau pasca-reload input belum actionable — bukan retry.
        try {
          // Isi form — coba getByLabel dulu, fallback ke locator visible.
          const emailLabel = this.page.getByLabel('Email/Username');
          if (await emailLabel.count() > 0) {
            await emailLabel.fill(username, { timeout: 10000 });
          } else {
            await this.page.locator('input:visible').first().fill(username, { timeout: 10000 });
          }

          const passLabel = this.page.getByLabel('Password');
          if (await passLabel.count() > 0) {
            await passLabel.fill(password, { timeout: 10000 });
          } else {
            // Fallback: input visible kedua (skip hidden inputs)
            await this.page.locator('input:visible').nth(1).fill(password, { timeout: 10000 });
          }

          await this.page.getByRole('button', { name: 'Login' }).click({ timeout: 10000 });

          // Tunggu redirect keluar dari /login (sukses). Timeout per-attempt 15s.
          await this.page.waitForURL(
            (url) => !url.toString().includes('login'),
            { timeout: 15000 }
          );
          break; // login sukses
        } catch {
          // Attempt gagal (form belum siap / reCAPTCHA tolak / masih di /login) →
          // tangkap toast untuk diagnosa, reload, ulang.
          lastToast =
            (await this.page
              .locator('ol.toaster li')
              .last()
              .innerText({ timeout: 1000 })
              .catch(() => '')) || '';
          if (attempt < MAX_ATTEMPT) {
            await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
            await this.page.waitForTimeout(2000);
          }
        }
      }

      // Kalau setelah semua percobaan URL tetap di /login → gagal nyata.
      if (this.page.url().includes('login')) {
        throw new Error(
          `Login agen tidak lolos setelah ${MAX_ATTEMPT} percobaan (URL tetap di /login). ` +
            (lastToast
              ? `Toast: "${lastToast}". `
              : 'Tanpa toast error → indikasi reCAPTCHA menolak sesi otomatis. ') +
            `Jalankan headed dengan Chrome asli: set USE_CHROME_CHANNEL=true ` +
            `(script "test:regression:gated" sudah menyetelnya).`
        );
      }

      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(1000);
    }

    // Tunggu sidebar/dashboard muncul — tombol menu Listing sebagai indikator.
    // CI environment lebih lambat → naikkan timeout ke 45s + fallback open sidebar
    // jika collapsed (hamburger menu di viewport sempit).
    try {
      await this.menuListing.waitFor({ state: 'visible', timeout: 45000 });
    } catch {
      // Fallback: buka sidebar yang collapse di viewport sempit. Tombol toggle di
      // dashboard agen bernama "Toggle Sidebar" (mobile); sertakan juga hamburger/menu.
      const hamburger = this.page
        .getByRole('button', { name: /toggle sidebar|menu|hamburger/i })
        .first();
      if (await hamburger.count() > 0) {
        await hamburger.click().catch(() => {});
        await this.page.waitForTimeout(800);
      }
      await this.menuListing.waitFor({ state: 'visible', timeout: 20000 });
    }
    await this.page.waitForTimeout(500);
  }

  async bukaFormBuatListing() {
    // Strategi:
    //   1) Coba klik menu Listing dari sidebar (manual flow). Jika "Buat Listing"
    //      tampil → klik.
    //   2) Kalau menu klik tidak menjamin /listing terbuka, fallback navigate
    //      langsung ke URL form (/listing/buat).
    await this.menuListing.click().catch(() => {});
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.waitForTimeout(1500);

    const buatVisibleAfterMenu = await this.btnBuatListing
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (buatVisibleAfterMenu) {
      await this.btnBuatListing.first().click();
    } else {
      // Fallback: direct URL ke form Buat Listing
      const dashboard = new URL(this.agentDashboardUrl);
      const buatUrl = `${dashboard.origin}/listing/add`;
      await this.page.goto(buatUrl, { waitUntil: 'domcontentloaded' });
    }
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1500);
  }

  async uploadFotoListing(fotoPaths: string[]) {
    for (const fotoPath of fotoPaths) {
      // Klik "Pilih Foto" dan intercept file chooser per foto. Kadang klik tidak memicu
      // event filechooser (transient) → coba ulang beberapa kali.
      let fileChooser!: FileChooser;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          [fileChooser] = await Promise.all([
            this.page.waitForEvent('filechooser', { timeout: 10000 }),
            this.btnPilihFoto.click(),
          ]);
          break;
        } catch (e) {
          if (attempt === 2) throw e;
          await this.page.waitForTimeout(1000);
        }
      }
      await fileChooser.setFiles(fotoPath);

      // Tunggu tombol Crop & Upload muncul
      await this.btnCropUpload.first().waitFor({ state: 'visible', timeout: 10000 });
      await this.btnCropUpload.first().click();

      // Tunggu tombol Submit di dalam crop dialog
      await this.btnSubmitCrop.waitFor({ state: 'visible', timeout: 5000 });
      await this.btnSubmitCrop.click();

      // Tunggu crop dialog menutup sebelum mengecek photo card
      await this.page.waitForTimeout(2000);

      // Tunggu "Sukses Upload" — upload ke server kadang "Gagal Upload" (transient);
      // klik "Coba Lagi" dan ulangi beberapa kali sebelum menyerah.
      await this.tungguUploadSukses();
      await this.page.waitForTimeout(300);
    }
  }

  // Tunggu konfirmasi "Sukses Upload" pada photo card. Jika upload gagal (server transient),
  // klik "Coba Lagi" dan ulangi hingga `maksCoba` kali.
  private async tungguUploadSukses(maksCoba = 3) {
    for (let i = 0; i < maksCoba; i++) {
      try {
        await this.page.waitForSelector('text=Sukses Upload', { timeout: 45000 });
        return;
      } catch {
        const cobaLagi = this.page.getByRole('button', { name: /coba lagi/i }).first();
        if (await cobaLagi.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cobaLagi.click();
          await this.page.waitForTimeout(2000);
          continue;
        }
        throw new Error('Upload foto gagal dan tombol "Coba Lagi" tidak tersedia');
      }
    }
    throw new Error(`Upload foto tetap gagal setelah ${maksCoba}x percobaan ("Coba Lagi")`);
  }

  async isiInfoDasar(data: ListingData) {
    await this.isiJikaAda(this.inputJudul, data.judul);
    await this.isiJikaAda(this.inputDeskripsi, data.deskripsi);

    // Transaksi (Dijual default / Disewa) — dipilih SEBELUM isi harga karena label field
    // harga ikut berganti (Harga Jual ↔ Harga Sewa).
    await this.pilihTransaksi(data.transaksi);
    if (data.transaksi === 'Disewa') {
      await this.isiJikaAda(this.inputHargaSewa, data.hargaSewa ?? data.hargaJual);
    } else {
      await this.isiJikaAda(this.inputHargaJual, data.hargaJual);
    }

    await this.pilihDropdownOpsi(this.dropdownGrupListing, data.grupListing);
    await this.pilihDropdownByLabel(this.dropdownTipeProperti, data.tipeProperti, true);

    await this.isiJikaAda(this.inputKomisi, data.komisi);
    await this.klikTeksJikaAda(data.statusListing);

    await this.pilihDropdownByLabel(this.dropdownDokumenLegal, data.dokumenLegal);

    // Field khusus grup Primary — diisi hanya jika muncul (textbox atau dropdown)
    await this.isiOpsionalByLabel('Nama Proyek', data.namaProyek);
    await this.isiOpsionalByLabel('Developer', data.developer);
  }

  async isiLokasi(data: ListingData) {
    await this.pilihDropdownOpsi(this.dropdownNegara, data.negara);
    await this.pilihDropdownOpsi(this.dropdownProvinsi, data.provinsi);
    await this.pilihDropdownOpsi(this.dropdownKota, data.kota);
    await this.pilihDropdownOpsi(this.dropdownArea, data.area);

    await this.isiJikaAda(this.inputAlamat, data.alamat);
    await this.isiJikaAda(this.inputBlokNomor, data.blokNomor);

    await this.pilihDropdownOpsi(this.dropdownArahHadap, data.arahHadap, true);
  }

  async isiSpesifikasi(data: ListingData) {
    await this.isiJikaAda(this.inputLuasTanah, data.luasTanah);
    await this.isiJikaAda(this.inputLuasBangunan, data.luasBangunan);
    await this.isiJikaAda(this.inputKamarTidur, data.kamarTidur);
    await this.isiJikaAda(this.inputKamarMandi, data.kamarMandi);
    await this.isiJikaAda(this.inputLebarProperti, data.lebarProperti);
    await this.isiJikaAda(this.inputPanjangProperti, data.panjangProperti);

    await this.pilihDropdownOpsi(this.dropdownDayaListrik, data.dayaListrik);
    await this.pilihDropdownByLabel(this.dropdownJenisAir, data.jenisAir);
  }

  async isiVendor(data: ListingData) {
    await this.isiJikaAda(this.inputNamaVendor, data.namaVendor);
    await this.isiJikaAda(this.inputNoTelpVendor, data.noTelpVendor);
  }

  // --- Verifikasi per-field (baca-balik nilai input) ---
  // Peta nama field → locator input teks/angka yang nilainya bisa dibaca ulang.
  // Dipakai spec untuk memverifikasi TIAP field terisi benar (satu TC per field).
  private get petaFieldInput(): Record<string, Locator> {
    return {
      'Judul Listing': this.inputJudul,
      'Deskripsi': this.inputDeskripsi,
      'Harga Jual': this.inputHargaJual,
      'Komisi': this.inputKomisi,
      'Alamat': this.inputAlamat,
      'Blok dan Nomor': this.inputBlokNomor,
      'Luas Tanah': this.inputLuasTanah,
      'Luas Bangunan': this.inputLuasBangunan,
      'Kamar Tidur': this.inputKamarTidur,
      'Kamar Mandi': this.inputKamarMandi,
      'Lebar Properti': this.inputLebarProperti,
      'Panjang Properti': this.inputPanjangProperti,
      'Nama Vendor': this.inputNamaVendor,
      'Nomor Telepon Vendor': this.inputNoTelpVendor,
    };
  }

  // Baca nilai terkini sebuah field input (untuk verifikasi per-field). Return ''
  // jika field tidak ada / tidak terlihat (mis. tak muncul untuk tipe properti ini).
  async bacaNilaiFieldInput(namaField: string): Promise<string> {
    const loc = this.petaFieldInput[namaField];
    if (!loc) return '';
    if ((await loc.count()) === 0 || !(await loc.first().isVisible().catch(() => false))) {
      return '';
    }
    return (await loc.first().inputValue().catch(() => '')).trim();
  }

  // True bila field input `namaField` memang muncul & terlihat di form saat ini.
  async fieldInputTerlihat(namaField: string): Promise<boolean> {
    const loc = this.petaFieldInput[namaField];
    if (!loc) return false;
    return (await loc.count()) > 0 && (await loc.first().isVisible().catch(() => false));
  }

  // Verifikasi dropdown/combobox: setelah opsi dipilih, kontrol combobox menampilkan
  // teks nilai terpilih (menggantikan placeholder "Pilih ..."). Cek ada combobox yang
  // SEDANG menampilkan `nilai` → bukti opsi tersebut benar-benar terpilih di form.
  // Dipakai untuk TC per-dropdown (grup, tipe, dokumen legal, lokasi, arah, dll).
  async dropdownMenampilkanNilai(nilai: string): Promise<boolean> {
    const cb = this.page.getByRole('combobox').filter({ hasText: nilai }).first();
    return cb.isVisible({ timeout: 5000 }).catch(() => false);
  }

  // --- Helper pengisian adaptif (skip-if-absent) ---
  // Isi textbox hanya jika value ada DAN field-nya muncul & terlihat.
  protected async isiJikaAda(locator: Locator, value?: string) {
    if (!value) return;
    if ((await locator.count()) === 0) return;
    const el = locator.first();
    if (!(await el.isVisible().catch(() => false))) return;
    await el.fill(value);
  }

  // Klik elemen berteks (mis. chip status OPEN) hanya jika ada & terlihat.
  protected async klikTeksJikaAda(value?: string) {
    if (!value) return;
    const loc = this.page.getByText(value).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
      await loc.click();
    }
  }

  // Buka dropdown (jika ada & terlihat) lalu pilih opsi `value`. Skip jika dropdown tak muncul.
  // Dropdown async (mis. Area menunggu Kota) kadang opsinya telat termuat → coba ulang sekali
  // dengan membuka ulang dropdown.
  protected async pilihDropdownOpsi(dropdown: Locator, value?: string, exact = false) {
    if (!value) return;
    if ((await dropdown.count()) === 0 || !(await dropdown.first().isVisible().catch(() => false))) {
      return;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      await dropdown.first().click();
      try {
        await this.pilihOpsi(value, exact);
        return;
      } catch (e) {
        if (attempt === 1) throw e;
        await this.page.waitForTimeout(1200); // beri waktu opsi async termuat, lalu buka ulang
      }
    }
  }

  // Alias historis — beberapa dropdown dulu dipilih via getByLabel; kini sama-sama pakai pilihOpsi.
  private async pilihDropdownByLabel(dropdown: Locator, value?: string, exact = false) {
    await this.pilihDropdownOpsi(dropdown, value, exact);
  }

  // Pilih opsi dari dropdown yang SEDANG terbuka. Sebagian dropdown pada form ini bersifat
  // searchable + ter-virtualisasi (mis. Kota/Area/Dokumen Legal): opsi jauh di daftar
  // tidak ter-render sampai difilter. Jadi: kalau dropdown punya kotak "Cari", ketik dulu
  // untuk memfilter, baru klik. Timeout PENDEK agar opsi yang tak ada gagal cepat.
  protected async pilihOpsi(value: string, exact = false) {
    // Ketik ke kotak pencarian di dalam dropdown yang terbuka (jika ada).
    const cariBox = this.page.locator('input[placeholder*="cari" i]:visible').last();
    const punyaCari = await cariBox.isVisible({ timeout: 1500 }).catch(() => false);
    if (punyaCari) {
      await cariBox.fill(value);
    }

    const kandidat: Locator[] = [
      this.page.getByRole('option', { name: value, exact }),
      this.page
        .locator('[role="listbox"], [role="menu"], ul, .dropdown, [class*="option"], [class*="menu"]')
        .getByText(value, { exact }),
      this.page.getByText(value, { exact }),
    ];

    // Dropdown ter-filter via API (mis. Kota/Area) lambat & FLUKTUATIF memuat opsi di
    // env dev/staging. Poll kandidat hingga ~25s, dan re-type query tiap beberapa detik
    // (kadang fill awal ter-reset saat list re-render) sebelum menyerah.
    const batasMs = 25000;
    const mulai = Date.now();
    let iter = 0;
    while (Date.now() - mulai < batasMs) {
      for (const k of kandidat) {
        const el = k.first();
        if (await el.isVisible({ timeout: 0 }).catch(() => false)) {
          await el.click();
          return;
        }
      }
      iter++;
      // Tiap 3 iterasi, ketik ulang query (jaga-jaga input ter-reset oleh re-render).
      if (punyaCari && iter % 3 === 0 && (await cariBox.isVisible().catch(() => false))) {
        await cariBox.fill('');
        await cariBox.fill(value);
      }
      await this.page.waitForTimeout(1000);
    }
    throw new Error(`Opsi dropdown "${value}" tidak ditemukan setelah dropdown dibuka`);
  }

  // Dropdown filter status daftar listing. Labelnya = status aktif (mis. "Tunda")
  // dan berubah setelah memilih, jadi cocokkan salah satu nama status.
  private get dropdownStatusListing() {
    return this.page
      .getByRole('button', { name: /^\s*(tayang|tunda|kadaluarsa)\s*$/i })
      .first();
  }

  // Filter status daftar listing bersifat SINGLE-SELECT (Tayang/Tunda/Kadaluarsa) —
  // TIDAK ada opsi "Semua". Pilih status `status`; return true bila berhasil/sudah aktif.
  private async pilihFilterStatus(status: string): Promise<boolean> {
    const dd = this.dropdownStatusListing;
    if (!(await dd.isVisible({ timeout: 4000 }).catch(() => false))) return false;

    const aktif = (await dd.innerText().catch(() => '')).trim().toLowerCase();
    if (aktif.includes(status.toLowerCase())) return true; // sudah di status ini

    await dd.click();
    await this.page.waitForTimeout(400);
    // Pilih opsi DI DALAM popup dropdown — hindari match teks counter "Tayang: 0" di header.
    const popup = this.page.locator(
      '[role="listbox"], [role="menu"], [class*="dropdown"], [class*="menu"], [class*="option"]'
    );
    const opt = popup
      .getByText(status, { exact: true })
      .first()
      .or(this.page.getByRole('option', { name: status, exact: true }).first());
    if (await opt.isVisible({ timeout: 2500 }).catch(() => false)) {
      await opt.click();
      await this.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await this.page.waitForTimeout(600);
      return true;
    }
    await this.page.keyboard.press('Escape').catch(() => {});
    return false;
  }

  // Kosongkan kotak cari (untuk diagnostik: lihat berapa listing tanpa filter judul).
  private async bersihkanCari() {
    const cari = this.page.getByPlaceholder(/cari/i).first();
    if (await cari.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cari.fill('');
      await cari.press('Enter').catch(() => {});
      await this.page.waitForTimeout(1500);
    }
  }

  // Baca teks counter "Total: N" di header daftar (diagnostik kegagalan pencarian).
  private async bacaTotalListing(): Promise<string> {
    const totalEl = this.page.getByText(/total\s*:/i).first();
    return (await totalEl.innerText({ timeout: 2000 }).catch(() => '')).trim();
  }

  // Ketik judul di kolom "Cari..." daftar listing untuk menghindari masalah paginasi/urutan
  // (daftar bisa berisi puluhan listing). Aman di-skip kalau kolom cari tak ada.
  private async cariListing(judul: string) {
    const cari = this.page.getByPlaceholder(/cari/i).first();
    if (await cari.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cari.fill(judul);
      await cari.press('Enter');
      await this.page.waitForTimeout(2000);
    }
  }

  // Field opsional yang bentuknya belum pasti (textbox ATAU combobox) — mis. field Primary.
  private async isiOpsionalByLabel(label: string, value?: string) {
    if (!value) return;
    const tb = this.page.getByRole('textbox', { name: label });
    if ((await tb.count()) > 0 && (await tb.first().isVisible().catch(() => false))) {
      await tb.first().fill(value);
      return;
    }
    const cb = this.page.getByRole('combobox', { name: label });
    if ((await cb.count()) > 0 && (await cb.first().isVisible().catch(() => false))) {
      await cb.first().click();
      const opt = this.page.getByRole('option', { name: value }).first();
      if ((await opt.count()) > 0) await opt.click();
    }
  }

  async submitListing() {
    await this.btnSubmitFinal.click();

    // Dialog konfirmasi muncul — klik tombol konfirmasi (Ya / Lanjut / Setuju)
    const konfirmasiSelectors = [
      this.page.getByRole('button', { name: 'Ya' }),
      this.page.getByRole('button', { name: 'Lanjut' }),
      this.page.getByRole('button', { name: 'Setuju' }),
      this.page.getByRole('button', { name: 'OK' }),
      this.page.getByRole('button', { name: 'Kirim' }),
    ];

    for (const btn of konfirmasiSelectors) {
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click();
        break;
      }
    }

    // Tangkap toast sukses SECEPATNYA (toast bisa cepat menghilang).
    this.lastSuccessMessage = await this.tangkapPesanSukses();

    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);
  }

  // Tangkap pesan sukses pasca-submit: coba match teks khas dulu, lalu selector toast umum.
  private async tangkapPesanSukses(): Promise<string> {
    const byText = this.page
      .getByText(/berhasil|sukses|ditambahkan|tersimpan|menunggu|dibuat|disimpan/i)
      .first();
    if (await byText.isVisible({ timeout: 8000 }).catch(() => false)) {
      return (await byText.innerText().catch(() => '')).trim();
    }
    return await this.getSuccessMessage();
  }

  // Klik menu/link "Listing" dengan aman di desktop & mobile. Di mobile sidebar
  // bisa collapse (pasca-submit) → item "Listing" tidak langsung terlihat; buka
  // dulu via "Toggle Sidebar". Klik diberi timeout terbatas + fallback navigasi
  // langsung ke /listing agar TIDAK menggantung sampai test timeout (naked
  // .click() tanpa timeout dibatasi hanya oleh test timeout → hang bermenit-menit).
  private async klikMenuListing(): Promise<void> {
    if (!(await this.menuListing.isVisible({ timeout: 3000 }).catch(() => false))) {
      const toggle = this.page
        .getByRole('button', { name: /toggle sidebar|menu|hamburger/i })
        .first();
      if ((await toggle.count()) > 0) {
        await toggle.click().catch(() => {});
        await this.page.waitForTimeout(800);
      }
    }
    try {
      await this.menuListing.click({ timeout: 15000 });
    } catch {
      const origin = new URL(this.agentDashboardUrl).origin;
      await this.page.goto(`${origin}/listing`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
  }

  async verifikasiListingBerhasil(judulListing: string) {
    // Navigasi ke daftar listing via menu (aman desktop & mobile)
    await this.klikMenuListing();

    // Jika ada dialog konfirmasi "Form belum disimpan" → klik Lanjut
    const btnLanjut = this.page.getByRole('button', { name: 'Lanjut' });
    if (await btnLanjut.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btnLanjut.click();
    }

    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1500);

    // Expected: muncul listing yang baru dibuat di tabel/list (case-insensitive)
    await expect(
      this.page.getByText(judulListing, { exact: false }).first()
    ).toBeVisible({ timeout: 20000 });
  }

  // Verifikasi sukses berbasis toast — andal untuk listing yang masuk status "Tunda"
  // (tidak bergantung pada filter daftar). Sukses = toast sukses tertangkap ATAU
  // sudah keluar dari form (form Tambah Listing tidak lagi tampil).
  async verifikasiSubmitSukses(testInfo?: TestInfo) {
    // Tidak boleh ada error field wajib.
    await this.verifikasiTanpaErrorWajib(testInfo);

    const adaToast = this.lastSuccessMessage.length > 0;
    const masihDiForm = await this.inputJudul.isVisible({ timeout: 3000 }).catch(() => false);
    const sukses = adaToast || !masihDiForm;

    if (testInfo) {
      const shot = await this.page.screenshot({ fullPage: true });
      await testInfo.attach('Setelah Submit', { body: shot, contentType: 'image/png' });
      if (adaToast) {
        await testInfo.attach('Pesan Sukses', {
          body: this.lastSuccessMessage,
          contentType: 'text/plain',
        });
      }
    }

    expect(
      sukses,
      `Tidak ada indikasi sukses submit (toast="${this.lastSuccessMessage}", masihDiForm=${masihDiForm})`
    ).toBe(true);
  }

  async getSuccessMessage(): Promise<string> {
    const selectors = [
      '.toast',
      '.alert-success',
      '[class*="success"]',
      '[class*="toast"]',
      '[role="alert"]',
      '.notification',
    ];

    for (const sel of selectors) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        return await el.innerText().catch(() => '');
      }
    }
    return '';
  }

  // Pengaman pendekatan skip-if-absent: jika ada field WAJIB yang seharusnya diisi
  // tapi terlewat (karena tak terdeteksi), form akan memunculkan pesan error.
  // Method ini mengubah "skip diam-diam" menjadi kegagalan eksplisit dengan pesan jelas.
  async verifikasiTanpaErrorWajib(testInfo?: TestInfo) {
    const errorLocator = this.page.locator(
      'text=/wajib|harus diisi|tidak boleh kosong|required/i'
    );
    const count = await errorLocator.count();
    const visibleErrors: string[] = [];
    for (let i = 0; i < count; i++) {
      const el = errorLocator.nth(i);
      if (await el.isVisible().catch(() => false)) {
        const teks = (await el.innerText().catch(() => '')).trim();
        if (teks) visibleErrors.push(teks);
      }
    }

    if (visibleErrors.length > 0) {
      if (testInfo) {
        const shot = await this.page.screenshot({ fullPage: true });
        await testInfo.attach('Error Field Wajib Terdeteksi', {
          body: shot,
          contentType: 'image/png',
        });
      }
      expect(
        visibleErrors,
        `Ada field wajib yang belum terisi (kemungkinan terlewat skip-if-absent): ${visibleErrors.join(' | ')}`
      ).toEqual([]);
    }
  }

  // Buka daftar listing via menu sidebar (menangani dialog "form belum disimpan").
  private async bukaDaftarListing() {
    await this.klikMenuListing();
    const btnLanjut = this.page.getByRole('button', { name: 'Lanjut' });
    if (await btnLanjut.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btnLanjut.click();
    }
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Klik menu = ganti route SPA, tapi KONTEN daftar bisa belum termuat (dashboard
    // masih tampil sementara). Tunggu indikator halaman daftar benar-benar muncul —
    // kotak "Cari" atau tombol "Buat Listing" — sebelum mencari baris listing.
    const indikatorDaftar = this.page
      .getByPlaceholder(/cari/i)
      .first()
      .or(this.btnBuatListing.first());
    try {
      await indikatorDaftar.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      // Fallback: navigasi langsung ke URL daftar listing.
      const origin = new URL(this.agentDashboardUrl).origin;
      await this.page
        .goto(`${origin}/listing`, { waitUntil: 'domcontentloaded' })
        .catch(() => {});
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await indikatorDaftar.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    }
    await this.page.waitForTimeout(1000);
  }

  // Cari kartu listing ber-ID `judul` lalu klik aksi "Ubah".
  //
  // Struktur kartu (diverifikasi via dump DOM, dashboard agen mobile 2026-07-07):
  //   - ID tampil sebagai teks "ID: <id>" (mis. "ID: 031426-BRE00004").
  //   - Tiap kartu punya tombol INLINE: "Sundul", "Ubah", "Hapus", + kebab
  //     (button[data-slot="dropdown-menu-trigger"]). "Ubah" = tombol teks langsung.
  //   - Tiap kartu juga punya <a class="hidden" href=".../cari-properti/view/..."> →
  //     JANGAN klik badan kartu (navigasi ke DETAIL PUBLIK, bukan form edit).
  // Strategi: anchor ke teks "ID: <id>" (unik) → naik ke div kartu terdekat (ancestor
  // pertama yang memuat tombol "Ubah") → klik tombol "Ubah" DI kartu itu.
  private async bukaEditListing(judul: string, timeoutMs = 15000): Promise<boolean> {
    const idText = this.page.getByText(`ID: ${judul}`, { exact: false }).first();
    try {
      await idText.waitFor({ state: 'visible', timeout: timeoutMs });
    } catch {
      return false;
    }
    await idText.scrollIntoViewIfNeeded().catch(() => {});

    // Kartu = div TERKETAT (innermost) yang memuat BAIK teks "ID: <id>" MAUPUN tombol
    // "Ubah". Div yang cocok bersarang (kartu s/d container daftar) → dalam urutan
    // dokumen, elemen terdalam muncul TERAKHIR → .last() = kartu paling ketat. Ini
    // menghindari salah-klik tombol "Ubah" milik kartu lain.
    // ⚠️ Tombol "Ubah" TIDAK match getByRole('button',{name:'Ubah'}) — accessible name-nya
    // bukan "Ubah" (ada ikon/svg). Gunakan has-text (terbukti via DIAG: 10 tombol terdeteksi).
    const ubahBtn = this.page.locator('button', { hasText: 'Ubah' });
    const kartu = this.page
      .locator('div')
      .filter({ has: this.page.getByText(`ID: ${judul}`, { exact: false }) })
      .filter({ has: ubahBtn })
      .last();

    const ubah = kartu.locator('button', { hasText: 'Ubah' }).first();
    if ((await ubah.count()) === 0) return false;
    // Tombol "Ubah" inline (data-slot="button"), BUKAN badan kartu / link detail publik.
    await ubah.scrollIntoViewIfNeeded().catch(() => {});
    if (!(await ubah.isVisible({ timeout: 3000 }).catch(() => false))) return false;
    await ubah.click();
    this.lastEditOpenPath = 'direct';
    return true;
  }

  // Pola ID listing platform, mis. "131226-ABC00007" (digit - huruf - digit).
  private static readonly POLA_ID_LISTING = /\d{4,}-[A-Z]{2,}\d{3,}/;

  // Ambil ID listing dari kartu PERTAMA pada filter `status` (mis. "Tayang").
  // Dipakai bila target edit tidak di-hardcode: ambil listing NYATA pertama yang ada
  // di akun, lalu ID-nya jadi target deterministik untuk seluruh langkah edit/verifikasi
  // dalam run tsb. Mengembalikan ID (mis. "131226-ABC00007").
  async ambilIdListingPertama(status = 'Tayang'): Promise<string> {
    await this.bukaDaftarListing();
    await this.pilihFilterStatus(status);
    await this.bersihkanCari();
    await this.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await this.page.waitForTimeout(1200);

    // ID tampil sebagai teks "ID: <id>" di tiap kartu → ambil paragraf ID pertama.
    const idPara = this.page.getByText(/ID:\s*\d{4,}-[A-Z]{2,}\d{3,}/i).first();
    await idPara.waitFor({ state: 'visible', timeout: 20000 });

    const teks = (await idPara.innerText().catch(() => '')) || '';
    const m = teks.match(BuatListingPage.POLA_ID_LISTING);
    expect(
      m,
      `Tidak bisa mengekstrak ID listing dari kartu pertama status "${status}". Cuplikan teks: "${teks.slice(0, 200)}"`
    ).toBeTruthy();
    return m![0];
  }

  // Buka form edit untuk listing berjudul `judul`: buka daftar → set filter Semua →
  // cari judul → klik aksi "Ubah". Dipisah dari editListing agar bisa dipakai ulang
  // untuk verifikasi (buka kembali form lalu baca nilai field).
  async bukaFormEditListing(judul: string, testInfo?: TestInfo) {
    await this.bukaDaftarListing();

    // Filter status single-select (tanpa "Semua") → telusuri ketiga status sampai
    // listing ber-ID `penanda` ketemu.
    //
    // ⚠️ Quirk MOBILE (Pixel 5): (a) kotak "Cari" TIDAK andal menyurfacekan kartu via ID,
    // dan (b) mengosongkan search yang sebelumnya nol-hasil TIDAK memulihkan daftar (body
    // tetap "Belum ada listing"). Karena itu JANGAN mengandalkan search: untuk tiap status
    // MUAT ULANG daftar dari nol (bukaDaftarListing → search kosong, daftar ter-render),
    // pilih status, lalu SCROLL-SCAN kartu (daftar lazy-load). Ini juga andal di desktop.
    const penanda = judul;
    const statuses = ['Tayang', 'Tunda', 'Kadaluarsa'];
    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i];
      // Muat ulang daftar bersih tiap status (kecuali status pertama yang sudah dimuat
      // oleh bukaDaftarListing di atas) → hindari polusi search dari status sebelumnya.
      if (i > 0) await this.bukaDaftarListing();
      await this.pilihFilterStatus(status);
      // ⚠️ WAJIB: bersihkanCari (fill '' + Enter) di sini MEMICU daftar benar-benar
      // ter-render di mobile. Tanpa ini, body kadang tetap "Belum ada listing" walau
      // counter status > 0 (sequence ini sama dengan ambilIdListingPertama yang terbukti).
      await this.bersihkanCari();
      await this.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await this.page.waitForTimeout(700);

      if (await this.bukaEditListingDenganScroll(penanda)) {
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(1500);
        return;
      }
    }

    const total = await this.bacaTotalListing();
    expect(
      false,
      `Tidak menemukan listing dengan penanda "${penanda}" di status ${statuses.join('/')}. ` +
        `(${total || 'total tak terbaca'}). Gunakan ID listing yang unik & pastikan ada di akun ini.`
    ).toBe(true);
  }

  // Cari & klik "Ubah" untuk kartu ber-ID `judul` sambil SCROLL ke bawah untuk memuat
  // kartu (daftar agen lazy-load — "Sisa sundul"). Berhenti saat ketemu atau mentok bawah.
  private async bukaEditListingDenganScroll(judul: string): Promise<boolean> {
    for (let i = 0; i < 15; i++) {
      if (await this.bukaEditListing(judul, 2500)) return true;
      const sebelum = await this.page.evaluate(() => window.scrollY).catch(() => 0);
      await this.page.mouse.wheel(0, 2200);
      await this.page.waitForTimeout(900);
      const sesudah = await this.page.evaluate(() => window.scrollY).catch(() => 0);
      if (sesudah === sebelum) break; // sudah mentok dasar daftar
    }
    return await this.bukaEditListing(judul, 2500);
  }

  // Terapkan perubahan field pada form edit yang sedang terbuka (adaptif — hanya yang muncul).
  private async terapkanPerubahan(perubahan: Partial<ListingData>) {
    // Info dasar
    await this.isiJikaAda(this.inputJudul, perubahan.judul);
    await this.isiJikaAda(this.inputDeskripsi, perubahan.deskripsi);
    await this.isiJikaAda(this.inputHargaJual, perubahan.hargaJual);
    await this.isiJikaAda(this.inputKomisi, perubahan.komisi);
    // Spesifikasi (numerik) — sering ikut diedit agen
    await this.isiJikaAda(this.inputLuasTanah, perubahan.luasTanah);
    await this.isiJikaAda(this.inputLuasBangunan, perubahan.luasBangunan);
    await this.isiJikaAda(this.inputKamarTidur, perubahan.kamarTidur);
    await this.isiJikaAda(this.inputKamarMandi, perubahan.kamarMandi);
    await this.isiJikaAda(this.inputLebarProperti, perubahan.lebarProperti);
    await this.isiJikaAda(this.inputPanjangProperti, perubahan.panjangProperti);
    // Arah hadap (dropdown) — opsional
    await this.pilihDropdownOpsi(this.dropdownArahHadap, perubahan.arahHadap, true);
  }

  // Edit listing yang sudah dibuat: buka form edit → terapkan perubahan → simpan.
  async editListing(judul: string, perubahan: Partial<ListingData>, testInfo?: TestInfo) {
    await this.bukaFormEditListing(judul, testInfo);

    // Diagnostik: pastikan form edit termuat DENGAN data listing (bukan form kosong).
    // Kalau klik "Ubah" malah membuka form tambah kosong / data belum ter-load, isi
    // perubahan jadi sia-sia & submit gagal. Beri tunggu untuk data async sebelum cek.
    await this.page.waitForTimeout(1500);
    const judulAwal = await this.inputJudul.inputValue().catch(() => '');
    const deskAwal = await this.inputDeskripsi.inputValue().catch(() => '');
    const hargaAwal = await this.inputHargaJual.inputValue().catch(() => '');
    const url = this.page.url();
    expect(
      judulAwal.trim().length,
      `Form edit terbuka tapi KOSONG (data listing tidak termuat). ` +
        `url=${url} | judul="${judulAwal}" desk(len)=${deskAwal.length} harga="${hargaAwal}"`
    ).toBeGreaterThan(0);

    await this.terapkanPerubahan(perubahan);

    if (testInfo) {
      const shot = await this.page.screenshot({ fullPage: true });
      await testInfo.attach('Form Edit Terisi', { body: shot, contentType: 'image/png' });
    }

    await this.submitListing();
  }

  // BATAL edit: buka form edit → ubah deskripsi (TANPA submit) → tinggalkan form (navigasi
  // ke daftar) → discard perubahan lewat dialog "Form belum disimpan". Dipakai untuk
  // membuktikan perubahan yang tidak disimpan TIDAK persist. AMAN di prod (tak mem-persist).
  async batalEdit(judul: string, deskripsiBuangan: string, testInfo?: TestInfo) {
    await this.bukaFormEditListing(judul, testInfo);
    await this.page.waitForTimeout(1500);

    // Pastikan form termuat (bukan kosong) sebelum mengetik.
    const judulAwal = await this.inputJudul.inputValue().catch(() => '');
    expect(
      judulAwal.trim().length,
      'Form edit (batal) terbuka tapi KOSONG — data listing tidak termuat.'
    ).toBeGreaterThan(0);

    await this.isiJikaAda(this.inputDeskripsi, deskripsiBuangan);

    if (testInfo) {
      const shot = await this.page.screenshot({ fullPage: true });
      await testInfo.attach('Form Edit Diubah (belum disimpan)', {
        body: shot,
        contentType: 'image/png',
      });
    }

    // Tinggalkan form tanpa submit. bukaDaftarListing menavigasi via menu Listing dan
    // menangani dialog "Form belum disimpan" (klik "Lanjut" = buang perubahan & keluar).
    await this.bukaDaftarListing();
  }

  // Ganti Arah Hadap ke nilai yang BERBEDA dari nilai saat ini (agar benar-benar menguji
  // perubahan, bukan no-op) lalu submit. Mengembalikan nilai baru yang dipilih supaya
  // pemanggil bisa memverifikasinya via verifikasiPerubahanTersimpan.
  async editArahHadapBerbeda(judul: string, testInfo?: TestInfo): Promise<string> {
    await this.bukaFormEditListing(judul, testInfo);
    await this.page.waitForTimeout(1500);

    const sekarang = (await this.bacaArahHadap()).toLowerCase();
    // Toggle deterministik antara Utara/Selatan.
    const target = sekarang.includes('utara') ? 'Selatan' : 'Utara';

    // Combobox sudah terisi → getter dropdownArahHadap (hasText "Pilih arah") tak match.
    // Buka via comboArahHadapTerisi lalu pilih opsi target.
    const combo = this.comboArahHadapTerisi;
    expect(await combo.count(), 'Combobox Arah Hadap tidak ditemukan di form edit').toBeGreaterThan(0);
    for (let attempt = 0; attempt < 2; attempt++) {
      await combo.click();
      try {
        await this.pilihOpsi(target, true);
        break;
      } catch (e) {
        if (attempt === 1) throw e;
        await this.page.waitForTimeout(1000);
      }
    }

    if (testInfo) {
      const shot = await this.page.screenshot({ fullPage: true });
      await testInfo.attach('Arah Hadap Diubah', { body: shot, contentType: 'image/png' });
    }

    await this.submitListing();
    return target;
  }

  // Buka kembali form edit listing `judulCari` lalu verifikasi bahwa nilai field
  // mencerminkan `perubahan` yang baru disimpan (bukti perubahan benar-benar persist
  // di backend, bukan sekadar toast sukses). Aman untuk subset field yang diberikan.
  async verifikasiPerubahanTersimpan(
    judulCari: string,
    perubahan: Partial<ListingData>,
    testInfo?: TestInfo
  ) {
    await this.bukaFormEditListing(judulCari, testInfo);

    // Form edit SPA memuat field secara async — tunggu field inti (judul/deskripsi)
    // benar-benar ter-render sebelum assert nilai, agar tidak "element(s) not found"
    // saat data belum hidrasi (flake reopen di mobile).
    await this.inputJudul
      .or(this.inputDeskripsi)
      .first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .catch(() => {});
    await this.page.waitForTimeout(1000);

    if (testInfo) {
      const shot = await this.page.screenshot({ fullPage: true });
      await testInfo.attach('Form Edit Dibuka Kembali (Verifikasi)', {
        body: shot,
        contentType: 'image/png',
      });
    }

    if (perubahan.judul) {
      await expect(
        this.inputJudul,
        'Judul tersimpan harus sama dengan perubahan'
      ).toHaveValue(perubahan.judul, { timeout: 10000 });
    }
    if (perubahan.deskripsi) {
      // Deskripsi = textarea; accessible-name "Deskripsi *" kadang tak ter-resolve saat
      // reopen di mobile → fallback ke name /deskripsi/i lalu <textarea>. Scroll + tunggu
      // visible dulu agar tidak "element(s) not found".
      const desk = this.inputDeskripsi
        .or(this.page.getByRole('textbox', { name: /deskripsi/i }))
        .or(this.page.locator('textarea'))
        .first();
      await desk.scrollIntoViewIfNeeded().catch(() => {});
      await desk.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      await expect(
        desk,
        'Deskripsi tersimpan harus sama dengan perubahan'
      ).toHaveValue(perubahan.deskripsi, { timeout: 10000 });
    }
    // Field bermask (harga) / numerik → bandingkan hanya digit agar tahan format ribuan.
    await this.verifikasiNilaiDigit(this.inputHargaJual, perubahan.hargaJual, 'Harga Jual');
    await this.verifikasiNilaiDigit(this.inputKomisi, perubahan.komisi, 'Komisi');
    await this.verifikasiNilaiDigit(this.inputLuasTanah, perubahan.luasTanah, 'Luas Tanah');
    await this.verifikasiNilaiDigit(this.inputLuasBangunan, perubahan.luasBangunan, 'Luas Bangunan');
    await this.verifikasiNilaiDigit(this.inputKamarTidur, perubahan.kamarTidur, 'Kamar Tidur');
    await this.verifikasiNilaiDigit(this.inputKamarMandi, perubahan.kamarMandi, 'Kamar Mandi');

    // Arah Hadap (dropdown) — bandingkan teks combobox (case-insensitive) bila diminta.
    if (perubahan.arahHadap) {
      const aktual = (await this.bacaArahHadap()).toLowerCase();
      expect(
        aktual,
        `Arah Hadap tersimpan ("${aktual}") harus = "${perubahan.arahHadap}"`
      ).toContain(perubahan.arahHadap.toLowerCase());
    }
  }

  // Verifikasi listing dengan `penanda` (mis. ID listing) MUNCUL di daftar berfilter
  // status `status` (default "Tayang"). Dipakai untuk memastikan listing hasil edit
  // langsung tampil di daftar tayang agen. Muat daftar bersih + SCROLL-SCAN (search di
  // mobile tak andal — lihat catatan bukaFormEditListing).
  async verifikasiListingDiStatus(penanda: string, status = 'Tayang', testInfo?: TestInfo) {
    await this.bukaDaftarListing();
    await this.pilihFilterStatus(status);
    await this.bersihkanCari(); // memicu render daftar di mobile (lihat bukaFormEditListing)
    await this.page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await this.page.waitForTimeout(700);

    // Kartu diidentifikasi via teks "ID: <id>" (unik & stabil).
    const kartu = this.page.getByText(`ID: ${penanda}`, { exact: false }).first();

    let muncul = false;
    for (let i = 0; i < 15; i++) {
      if (await kartu.isVisible({ timeout: 2000 }).catch(() => false)) {
        muncul = true;
        break;
      }
      const sebelum = await this.page.evaluate(() => window.scrollY).catch(() => 0);
      await this.page.mouse.wheel(0, 2200);
      await this.page.waitForTimeout(900);
      const sesudah = await this.page.evaluate(() => window.scrollY).catch(() => 0);
      if (sesudah === sebelum) break;
    }

    if (testInfo) {
      const shot = await this.page.screenshot({ fullPage: true });
      await testInfo.attach(`Daftar status ${status}`, { body: shot, contentType: 'image/png' });
    }

    expect(
      muncul,
      `Listing "${penanda}" harus langsung muncul di daftar status "${status}" setelah diedit`
    ).toBe(true);
  }

  // Bandingkan hanya digit dari nilai input vs target (tahan mask ribuan/koma).
  private async verifikasiNilaiDigit(locator: Locator, target?: string, label = 'Field') {
    if (!target) return;
    if ((await locator.count()) === 0 || !(await locator.first().isVisible().catch(() => false))) {
      return;
    }
    const aktual = (await locator.first().inputValue().catch(() => '')).replace(/\D/g, '');
    const harap = target.replace(/\D/g, '');
    expect(aktual, `${label} tersimpan ("${aktual}") harus mengandung digit "${harap}"`).toContain(
      harap
    );
  }

  // ─── Uji EDIT ISOLASI PER-FIELD (suite TC per field) ─────────────────────────
  // Field target = field data "aman" (tak mengubah struktur listing).

  // Key field teks/angka → getter textbox. Numerik dibandingkan by-digit.
  private static readonly PERFIELD_TEKS = ['deskripsi', 'alamat', 'blokNomor'];
  private static readonly PERFIELD_NUM = [
    'hargaJual', 'komisi', 'luasTanah', 'luasBangunan',
    'kamarTidur', 'kamarMandi', 'lebarProperti', 'panjangProperti',
  ];
  // Key dropdown → regex label (anchor ke teks label di form; toleran variasi kata).
  private static readonly PERFIELD_DROPDOWN: Record<string, RegExp> = {
    arahHadap: /arah hadap/i,
    dayaListrik: /daya listrik|tegangan/i,
    jenisAir: /jenis air|tipe air|sumber air/i,
    dokumenLegal: /dokumen legal/i,
  };

  // Deskripsi = <textarea>; accessible-name "Deskripsi *" kadang tak resolve saat reopen
  // di mobile → baca/tulis lewat locator robust (fallback name /deskripsi/i lalu <textarea>).
  private get inputDeskripsiRobust(): Locator {
    return this.inputDeskripsi
      .or(this.page.getByRole('textbox', { name: /deskripsi/i }))
      .or(this.page.locator('textarea'))
      .first();
  }

  private inputFieldByKey(key: string): Locator | null {
    switch (key) {
      case 'deskripsi': return this.inputDeskripsiRobust;
      case 'hargaJual': return this.inputHargaJual;
      case 'komisi': return this.inputKomisi;
      case 'luasTanah': return this.inputLuasTanah;
      case 'luasBangunan': return this.inputLuasBangunan;
      case 'kamarTidur': return this.inputKamarTidur;
      case 'kamarMandi': return this.inputKamarMandi;
      case 'lebarProperti': return this.inputLebarProperti;
      case 'panjangProperti': return this.inputPanjangProperti;
      case 'alamat': return this.inputAlamat;
      case 'blokNomor': return this.inputBlokNomor;
      default: return null;
    }
  }

  // Combobox sebuah field dropdown, di-anchor ke LABEL-nya (bukan nilai) agar andal
  // walau sudah terisi & tak salah-match combobox lain (mis. provinsi "Jawa Timur").
  // Kartu label+combobox dikelompokkan dalam div → ambil div innermost yang memuat
  // label DAN sebuah combobox.
  private comboByLabel(labelRe: RegExp): Locator {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByText(labelRe) })
      .filter({ has: this.page.getByRole('combobox') })
      .last()
      .getByRole('combobox')
      .first();
  }

  // Buka form edit + tunggu field inti siap (hindari baca sebelum hidrasi).
  private async bukaFormEditSiap(judul: string, testInfo?: TestInfo) {
    await this.bukaFormEditListing(judul, testInfo);
    await this.inputJudul
      .or(this.inputDeskripsi)
      .first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .catch(() => {});
    await this.page.waitForTimeout(1000);
  }

  // Baca nilai SEMUA field target (form HARUS sudah terbuka). Numerik → digit; teks →
  // trim; dropdown → teks display (lowercase). Dipakai snapshot baseline & verifikasi.
  private async bacaSemuaFieldEdit(): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const k of BuatListingPage.PERFIELD_TEKS) {
      const loc = this.inputFieldByKey(k)!.first();
      out[k] = ((await loc.inputValue().catch(() => '')) || '').trim();
    }
    for (const k of BuatListingPage.PERFIELD_NUM) {
      const loc = this.inputFieldByKey(k)!.first();
      out[k] = ((await loc.inputValue().catch(() => '')) || '').replace(/\D/g, '');
    }
    for (const [k, re] of Object.entries(BuatListingPage.PERFIELD_DROPDOWN)) {
      const combo = this.comboByLabel(re);
      out[k] = ((await combo.innerText().catch(() => '')) || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }
    return out;
  }

  // Buka form edit lalu snapshot semua field.
  async snapshotFieldEdit(judul: string, testInfo?: TestInfo): Promise<Record<string, string>> {
    await this.bukaFormEditSiap(judul, testInfo);
    return this.bacaSemuaFieldEdit();
  }

  // Edit SATU field lalu submit. Untuk teks/angka pakai `value`; untuk dropdown `value`
  // diabaikan → pilih opsi PERTAMA yang berbeda dari nilai kini. Return nilai yang diterapkan.
  async editFieldTunggal(
    judul: string,
    key: string,
    value: string | null,
    testInfo?: TestInfo
  ): Promise<string> {
    await this.bukaFormEditSiap(judul, testInfo);
    let applied = value ?? '';
    const input = this.inputFieldByKey(key);
    if (input) {
      const el = input.first();
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await el.click().catch(() => {});
      // ⚠️ fill() mengeset value tapi kadang TIDAK memicu change-tracking form (React
      // Hook Form) untuk textarea/controlled input → form tak "dirty" → submit tak
      // menyimpan perubahan (nilai lama tetap). Ketik per-karakter (pressSequentially)
      // agar event input asli terpicu & field ter-mark dirty.
      await el.fill('');
      await el.pressSequentially(value ?? '', { delay: 8 });
      await el.evaluate((n: HTMLElement) => n.blur()).catch(() => {});
      await this.page.waitForTimeout(300);
      // Konfirmasi nilai benar-benar masuk ke field sebelum submit (diagnostik gagal-fill).
      const now = ((await el.inputValue().catch(() => '')) || '');
      const cocok = BuatListingPage.PERFIELD_NUM.includes(key)
        ? now.replace(/\D/g, '').includes((value ?? '').replace(/\D/g, ''))
        : now.includes((value ?? '').slice(0, 24));
      if (!cocok) {
        // eslint-disable-next-line no-console
        console.error(`[perfield] WARN: fill "${key}" mungkin tak masuk. diminta="${value}" nilaiKini="${now}"`);
      }
      applied = value ?? '';
    } else if (BuatListingPage.PERFIELD_DROPDOWN[key]) {
      applied = await this.gantiDropdownKeOpsiLain(BuatListingPage.PERFIELD_DROPDOWN[key]);
    } else {
      throw new Error(`Field key tak dikenal untuk edit per-field: ${key}`);
    }
    if (testInfo) {
      const shot = await this.page.screenshot({ fullPage: true });
      await testInfo.attach(`Edit field "${key}" = "${applied}"`, {
        body: shot,
        contentType: 'image/png',
      });
    }
    await this.submitListing();
    return applied;
  }

  // Buka dropdown (anchor label) → pilih opsi PERTAMA yang teksnya beda dari nilai kini.
  // Label-agnostic terhadap daftar opsi (tak perlu tahu label pasti). Return teks terpilih.
  private async gantiDropdownKeOpsiLain(labelRe: RegExp): Promise<string> {
    const combo = this.comboByLabel(labelRe);
    await combo.scrollIntoViewIfNeeded().catch(() => {});
    const kini = ((await combo.innerText().catch(() => '')) || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    await combo.click();
    await this.page.waitForTimeout(900);
    const opsi = this.page.getByRole('option');
    const n = await opsi.count();
    let chosen = '';
    for (let i = 0; i < n; i++) {
      const t = ((await opsi.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      if (t && t.toLowerCase() !== kini && !/^pilih /i.test(t)) {
        await opsi.nth(i).click();
        chosen = t;
        break;
      }
    }
    await this.page.waitForTimeout(1000);
    if (!chosen) throw new Error(`Tak ada opsi berbeda untuk dropdown ${labelRe}`);
    return chosen;
  }
}
