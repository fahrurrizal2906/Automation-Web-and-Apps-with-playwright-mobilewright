import { Page } from '@playwright/test';
import { REGISTRASI_URL } from '../../config/env';

export class RegistrasiPage {
  private readonly url: string;

  constructor(
    private readonly page: Page,
    urlOverride?: string,
  ) {
    this.url = urlOverride ?? REGISTRASI_URL;
  }

  // --- Locators Step 1: Data Pribadi ---
  private get namaLengkap() {
    return this.page.getByRole('textbox', { name: 'Nama Lengkap *' });
  }
  private get nomorWhatsApp() {
    return this.page.getByRole('textbox', { name: 'Nomor WhatsApp *' });
  }
  private get email() {
    return this.page.getByRole('textbox', { name: 'Email *' });
  }
  private get alamatDomisili() {
    return this.page.getByRole('textbox', { name: 'Alamat Domisili *' });
  }
  private get keterangan() {
    // Field opsional "Keterangan" (REQ-9089/9093): <input id="keterangan" placeholder="Masukkan keterangan">
    return this.page.locator('#keterangan');
  }
  private get uploadKTPButton() {
    return this.page.getByRole('button', { name: 'Upload Foto KTP' });
  }
  private get dropdownKendaraan() {
    return this.page.getByRole('combobox', { name: 'trigger' }).first();
  }
  private get dropdownSIM() {
    return this.page.getByRole('combobox', { name: 'trigger' }).nth(1);
  }
  private get dropdownSumber() {
    return this.page.getByRole('combobox', { name: 'trigger' }).nth(2);
  }
  private get tombolLanjutkan() {
    return this.page.getByRole('button', { name: 'Lanjutkan' });
  }

  // --- Locators Step 2: Pendidikan & Tanda Tangan ---
  private get dropdownPendidikan() {
    return this.page.getByRole('combobox', { name: 'trigger' }).first();
  }
  private get canvas() {
    return this.page.locator('canvas');
  }
  private get tombolBuatTandaTangan() {
    return this.page.getByRole('button', { name: 'Buat Tanda Tangan' });
  }
  private get tombolSimpan() {
    return this.page.getByRole('button', { name: 'Simpan' });
  }
  private get tombolSubmit() {
    return this.page.getByRole('button', { name: 'Submit Data' });
  }
  private get tombolSetuju() {
    return this.page.getByRole('button', { name: 'Setuju' });
  }

  // --- Actions ---

  async goto() {
    await this.page.goto(this.url);
  }

  async isiDataPribadi(nama: string, wa: string, email: string, alamat: string) {
    await this.namaLengkap.fill(nama);
    await this.nomorWhatsApp.fill(wa);
    await this.email.fill(email);
    await this.alamatDomisili.fill(alamat);
  }

  /** Isi field opsional "Keterangan" (REQ-9089/9093). No-op bila field tidak ada. */
  async isiKeterangan(keterangan: string) {
    await this.keterangan.waitFor({ state: 'visible', timeout: 10000 });
    await this.keterangan.fill(keterangan);
  }

  /** Ambil nilai field Keterangan saat ini (verifikasi terisi). */
  async getKeterangan(): Promise<string> {
    return this.keterangan.inputValue();
  }

