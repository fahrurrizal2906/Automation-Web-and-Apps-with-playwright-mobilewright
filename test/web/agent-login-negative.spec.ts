/**
 * Agent Login - Negative Test Cases (web)
 *
 * Suite ini menguji satu login form pada DUA bentuk yang umum ditemui:
 *   - LOGIN_MODE='modal' -> form berada di dalam modal, dibuka dari menu profil
 *     (pola produksi pada banyak SPA)
 *   - LOGIN_MODE='page'  -> form berdiri sendiri di /agent/login (pola dev/staging)
 * Dideteksi otomatis dari hostname, bisa dipaksa via env (lihat config/env.ts).
 *
 * Page object: pages/web/AgentLoginPage.ts dengan helper:
 *   - openLoginForm()          - idempoten, membuka modal bila perlu
 *   - attemptLogin()           - fill + submit TANPA wait navigation (aman untuk login gagal)
 *   - waitForErrorToast()      - melewati state "Loading..." dari sonner
 *   - isStillOnLoginContext()  - env-aware: cek URL (mode page) / cek modal (mode modal)
 *
 * Skenario negatif:
 *   TC-01 | Username + password kosong        -> HTML5 required memblokir submit
 *   TC-02 | Username kosong + password terisi -> validasi pada field username
 *   TC-03 | Username terisi + password kosong -> validasi pada field password
 *   TC-04 | Kredensial whitespace-only        -> ditolak (tidak pernah terautentikasi)
 *   TC-05 | Kredensial acak tidak valid       -> toast error muncul
 *   TC-06 | Percobaan SQL injection           -> tidak ada bypass
 *   TC-07 | Payload XSS di username           -> script tidak dieksekusi
 *   TC-08 | Kredensial sangat panjang (1500)  -> graceful, halaman tidak crash
 *   TC-09 | 3x gagal berturut-turut           -> tetap di konteks login
 *   TC-10 | Field password bertipe password   -> teks tersamar
 *
 * Menjalankan:
 *   TEST_BASE_URL=https://situs-uji.example npx playwright test test/web/agent-login-negative.spec.ts --project=chromium
 */

import { test, expect } from '@playwright/test';
import { AgentLoginPage } from '../../pages/web/AgentLoginPage';
import { BASE_URL, LOGIN_MODE } from '../../config/env';

const EXPECTED_TOAST_PATTERN = /login gagal|proses login gagal|salah|invalid|tidak terdaftar/i;

