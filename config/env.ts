/**
 * Sumber tunggal konfigurasi target uji.
 *
 * Repo ini PUBLIK, jadi tidak ada nama klien, host internal, atau kredensial
 * yang ditulis di kode. Semua nilai nyata datang dari environment variable
 * (lihat `.env.example`); default di sini hanya placeholder yang aman.
 *
 * Konsekuensi yang disengaja: menjalankan suite tanpa mengisi env akan
 * GAGAL CEPAT dengan pesan jelas, bukan diam-diam menghantam host acak.
 */

import fs from 'fs';
import path from 'path';

// Muat `.env` bila ada. Dibungkus try/catch supaya repo tetap jalan tanpa dotenv
// (mis. di CI yang menyuntik env lewat secrets, bukan lewat file).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  /* dotenv opsional */
}

function env(nama: string): string | undefined {
  const v = process.env[nama];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

/** Base URL situs yang diuji. Wajib diisi untuk suite web. */
export const BASE_URL = env('TEST_BASE_URL') ?? 'https://example.com';

/** Dashboard agen (SPA terpisah dari situs publik pada banyak platform properti). */
export const AGENT_DASHBOARD_URL = env('TEST_AGENT_DASHBOARD_URL') ?? `${BASE_URL}/`;

/** Halaman registrasi agen. */
export const REGISTRASI_URL =
  env('TEST_REGISTRATION_URL') ?? `${BASE_URL}/agent/agentregistration`;

/**
 * Bentuk form login berbeda per environment:
 *   - 'page'  → form login berdiri sendiri di `/agent/login` (umumnya dev/staging)
 *   - 'modal' → form login di dalam modal, dibuka dari menu profil (umumnya produksi)
 *
 * Dideteksi dari hostname, bisa dipaksa via `TEST_LOGIN_MODE`.
 */
export const LOGIN_MODE: 'page' | 'modal' = (() => {
  const paksa = env('TEST_LOGIN_MODE');
  if (paksa === 'page' || paksa === 'modal') return paksa;
  let host = BASE_URL;
  try {
    host = new URL(BASE_URL).hostname;
  } catch {
    /* biarkan string apa adanya */
  }
  return /(^|[.\-])(dev|staging|uat|localhost|127\.0\.0\.1)/i.test(host) ? 'page' : 'modal';
})();

/** Label UI yang mengandung merek — dijauhkan dari kode agar repo tetap netral. */
export const LABEL = {
  /** Tab pilihan login "agen" di dalam modal login. */
  tabAgen: env('TEST_LABEL_TAB_AGEN') ?? 'Agen',
  /** aria-label tombol pembuka menu profil di header. */
  menuProfil: env('TEST_LABEL_MENU_PROFIL') ?? 'Menu Profil',
  /** Salah satu opsi dropdown "sumber informasi" di form registrasi. */
  sumberInformasi: env('TEST_LABEL_SUMBER_INFORMASI') ?? 'Media Sosial',
};

/** Kredensial agen. Tanpa ini, suite yang butuh login akan di-skip, bukan gagal palsu. */
export const AGENT = {
  username: env('TEST_AGENT_USERNAME') ?? '',
  password: env('TEST_AGENT_PASSWORD') ?? '',
};

export const punyaKredensialAgen = AGENT.username !== '' && AGENT.password !== '';

/**
 * Berkas `storageState` sesi agen.
 *
 * Alasan keberadaannya: reCAPTCHA invisible menolak sesi otomatis di **langkah
 * login**, sedangkan form-form setelah login tidak dilindungi captcha. Dengan
 * login sekali secara headed (`npm run auth:agen`) lalu memakai sesinya, spec
 * pasca-login bisa jalan headless — termasuk di CI, di mana sesinya dipulihkan
 * dari secret (lihat `scripts/sesi-agen.mjs`).
 *
 * Berkasnya berisi token sesi nyata → ada di .gitignore, JANGAN pernah di-commit.
 */
export const SESI_AGEN_FILE =
  env('TEST_AGENT_STORAGE_STATE') ?? path.join(process.cwd(), 'playwright', '.auth', 'agen.json');

/**
 * Apakah sesi agen tersimpan tersedia DAN berisi sesuatu?
 *
 * Bukan sekadar cek keberadaan berkas: `storageState` yang tersimpan dari sesi
 * gagal login berbentuk `{"cookies":[],"origins":[]}` — berkas ada, isinya kosong.
 * Kalau itu dianggap "ada sesi", spec pasca-login akan menempuh jalur tanpa login
 * lalu gagal di dashboard dengan pesan yang menyesatkan. Lebih baik dianggap tidak
 * ada sesi, sehingga spec-nya skip dengan alasan yang benar.
 */
export function adaSesiAgen(): boolean {
  try {
    if (!fs.existsSync(SESI_AGEN_FILE)) return false;
    const isi = JSON.parse(fs.readFileSync(SESI_AGEN_FILE, 'utf8')) as {
      cookies?: unknown[];
      origins?: unknown[];
    };
    return (isi.cookies?.length ?? 0) + (isi.origins?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Pola ID listing yang dipakai platform (mis. `131226-ABC00007`). Dipakai untuk
 * memungut ID listing hasil submit dari UI. Bisa diganti via env.
 */
export const POLA_ID_LISTING = new RegExp(
  env('TEST_LISTING_ID_PATTERN') ?? '\\b\\d{6}-[A-Z]{2,6}\\d{3,7}\\b',
);

/** Target aplikasi native Android untuk suite mobilewright. */
export const MOBILE = {
  /** applicationId APK. Cek di device: `adb shell pm list packages`. */
  pkg: env('MOBILE_APP_PACKAGE') ?? 'com.example.propertyapp',
  /** Path APK yang di-install ulang tiap run. APK tidak disertakan di repo. */
  apk: env('MOBILE_APK_PATH') ?? './app-under-test.apk',
  /** Regex nama device seperti yang DILAPORKAN mobilecli (bukan nama AVD). */
  deviceName: new RegExp(env('MOBILE_DEVICE_NAME') ?? 'sdk_gphone'),
};

/** Guard eksplisit — dipakai suite web supaya kesalahan konfigurasi terlihat sebagai pesan, bukan timeout. */
export function pastikanBaseUrlTerisi(): void {
  if (!env('TEST_BASE_URL')) {
    throw new Error(
      'TEST_BASE_URL belum diisi. Salin .env.example → .env dan arahkan ke lingkungan uji Anda ' +
        '(repo ini publik, jadi tidak ada host default yang disertakan).',
    );
  }
}
