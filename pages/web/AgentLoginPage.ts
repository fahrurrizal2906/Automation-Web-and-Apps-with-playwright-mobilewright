import { Page } from '@playwright/test';
import { BASE_URL, LABEL, LOGIN_MODE } from '../../config/env';

export class AgentLoginPage {
  constructor(private readonly page: Page) {}

  // Target & bentuk form login diambil dari config (env-driven).
  private readonly url = BASE_URL;
  /** true = form login berdiri sendiri di /agent/login; false = form di dalam modal. */
  private readonly formDiHalamanSendiri = LOGIN_MODE === 'page';

  private get menuProfilButton() {
    // Tombol ini pakai aria-label bukan text
    return this.page.locator(`button[aria-label="${LABEL.menuProfil}"]`);
  }

  private get tabAgen() {
    return this.page.getByRole('button', { name: LABEL.tabAgen });
  }

  private get usernameInput() {
    return this.page.getByRole('textbox', { name: 'Email/Username' });
  }

  private get passwordInput() {
    return this.page.getByRole('textbox', { name: 'Password' });
  }

  private get loginButton() {
    return this.page.getByRole('button', { name: 'Login' });
  }

  async goto() {
    if (this.formDiHalamanSendiri) {
      // Di dev/staging, langsung ke halaman /agent/login (modal Menu Profil tidak diandalkan)
      await this.page.goto(`${this.url}/agent/login`, { waitUntil: 'domcontentloaded' });
      await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      return;
    }
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForSelector(`button[aria-label="${LABEL.menuProfil}"]`, { timeout: 20000 });
  }