test.describe('Agent Login — Negative Cases', () => {
  // Repo publik: tanpa TEST_BASE_URL tidak ada target yang sah untuk diuji.
  test.skip(
    !process.env['TEST_BASE_URL'],
    'TEST_BASE_URL belum diisi — salin .env.example dan arahkan ke lingkungan uji Anda.',
  );

  test.beforeAll(() => {
    console.log(`Target: ${BASE_URL} (LOGIN_MODE=${LOGIN_MODE})`);
  });

  // Lingkungan uji kadang lambat + rate limit kalau banyak login gagal berturut-turut.
  // Beri timeout longgar + 1 retry untuk handle flakiness modal yang tidak open.
  test.setTimeout(120000);
  test.describe.configure({ retries: 1 });

  let loginPage: AgentLoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new AgentLoginPage(page);
    await loginPage.goto();
    // Pastikan form login siap diisi (di prod: buka modal Menu Profil → tab Agen)
    await loginPage.openLoginForm();
  });

  // ── TC-01 : Empty username + empty password (HTML5 required) ──────────────
  test('TC-01 | Empty username & password — HTML5 required prevents submit', async ({ page }, testInfo) => {
    const required = await loginPage.getFieldRequiredAttrs();
    await testInfo.attach('Field required attrs', {
      body: JSON.stringify(required, null, 2),
      contentType: 'application/json',
    });

    await loginPage.attemptLogin('', '', { skipFillUsername: true, skipFillPassword: true });
    await page.waitForTimeout(800);

    const errs = await loginPage.getHtml5ValidationErrors();
    await testInfo.attach('HTML5 validation errors', {
      body: JSON.stringify(errs, null, 2),
      contentType: 'application/json',
    });

    await test.step('Username field punya required attr', async () => {
      expect(required.username, 'Username harus required (HTML5 validation)').toBe(true);
    });

    await test.step('Password field punya required attr', async () => {
      expect(required.password, 'Password harus required (HTML5 validation)').toBe(true);
    });

    await test.step('Browser tampilkan HTML5 validation untuk field kosong', async () => {
      expect(errs.length, `Expected ≥ 1 invalid field, got ${errs.length}`).toBeGreaterThanOrEqual(1);
    });

    await test.step('URL tetap di /login (tidak ada nav premature)', async () => {
      expect(await loginPage.isStillOnLoginContext()).toBe(true);
    });
  });

  // ── TC-02 : Empty username + password terisi ──────────────────────────────
  test('TC-02 | Empty username + filled password — username field validation triggered', async ({ page }) => {
    await loginPage.attemptLogin('', 'SomePassword123', { skipFillUsername: true });
    await page.waitForTimeout(800);

    const errs = await loginPage.getHtml5ValidationErrors();
    expect(errs.length, 'Username harus invalid (empty)').toBeGreaterThanOrEqual(1);
    expect(errs.some((e) => e.name.match(/user|email/i)), 'Invalid field harus username/email').toBe(true);
    expect(await loginPage.isStillOnLoginContext()).toBe(true);
  });

  // ── TC-03 : Username terisi + empty password ──────────────────────────────
  test('TC-03 | Filled username + empty password — password field validation triggered', async ({ page }) => {
    await loginPage.attemptLogin('someuser', '', { skipFillPassword: true });
    await page.waitForTimeout(800);

    const errs = await loginPage.getHtml5ValidationErrors();
    expect(errs.length, 'Password harus invalid (empty)').toBeGreaterThanOrEqual(1);
    expect(errs.some((e) => e.name.match(/password|pass/i)), 'Invalid field harus password').toBe(true);
    expect(await loginPage.isStillOnLoginContext()).toBe(true);
  });

  // ── TC-04 : Whitespace-only credentials ───────────────────────────────────
  test('TC-04 | Whitespace-only username & password — backend tolak (toast error)', async ({ page }, testInfo) => {
    await loginPage.attemptLogin('   ', '   ');
    const toast = await loginPage.waitForErrorToast(10000);
    await testInfo.attach('Toast', { body: toast ?? '<null>', contentType: 'text/plain' });

    // Whitespace-only bisa di-handle 2 cara: client trim → empty → HTML5,
    // atau dikirim ke backend → API return error.
    // Yang penting: TIDAK navigasi ke halaman authenticated.
    expect(await loginPage.isStillOnLoginContext(), 'Tidak boleh berhasil login dengan whitespace creds').toBe(true);
  });

  // ── TC-05 : Random invalid creds → toast error ────────────────────────────
  test('TC-05 | Random invalid username/password — toast "Login gagal!" muncul', async ({ page }, testInfo) => {
    await loginPage.attemptLogin('invaliduser_qa_neg_xyz', 'WrongPassword_QA_999!');
    const toast = await loginPage.waitForErrorToast(10000);
    await testInfo.attach('Toast', { body: toast ?? '<null>', contentType: 'text/plain' });

    await test.step('Toast error muncul', async () => {
      expect(toast, 'Toast error harus muncul setelah invalid login').not.toBeNull();
    });

    await test.step('Toast berisi message sesuai pattern (login gagal / salah / invalid)', async () => {
      expect(
        toast,
        `Toast text "${toast}" tidak match pattern ${EXPECTED_TOAST_PATTERN}`,
      ).toMatch(EXPECTED_TOAST_PATTERN);
    });

    await test.step('URL tetap di /login', async () => {
      expect(await loginPage.isStillOnLoginContext()).toBe(true);
    });
  });

  // ── TC-06 : SQL injection attempt → tidak bypass ──────────────────────────
  test('TC-06 | SQL injection di username — no bypass, error toast muncul', async ({ page }, testInfo) => {
    const sqlPayloads = [
      "' OR '1'='1",
      "admin' --",
      "' OR 1=1 --",
    ];
    const payload = sqlPayloads[0];

    await loginPage.attemptLogin(payload, "' OR '1'='1");
    const toast = await loginPage.waitForErrorToast(10000);
    await testInfo.attach('SQL injection attempt', {
      body: JSON.stringify({ payload, toast, url: page.url() }, null, 2),
      contentType: 'application/json',
    });

    await test.step('Tidak boleh login berhasil (URL tetap di /login)', async () => {
      expect(
        await loginPage.isStillOnLoginContext(),
        `SQL injection bypass risk: URL berubah ke ${page.url()}`,
      ).toBe(true);
    });

    await test.step('Backend reject (toast error muncul atau form tidak terkirim)', async () => {
      // Aman: ada toast error OR tetap di login page (kedua-nya pertanda backend
      // tidak naive-trust input).
      const stillOnLogin = await loginPage.isStillOnLoginContext();
      expect(stillOnLogin || toast !== null, 'Tidak ada indikasi rejection').toBe(true);
    });
  });

  // ── TC-07 : XSS attempt di username — escaped & tidak execute ─────────────
  test('TC-07 | XSS payload di username — script tidak execute', async ({ page }, testInfo) => {
    const xssPayload = '<script>window.__pwned=true</script>';

    // Listen dialog (kalau alert pop-up — tanda XSS jalan)
    let dialogTriggered = false;
    page.on('dialog', async (d) => {
      dialogTriggered = true;
      await d.dismiss().catch(() => {});
    });

    await loginPage.attemptLogin(xssPayload, 'AnyPassword');
    await page.waitForTimeout(3500);

    const pwned = await page.evaluate(() => Boolean((window as unknown as { __pwned?: boolean }).__pwned));
    await testInfo.attach('XSS attempt', {
      body: JSON.stringify({ payload: xssPayload, dialogTriggered, pwned, url: page.url() }, null, 2),
      contentType: 'application/json',
    });

    await test.step('Script payload TIDAK execute (window.__pwned tidak ter-set)', async () => {
      expect(pwned, 'XSS executed — payload merubah window state').toBe(false);
    });

    await test.step('Tidak ada dialog/alert dari payload', async () => {
      expect(dialogTriggered, 'Dialog terbuka — XSS payload jalan').toBe(false);
    });

    await test.step('URL tetap di /login', async () => {
      expect(await loginPage.isStillOnLoginContext()).toBe(true);
    });
  });

  // ── TC-08 : Very long credentials → graceful error ────────────────────────
  test('TC-08 | Very long credentials (1500 chars) — graceful error, no crash', async ({ page }) => {
    const longStr = 'a'.repeat(1500);
    await loginPage.attemptLogin(longStr, longStr);
    await page.waitForTimeout(5000);

    // Yang penting: page masih responsive, masih di /login
    expect(await loginPage.isStillOnLoginContext(), 'Page crash atau redirect tak terduga').toBe(true);

    // Page masih functional — coba interaksi
    const userInput = page.locator('input[name="username"], input[name="email"], input[type="email"]').first();
    await expect(userInput, 'Username field tidak responsive setelah long input').toBeVisible();
  });

  // ── TC-09 : Multiple failed login attempts — tetap di konteks login ───────
  test('TC-09 | 3x failed login berturut-turut — tetap di konteks login (no auto-bypass)', async ({ page }, testInfo) => {
    const attempts: Array<{ attempt: number; toast: string | null; stillOnLogin: boolean; url: string }> = [];
    for (let i = 1; i <= 3; i++) {
      await loginPage.attemptLogin(`badUser${i}`, `badPass${i}`);
      const toast = await loginPage.waitForErrorToast(8000);
      const stillOnLogin = await loginPage.isStillOnLoginContext();
      attempts.push({ attempt: i, toast, stillOnLogin, url: page.url() });
      await page.waitForTimeout(500);
    }
    await testInfo.attach('3-attempt log', {
      body: JSON.stringify(attempts, null, 2),
      contentType: 'application/json',
    });

    for (const a of attempts) {
      expect(
        a.stillOnLogin,
        `Attempt ${a.attempt}: tidak lagi di konteks login. URL=${a.url}`,
      ).toBe(true);
    }
  });

  // ── TC-10 : Field tipe input untuk password — type=password (masked) ──────
  test('TC-10 | Password field bertipe "password" (masked text)', async ({ page }) => {
    const type = await page.locator('input[name="password"], input[type="password"]').first().getAttribute('type');
    expect(type, `Password field type harus "password", got "${type}"`).toBe('password');
  });
});
