# test/mobile — spec mobile-web

Folder ini dipetakan ke project Playwright `chromium-mobile` (viewport Pixel 5)
lewat `testDir` per project di `playwright.config.ts`. Taruh spec **mobile-web**
(browser di viewport ponsel) di sini; spec Android **native** ada di
`test-mobile-native/` dan dijalankan runner mobilewright, bukan Playwright.

Alasan pemetaan folder: dengan daftar `testMatch` manual, spec mobile-web yang lupa
didaftarkan ikut jalan di viewport desktop dan gagal dengan alasan menyesatkan.
