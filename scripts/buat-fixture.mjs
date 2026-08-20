#!/usr/bin/env node
/**
 * Menghasilkan fixture gambar SINTETIS untuk suite upload.
 *
 * Kenapa dibuat, bukan di-commit: fixture upload di proyek nyata sering berupa
 * foto properti atau foto dokumen identitas — dua hal yang tidak boleh masuk repo
 * publik. Skrip ini membuat PNG valid dari nol (tanpa dependensi) sehingga suite
 * tetap bisa dijalankan siapa pun tanpa aset milik orang lain.
 *
 *   npm run fixtures
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const TABEL_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABEL_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipe, data) {
  const panjang = Buffer.alloc(4);
  panjang.writeUInt32BE(data.length);
  const isi = Buffer.concat([Buffer.from(tipe, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(isi));
  return Buffer.concat([panjang, isi, crc]);
}

/** Tulis PNG truecolor 8-bit dari fungsi warna (x, y) → [r, g, b]. */
function tulisPng(path, lebar, tinggi, warna) {
  const baris = [];
  for (let y = 0; y < tinggi; y++) {
    const b = Buffer.alloc(1 + lebar * 3);
    b[0] = 0; // filter: none
    for (let x = 0; x < lebar; x++) {
      const [r, g, bl] = warna(x, y);
      b[1 + x * 3] = r;
      b[2 + x * 3] = g;
      b[3 + x * 3] = bl;
    }
    baris.push(b);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lebar, 0);
  ihdr.writeUInt32BE(tinggi, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(baris), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
  console.log(`✔ ${path} (${lebar}×${tinggi}, ${(png.length / 1024).toFixed(1)} KB)`);
}

// Foto properti: gradien langit + "tanah" + garis diagonal supaya jelas sintetis.
tulisPng(resolve('fixtures/sample-property.png'), 1200, 800, (x, y) => {
  if (y > 560) return [96 + ((x + y) % 24), 120 + ((x * 2 + y) % 20), 78];
  if (Math.abs(x - y * 1.5) < 14) return [230, 230, 235];
  const t = y / 560;
  return [Math.round(110 + 120 * t), Math.round(150 + 90 * t), Math.round(210 - 40 * t)];
});

// Foto "dokumen": bidang terang + garis-garis horizontal menyerupai baris teks.
tulisPng(resolve('fixtures/sample-id-card.png'), 800, 500, (x, y) => {
  const dalamKartu = x > 40 && x < 760 && y > 40 && y < 460;
  if (!dalamKartu) return [40, 44, 52];
  const barisTeks = y > 120 && y < 420 && y % 40 < 12 && x > 260 && x < 700;
  if (barisTeks) return [150, 156, 168];
  const kotakFoto = x > 80 && x < 230 && y > 120 && y < 320;
  if (kotakFoto) return [190, 196, 208];
  return [238, 240, 244];
});

console.log('\nFixture sintetis siap. Tidak ada data pribadi di dalamnya.');
