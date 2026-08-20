import { LABEL } from '../../config/env';

/**
 * Data uji registrasi agen.
 *
 * Email & nomor WhatsApp WAJIB unik per run — backend menolak duplikat, dan tanpa
 * keunikan test hanya lulus sekali lalu gagal selamanya dengan alasan yang terlihat
 * seperti bug produk.
 */
export function dataRegistrasiUnik() {
  const cap = Date.now();

  return {
    namaLengkap: 'QA Otomasi',
    nomorWhatsApp: `0812${cap.toString().slice(-7)}`,
    email: `qa.otomasi${cap}@example.com`,
    alamatDomisili: 'Jl. Pengujian Otomasi No. 1',
    keterangan: `Keterangan uji otomatis ${cap}`,
    fotoKTP: 'fixtures/sample-id-card.png',
    berkasBukanGambar: 'fixtures/bukan-gambar.txt',
    kendaraan: 'Motor',
    memilikiSIM: 'Tidak',
    sumberInformasi: LABEL.sumberInformasi,
    pernahBergabung: 'Tidak',
    pendidikan: 'D3',
    pengalaman: 'Fresh Graduate',
  };
}

export type DataRegistrasi = ReturnType<typeof dataRegistrasiUnik>;