  async login(username: string, password: string) {
    if (this.formDiHalamanSendiri) {
      // Direct login di /agent/login (form sudah ditampilkan setelah goto())
      const userInput = this.page
        .locator(
          'input[name="username"], input[name="email"], input[type="email"], input[placeholder*="email" i], input[placeholder*="username" i]'
        )
        .first();
      await userInput.waitFor({ state: 'visible', timeout: 15000 });
      await userInput.fill(username);

      const passInput = this.page
        .locator('input[name="password"], input[type="password"]')
        .first();
      await passInput.fill(password);

      const submitBtn = this.page
        .locator('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")')
        .first();
      await submitBtn.click();

      await this.page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 30000 });
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(1500);
      return;
    }

    // Modal: buka form login via menu profil → tab agen.
    // Pakai openLoginForm() yang resilient (4x retry + reload) karena klik Menu Profil
    // kadang tidak konsisten memicu modal — terutama di viewport mobile (Pixel 5).
    // openLoginForm() menjamin usernameInput visible saat kembali.
    await this.openLoginForm();

    await this.usernameInput.click();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();

    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);
  }

  // ── Helpers untuk Negative Testing ──────────────────────────────────────────
  // NB: jangan pakai login() untuk negative cases — method tsb wait navigation
  // dan akan timeout kalau login gagal (URL tetap di /login).

  /**
   * Pastikan form login siap diisi. Di staging/dev form sudah visible setelah
   * goto(). Di produksi form berada di MODAL — perlu klik Menu Profil → tab
   * agen di dalam modal tersebut.
   *
   * Idempoten: aman dipanggil berulang.
   */
  async openLoginForm(): Promise<void> {
    if (this.formDiHalamanSendiri) {
      const userInput = this.page
        .locator('input[name="username"], input[name="email"], input[type="email"], input[placeholder*="email" i]')
        .first();
      await userInput.waitFor({ state: 'visible', timeout: 25000 });
      return;
    }

    // Modal: buka kalau belum terbuka. Retry karena klik menu profil tidak selalu
    // konsisten memicu modal (timing / state hydration).
    if (await this.usernameInput.isVisible().catch(() => false)) return;

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        // Pastikan tombol Menu Profil siap (Next.js hydration)
        await this.menuProfilButton.waitFor({ state: 'visible', timeout: 20000 });
        await this.menuProfilButton.click({ timeout: 10000 });
        await this.tabAgen.waitFor({ state: 'visible', timeout: 12000 });
        await this.tabAgen.click();
        await this.usernameInput.waitFor({ state: 'visible', timeout: 12000 });
        return; // success
      } catch (e) {
        lastErr = e;
        // Reset state — Escape close modal, lalu reload page kalau attempt >= 2
        await this.page.keyboard.press('Escape').catch(() => {});
        await this.page.waitForTimeout(2000);
        if (attempt >= 2) {
          await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          await this.page.waitForTimeout(1500);
        }
      }
    }
    throw lastErr;
  }

  /**
   * Cek apakah masih di "konteks login" — yaitu user belum berhasil login:
   *   - Staging/dev: URL contains /login (gagal nav)
   *   - Mode modal: form input masih visible (modal masih terbuka, atau URL belum berubah)
   */
  async isStillOnLoginContext(): Promise<boolean> {
    if (this.formDiHalamanSendiri) {
      return this.page.url().toLowerCase().includes('/login');
    }
    // Mode modal: kalau input masih visible → modal masih terbuka → login belum sukses
    const userInputStillVisible = await this.usernameInput.isVisible().catch(() => false);
    if (userInputStillVisible) return true;
    // Atau cek URL — kalau berhasil login, URL biasanya berubah ke /agent/* / dashboard
    const u = this.page.url();
    return !/\/(agent|dashboard|profile|home|account)/i.test(u);
  }

  /**
   * Fill form & click submit TANPA wait navigation. Pakai untuk negative case
   * di mana login expected gagal (URL tetap di /agent/login).
   *
   * @param skipFillUsername - skip fill username (untuk test empty username)
   * @param skipFillPassword - skip fill password (untuk test empty password)
   */
  async attemptLogin(
    username: string,
    password: string,
    opts: { skipFillUsername?: boolean; skipFillPassword?: boolean } = {},
  ): Promise<void> {
    // Pastikan form siap (idempoten — di prod buka modal kalau belum)
    await this.openLoginForm();

    if (!this.formDiHalamanSendiri) {
      // Mode modal: form di dalam modal
      if (!opts.skipFillUsername) await this.usernameInput.fill(username);
      if (!opts.skipFillPassword) await this.passwordInput.fill(password);
      await this.loginButton.click();
      return;
    }

    // Dev/staging: direct form
    const userInput = this.page
      .locator('input[name="username"], input[name="email"], input[type="email"], input[placeholder*="email" i], input[placeholder*="username" i]')
      .first();
    if (!opts.skipFillUsername) await userInput.fill(username);

    const passInput = this.page
      .locator('input[name="password"], input[type="password"]')
      .first();
    if (!opts.skipFillPassword) await passInput.fill(password);

    const submitBtn = this.page
      .locator('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")')
      .first();
    await submitBtn.click();
  }

  /**
   * Tunggu toast error muncul & return text-nya. Returns null kalau timeout.
   * Toast pakai lib sonner: <ol class="toaster group"> berisi <li>.
   *
   * Sonner kadang tampilkan "Loading..." dulu saat API in-flight, lalu di-replace
   * dengan toast hasil. Method ini tunggu sampai text BUKAN loading.
   */
  async waitForErrorToast(timeoutMs = 10000): Promise<string | null> {
    try {
      await this.page.waitForFunction(
        () => {
          const items = Array.from(document.querySelectorAll('ol.toaster li'));
          if (items.length === 0) return false;
          // Cari toast yang text-nya BUKAN sekedar "Loading..."
          return items.some((li) => {
            const t = (li as HTMLElement).innerText?.trim() ?? '';
            return t.length > 0 && !/^loading\.\.?\.?$/i.test(t);
          });
        },
        { timeout: timeoutMs },
      );
      // Ambil toast paling baru (last) yang non-loading
      const texts = await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('ol.toaster li'))
          .map((li) => (li as HTMLElement).innerText?.replace(/\s+/g, ' ').trim() ?? '')
          .filter((t) => t.length > 0 && !/^loading\.\.?\.?$/i.test(t));
      });
      return texts.length > 0 ? texts[texts.length - 1] : null;
    } catch {
      return null;
    }
  }

  /** Cek apakah masih di halaman login (URL contains /login). */
  isStillOnLoginPage(): boolean {
    return this.page.url().toLowerCase().includes('/login');
  }

  /** Baca attribute `type` field password saat ini ('password' = masked, 'text' = terlihat). */
  async getPasswordFieldType(): Promise<string | null> {
    return this.page
      .locator('input[name="password"], input[type="password"], input[type="text"][name*="pass" i]')
      .first()
      .getAttribute('type');
  }

  /**
   * Cari & tap tombol reveal password (ikon mata). Return false bila toggle
   * tidak ditemukan (untuk guard — tidak semua build punya toggle).
   */
  async togglePasswordReveal(): Promise<boolean> {
    const toggle = this.page
      .locator(
        'button[aria-label*="password" i], button[aria-label*="sandi" i], ' +
          'button[aria-label*="show" i], button[aria-label*="lihat" i], ' +
          '[data-testid*="password-toggle" i], input[type="checkbox"][name*="show" i]',
      )
      .first();
    if (!(await toggle.isVisible().catch(() => false))) return false;
    await toggle.tap({ timeout: 5000 }).catch(async () => {
      await toggle.click({ timeout: 5000 }).catch(() => {});
    });
    return true;
  }

  /**
   * Varian attemptLogin yang memakai .tap() (jalur touch) untuk fokus field &
   * submit. Untuk negative case di mobile — TIDAK wait navigation.
   */
  async tapAttemptLogin(
    username: string,
    password: string,
    opts: { skipFillUsername?: boolean; skipFillPassword?: boolean } = {},
  ): Promise<void> {
    await this.openLoginForm();

    const userInput = this.page
      .locator(
        'input[name="username"], input[name="email"], input[type="email"], input[placeholder*="email" i], input[placeholder*="username" i]',
      )
      .first();
    const passInput = this.page
      .locator('input[name="password"], input[type="password"]')
      .first();
    const submitBtn = this.page
      .locator('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")')
      .first();

    if (!opts.skipFillUsername) {
      await userInput.tap();
      await userInput.fill(username);
    }
    if (!opts.skipFillPassword) {
      await passInput.tap();
      await passInput.fill(password);
    }
    await submitBtn.tap();
  }

  /** Tap tombol Login 2x cepat (uji double-submit di touch). */
  async doubleTapLogin(): Promise<void> {
    const submitBtn = this.page
      .locator('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")')
      .first();
    await submitBtn.tap();
    await submitBtn.tap();
  }

  /**
   * Ambil HTML5 validation message dari input yang invalid (pakai required/pattern/type).
   * Returns array kosong kalau semua valid (atau form sudah ter-submit).
   */
  async getHtml5ValidationErrors(): Promise<Array<{ name: string; message: string }>> {
    return this.page.evaluate(() => {
      return Array.from(document.querySelectorAll<HTMLInputElement>('input:invalid')).map((i) => ({
        name: i.name || i.type || 'unknown',
        message: i.validationMessage,
      }));
    });
  }

  /**
   * Cek apakah field input punya `required` attribute (HTML5 native validation).
   */
  async getFieldRequiredAttrs(): Promise<{ username: boolean; password: boolean }> {
    return this.page.evaluate(() => {
      const u = document.querySelector<HTMLInputElement>(
        'input[name="username"], input[name="email"], input[type="email"], input[placeholder*="email" i]',
      );
      const p = document.querySelector<HTMLInputElement>('input[name="password"], input[type="password"]');
      return {
        username: u?.required ?? false,
        password: p?.required ?? false,
      };
    });
  }
}