  async uploadFotoKTP(filePath: string) {
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.uploadKTPButton.click(),
    ]);
    await fileChooser.setFiles(filePath);
  }

  // --- REQ-8855: observasi state upload Foto KTP di bawah jaringan lambat/offline ---

  /**
   * Toast loading upload — state "sedang meng-upload".
   * Staging memakai "Memproses gambar... (Ns)" lalu "Mengunggah foto KTP... (Ns)";
   * prod lama memakai "Meng-upload gambar...". Cakup keduanya.
   */
  private get toastMengupload() {
    return this.page.getByText(
      /meng-?upload gambar|mengunggah foto|mengunggah gambar|memproses gambar|sedang meng-?upload|jangan tutup halaman/i,
    );
  }
  /** Toast/teks sukses upload. */
  private get toastUploadBerhasil() {
    return this.page.getByText(/gambar berhasil di-?upload|berhasil di-?unggah|upload berhasil/i);
  }
  /** Teks error upload (AC-1): pesan gagal/timeout yang ramah. */
  private get toastUploadGagal() {
    return this.page.getByText(
      /gambar gagal di-?upload|(upload|unggah|gambar)\s*(gagal|error|timeout)|(gagal|error)\s*(meng-?upload|meng-?unggah|memuat gambar)|tidak dapat terhubung ke server|coba lagi (nanti|beberapa saat)|waktu habis|request timeout/i,
    );
  }
  /** Tombol retry (AC-2). */
  private get tombolCobaLagi() {
    return this.page.getByRole('button', { name: /coba lagi|ulangi|retry|unggah ulang|upload ulang/i });
  }
  /**
   * Indikator progres upload informatif (AC-3): progress bar / spinner / persentase,
   * ATAU penghitung waktu berjalan "(Ns)" + teks "mohon tunggu, jangan tutup halaman"
   * (yang dipakai staging sebagai indikator non-statis).
   */
  private get indikatorProgress() {
    return this.page
      .locator('[role="progressbar"], progress, [class*="progress" i], [class*="spinner" i], [aria-busy="true"]')
      .or(this.page.getByText(/\(\s*\d+\s*s\s*\)|mohon tunggu, jangan tutup|\d+\s*%/i));
  }

  /** Trigger upload Foto KTP TANPA menunggu sukses (untuk skenario negatif). */
  async mulaiUploadFotoKTP(filePath: string) {
    // Pastikan tombol siap (mobile: kadang perlu scroll) sebelum memicu filechooser,
    // agar klik tidak menggantung menunggu tombol actionable di jaringan buruk.
    await this.uploadKTPButton.waitFor({ state: 'visible', timeout: 15000 });
    await this.uploadKTPButton.scrollIntoViewIfNeeded().catch(() => {});
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser', { timeout: 20000 }),
      this.uploadKTPButton.click(),
    ]);
    await fileChooser.setFiles(filePath);
  }

  /** Ambil baris teks feedback upload yang tampil (toast/notifikasi) — untuk laporan akurat. */
  private async snapshotFeedbackUpload(): Promise<string> {
    const teks = await this.page
      .evaluate(() => (document.body?.innerText ?? ''))
      .catch(() => '');
    const baris = teks
      .split('\n')
      .map((l) => l.trim())
      .filter((l) =>
        /meng-?upload|meng-?unggah|gambar|foto ktp|gagal|coba lagi|berhasil|timeout|%|memuat|proses/i.test(l),
      );
    return [...new Set(baris)].slice(0, 6).join(' | ');
  }

  /**
   * Amati state upload Foto KTP selama `durasiMs`. Poll UI tiap ~1,5s dan rekam
   * timeline serta flag pemenuhan AC REQ-8855. Berhenti lebih awal bila upload
   * sudah tuntas (berhasil, atau error tanpa toast loading yang masih tampil).
   */
  async amatiStateUpload(
    durasiMs: number,
    opts: { berhentiSaatError?: boolean } = {},
  ): Promise<{
    timeline: { t: number; state: string; teks: string }[];
    munculToastUpload: boolean;
    munculProgress: boolean;
    munculError: boolean;
    munculRetry: boolean;
    munculBerhasil: boolean;
    masihMenggantung: boolean;
    detikTerakhir: number;
    progresDinamis: boolean;
  }> {
    const berhentiSaatError = opts.berhentiSaatError ?? true;
    const timeline: { t: number; state: string; teks: string }[] = [];
    let munculToastUpload = false;
    let munculProgress = false;
    let munculError = false;
    let munculRetry = false;
    let munculBerhasil = false;
    let detikTerakhir = 0;
    // Lacak apakah indikator progres BERGERAK (counter "(Ns)" bertambah / % berubah) → non-statis.
    let counterMin = -1;
    let counterMax = -1;
    let persenTerlihat = false;

    const t0 = Date.now();
    while (Date.now() - t0 < durasiMs) {
      const t = Math.round((Date.now() - t0) / 1000);
      detikTerakhir = t;

      const [up, prog, err, retry, ok, teks] = await Promise.all([
        this.toastMengupload.first().isVisible().catch(() => false),
        this.indikatorProgress.first().isVisible().catch(() => false),
        this.toastUploadGagal.first().isVisible().catch(() => false),
        this.tombolCobaLagi.first().isVisible().catch(() => false),
        this.toastUploadBerhasil.first().isVisible().catch(() => false),
        this.snapshotFeedbackUpload(),
      ]);

      if (up) munculToastUpload = true;
      if (prog) munculProgress = true;
      if (err) munculError = true;
      if (retry) munculRetry = true;
      if (ok) munculBerhasil = true;

      // Deteksi progres non-statis: counter detik "(Ns)" yang bertambah, atau persentase.
      const mCounter = teks.match(/\(\s*(\d+)\s*s\s*\)/);
      if (mCounter) {
        const n = Number(mCounter[1]);
        if (counterMin < 0) counterMin = n;
        counterMax = Math.max(counterMax, n);
      }
      if (/\d+\s*%/.test(teks)) persenTerlihat = true;

      const states: string[] = [];
      if (up) states.push('loading("Meng-upload gambar...")');
      if (prog) states.push('progress-indikator');
      if (err) states.push('ERROR');
      if (retry) states.push('tombol-CobaLagi');
      if (ok) states.push('BERHASIL');
      timeline.push({ t, state: states.length ? states.join(' + ') : 'idle/tidak ada feedback', teks });

      // Upload sudah tuntas → berhenti (state deterministik tercapai)
      if (ok) break;
      if (berhentiSaatError && err && !up) break;

      await this.page.waitForTimeout(1500);
    }

    // Menggantung: toast loading pernah muncul, tapi tidak pernah berujung sukses/gagal
    const masihMenggantung = munculToastUpload && !munculBerhasil && !munculError;
    // Progres dinamis: counter detik bertambah, atau persentase pernah terlihat.
    const progresDinamis = persenTerlihat || counterMax > counterMin;

    return {
      timeline,
      munculToastUpload,
      munculProgress,
      munculError,
      munculRetry,
      munculBerhasil,
      masihMenggantung,
      detikTerakhir,
      progresDinamis,
    };
  }

  /** Apakah tombol "Coba Lagi" (retry, AC-2) tampil? */
  async adaTombolCobaLagi(): Promise<boolean> {
    return this.tombolCobaLagi.first().isVisible().catch(() => false);
  }

  /** Klik tombol "Coba Lagi" (retry, AC-2) bila ada. */
  async klikCobaLagi() {
    await this.tombolCobaLagi.first().click();
  }

  /**
   * Pesan validasi tipe file client-side (A1/A2).
   * Prod: "Tipe file tidak valid. Hanya JPEG, JPG, dan PNG yang diizinkan."
   */
  private get pesanTipeFileTidakValid() {
    return this.page.getByText(
      /tipe file tidak valid|hanya .*(jpe?g|jpg|png).*diizinkan|format .*(tidak valid|tidak didukung)/i,
    );
  }

  /** Apakah pesan validasi tipe file tampil? */
  async adaPesanTipeFileTidakValid(): Promise<boolean> {
    return this.pesanTipeFileTidakValid.first().isVisible().catch(() => false);
  }

  async pilihKendaraan(jenis: string) {
    await this.dropdownKendaraan.click();
    await this.page.getByRole('option', { name: jenis }).click();
  }

  async pilihMemilikiSIM(pilihan: string) {
    await this.dropdownSIM.click();
    await this.page.getByRole('option', { name: pilihan }).click();
  }

  async pilihSumberInformasi(sumber: string) {
    await this.dropdownSumber.click();
    await this.page.getByLabel(sumber).getByText(sumber).click();
    // Beberapa opsi (mis. "Event") memunculkan dropdown kondisional WAJIB di bawah Sumber.
    // Isi setiap dropdown kondisional dengan opsi pertama, sisakan 1 dropdown (Pernah Bergabung) untuk diisi terpisah.
    await this.isiDropdownKondisionalSumber();
  }

  /**
   * Isi dropdown kondisional yang muncul setelah memilih Sumber Informasi tertentu.
   * Menyisakan tepat 1 dropdown kosong (Pernah Bergabung) di akhir.
   */
  private async isiDropdownKondisionalSumber() {
    await this.page.waitForTimeout(400);
    for (let guard = 0; guard < 3; guard++) {
      const kosong = this.page
        .getByRole('combobox', { name: 'trigger' })
        .filter({ hasText: 'Pilih salah satu' });
      const n = await kosong.count();
      // Sisakan 1 (Pernah Bergabung). Jika hanya 1 yang kosong, tidak ada field kondisional.
      if (n <= 1) break;
      await kosong.first().click();
      await this.page.getByRole('option').first().waitFor({ state: 'visible', timeout: 5000 });
      await this.page.getByRole('option').first().click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Buka dropdown "Sumber Informasi" (mis. "Mengetahui kami dari"), kumpulkan
   * semua label opsi yang tersedia, lalu tutup dropdown lagi.
   * Dipakai untuk looping sebanyak data opsi yang dimiliki.
   */
  async ambilSemuaSumberInformasi(): Promise<string[]> {
    await this.dropdownSumber.click();
    // Tunggu opsi pertama muncul sebelum membaca seluruh daftar
    await this.page.getByRole('option').first().waitFor({ state: 'visible', timeout: 10000 });
    const opsi = (await this.page.getByRole('option').allInnerTexts())
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    // Tutup dropdown agar tidak mengganggu interaksi berikutnya
    await this.page.keyboard.press('Escape');
    // Buang duplikat sambil menjaga urutan
    return [...new Set(opsi)];
  }

  async pilihPernahBergabung(pilihan: string) {
    // Pernah Bergabung selalu dropdown terakhir di step 1 (setelah Sumber + field kondisional opsional)
    await this.page
      .getByRole('combobox', { name: 'trigger' })
      .filter({ hasText: 'Pilih salah satu' })
      .last()
      .click();
    await this.page.getByLabel(pilihan).getByText(pilihan, { exact: true }).click();
  }

  async klikLanjutkan() {
    await this.tombolLanjutkan.click();
  }

  async pilihPendidikan(pendidikan: string) {
    await this.dropdownPendidikan.click();
    // Tunggu dropdown animation selesai sebelum cari option
    await this.page.waitForTimeout(500);
    // Pakai exact: false + fallback regex agar label "D3" tetap match
    // walau di server berubah jadi "D3 - Diploma 3" atau "D3 (Diploma)"
    const option = this.page.getByRole('option', { name: new RegExp(`^${pendidikan}\\b`, 'i') }).first();
    try {
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
    } catch {
      // Fallback exact match (untuk handle case label exact)
      await this.page.getByRole('option', { name: pendidikan, exact: true }).first().click({ timeout: 10000 });
    }
  }

  async pilihPengalaman(pengalaman: string) {
    await this.page.locator('button').filter({ hasText: 'Pilih salah satu' }).first().click();
    await this.page.getByLabel(pengalaman).getByText(pengalaman).click();
  }

  async buatTandaTangan() {
    await this.tombolBuatTandaTangan.click();
    await this.canvas.waitFor({ state: 'visible' });

    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas tanda tangan tidak ditemukan');

    // Simulasi menggambar tanda tangan dengan mouse drag
    await this.page.mouse.move(box.x + 50, box.y + 60);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 100, box.y + 40);
    await this.page.mouse.move(box.x + 150, box.y + 60);
    await this.page.mouse.move(box.x + 200, box.y + 45);
    await this.page.mouse.move(box.x + 250, box.y + 60);
    await this.page.mouse.up();

    await this.tombolSimpan.click();
  }

  async klikSubmitData() {
    await this.tombolSubmit.click();
  }

  async submitDanSetuju() {
    await this.tombolSubmit.click();
    await this.tombolSetuju.waitFor({ state: 'visible', timeout: 10000 });
    await this.tombolSetuju.click();
  }

  /** Klik tombol Setuju di dialog konfirmasi (setelah Submit Data) */
  async klikSetuju() {
    await this.tombolSetuju.waitFor({ state: 'visible', timeout: 10000 });
    await this.tombolSetuju.click();
  }

  /**
   * Tunggu halaman "berhasil mendaftar" muncul setelah klik Setuju.
   * Mendeteksi kombinasi: URL berubah ke halaman sukses ATAU muncul teks
   * "Pendaftaran Berhasil" / "Terima Kasih" / "Selamat Bergabung" yang
   * spesifik untuk halaman registrasi sukses (bukan toast upload foto).
   */
  async tungguHalamanBerhasil(timeout = 45000): Promise<{ url: string; teksSukses: string }> {
    const startUrl = this.page.url();
    const successPattern =
      /Pendaftaran Berhasil|Terima Kasih|Selamat Bergabung|Berhasil Mendaftar|Pendaftaran Anda Telah Diterima|Registrasi Berhasil|Pendaftaran Sukses/i;

    const successText = this.page.getByText(successPattern).first();
    const urlChanged = this.page.waitForURL(
      (u) => u.toString() !== startUrl && !u.toString().includes('agentregistration'),
      { timeout }
    );

    await Promise.race([
      successText.waitFor({ state: 'visible', timeout }),
      urlChanged,
    ]);

    // Setelah salah satu indikator terdeteksi, coba ambil teks
    await this.page.waitForTimeout(1000);
    const teks = await successText.innerText().catch(() => '');
    return { url: this.page.url(), teksSukses: teks.trim() };
  }
}
