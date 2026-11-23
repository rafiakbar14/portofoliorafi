# Spesifikasi Prototipe dan Arah Implementasi

Status: rekomendasi teknis, belum diimplementasikan dan belum mengunci pilihan teknologi.
Sumber kebutuhan: [PRD](01-PRD.md) dan [alur/data](02-ALUR-DAN-DATA.md).

## 1. Batas hasil tahap sekarang

Tahap sekarang menghasilkan dokumen saja. Tidak ada pemasangan dependensi, pembuatan kode aplikasi, perubahan portofolio, deployment, maupun integrasi pihak ketiga.

Folder rental-mobil berada di dalam workspace yang ada, tetapi merupakan direktori aplikasi terpisah. Folder ini belum menjadi repository Git tersendiri. Jika nantinya ingin repository dan deployment independen, penyiapannya harus dikonfirmasi dahulu.

## 2. Perbandingan pendekatan

| Pendekatan | Kelebihan | Kekurangan | Kesesuaian |
| --- | --- | --- | --- |
| Wireframe statis | Cepat menilai susunan layar | Tidak membuktikan transaksi dan konflik | Berguna untuk persetujuan awal, belum cukup sebagai hasil demo |
| Demo interaktif lokal | Semua alur bisa dicoba tanpa akun, backend, atau biaya integrasi | Bukan keamanan/persistensi produksi | Rekomendasi tahap pertama |
| MVP dengan backend | Bisa mulai menguji penggunaan bersama dan izin nyata | Memerlukan keputusan hosting, akun, database, keamanan, dan operasional | Tahap setelah demo disetujui |

Rekomendasi: satu aplikasi web demo dengan logika bisnis yang benar untuk batas skenario yang disepakati, bukan kumpulan layar statis dan bukan MVP produksi yang diberi label demo.

## 3. Usulan stack

| Lapisan | Usulan | Alasan |
| --- | --- | --- |
| Aplikasi | React + TypeScript + Vite | Sesuai dashboard interaktif tanpa kebutuhan server-rendering pada demo |
| Navigasi | React Router | URL per halaman dan detail, tombol back/forward, penanganan ID tidak ditemukan |
| Komponen | Tailwind CSS + komponen berbasis Radix/shadcn seperlunya | Form, dialog, tabel, dan navigasi konsisten; tetap diuji aksesibilitasnya |
| Form dan validasi | React Hook Form + Zod | Validasi batas input dan pesan error yang konsisten |
| Tanggal | date-fns + dukungan timezone yang kompatibel | Perhitungan kalender dan WIB harus eksplisit, tidak bergantung zona mesin |
| State demo | Store/context sederhana dengan actions domain terpusat | Satu sumber state tanpa layanan backend fiktif |
| Persistensi | localStorage untuk dataset kecil dan fiktif | Bisa memuat ulang tanpa kehilangan demo dalam browser yang sama |
| Pengujian | Vitest + Testing Library + Playwright | Unit perhitungan, perilaku komponen, dan alur browser |
| Grafik | Tidak wajib pada P0 | Tabel dan angka lebih mudah dipahami untuk laporan dasar |

Versi paket ditentukan saat implementasi dengan memeriksa kompatibilitas, bukan ditebak di dokumen ini. Tidak ada kebutuhan Redis, message queue, microservices, atau payment SDK untuk demo.

## 4. Struktur aplikasi yang diusulkan

Struktur ini hanya rencana; folder sumber berikut belum dibuat.

```text
rental-mobil/
  docs/
  src/
    app/          routing, shell, konteks perusahaan/peran
    components/   komponen UI yang benar-benar dipakai bersama
    features/     platform, dashboard, armada, pelanggan, sopir,
                  booking, keuangan, laporan, pengaturan
    domain/       tipe data, aturan jadwal, tarif, status, uang
    data/         seed fiktif, penyimpanan lokal, migrasi versi demo
    styles/       token dan styling global
  tests/          skenario integrasi dan end-to-end
```

Jangan membuat repository abstrak, API palsu, atau generalisasi multi-industri. Batas domain dibuat hanya untuk aturan yang benar-benar digunakan dan perlu diuji.

## 5. Kontrak perilaku state

Alur data:

```text
Form / tombol
→ validasi input dan konteks peran/perusahaan
→ tindakan domain
→ validasi relasi, status, jadwal, dan saldo
→ bentuk next state lengkap
→ simpan lokal bila tersedia
→ perbarui UI dan aktivitas
```

Daftar tindakan utama, bukan endpoint jaringan:

| Tindakan | Pemeriksaan kunci | Perubahan atomik dalam state |
| --- | --- | --- |
| createTenant | Peran platform, kode unik | Tenant + settings + pemilik/staf simulasi |
| setTenantStatus | Peran platform, konfirmasi | Status + aktivitas; akses ruang kerja diperiksa kembali |
| saveVehicle/saveCustomer/saveDriver | Tenant/peran, field wajib lengkap, batas arsip/status | Entitas + aktivitas |
| saveDraft | Tenant sama, field wajib lengkap, pilihan dan periode valid; tanpa jaminan ketersediaan | Draft, tanpa invoice dan tanpa blokir jadwal |
| confirmBooking | Draft lengkap, tarif, konflik, waktu, sumber daya aktif | Status + snapshot + seluruh invoice + aktivitas |
| recordRentalPayment | Invoice non-void, nominal positif ≤ saldo | CashEntry + aktivitas |
| receiveDeposit | Booking confirmed/active, nominal ≤ kekurangan deposit | CashEntry + aktivitas |
| checkOut | Guard PRD BR-08, tidak ada pemakaian/buffer pengembalian sebelumnya | Handover out + status active + aktivitas |
| checkIn | Active, checklist valid, nominal biaya valid | Handover in + status completed + invoice biaya akhir bila ada + aktivitas |
| cancelBooking | Draft/confirmed, alasan | Status cancelled + void semua invoice + aktivitas |
| refundRentalPayment | Booking cancelled, invoice void, nominal ≤ penerimaan bersih | CashEntry refund + aktivitas |
| refundDeposit | Booking cancelled/completed, nominal ≤ saldo deposit | CashEntry refund + aktivitas |
| updateSettings | Pemilik, nominal/buffer valid | Settings + aktivitas; tidak mengubah snapshot lama |
| resetDemo | Konfirmasi pengguna | Ganti hanya namespace demo ini dengan seed awal |

UI tidak boleh langsung mengubah array transaksi tanpa tindakan domain. Validasi peran dan tenant diulang pada tindakan, bukan hanya menyembunyikan tombol. Ini tetap bukan jaminan keamanan di luar browser.

## 6. Penyimpanan dan pemulihan demo

- Gunakan satu namespace khusus, misalnya rental-mobil-demo:v1; jangan memanggil localStorage.clear().
- Envelope menyimpan schemaVersion, dataset, peran/perusahaan aktif, dan waktu acuan demo.
- Persistensi hanya menyimpan data fiktif; tidak ada password, token, KTP, SIM, atau rekening asli.
- Jika data tersimpan rusak/tidak kompatibel, tampilkan layar pemulihan dan minta persetujuan reset; jangan menimpa diam-diam.
- Jika storage ditolak/penuh, demo tetap dapat dipakai dalam memori dengan banner bahwa data tidak akan bertahan setelah reload.
- Reset memerlukan konfirmasi eksplisit dan tidak menyentuh portofolio atau namespace aplikasi lain.
- Dukungan penggunaan simultan pada banyak tab/browser tidak termasuk. Tampilkan batas ini pada bantuan demo.

## 7. Dataset dan jam demo

Usulan seed kecil tetapi mencakup semua cabang alur:

| Data | Isi usulan |
| --- | --- |
| Perusahaan | 2 perusahaan fiktif aktif dengan nama/kode berbeda |
| Pengguna simulasi | 1 admin platform; pemilik dan staf untuk tiap perusahaan |
| Armada | 6 mobil per perusahaan, termasuk ready, maintenance, dan inactive |
| Sopir | 3 per perusahaan, termasuk seorang inactive |
| Pelanggan | 8 per perusahaan dengan status terverifikasi/belum diverifikasi |
| Penyewaan | 10 per perusahaan mencakup draft, confirmed, active, completed, cancelled, harian/bulanan |
| Tagihan/transaksi | Lunas, parsial, belum jatuh tempo, lewat jatuh tempo, deposit, dan refund tertunda |

Nama, kontak, nomor booking, dan tarif harus jelas fiktif. Jangan mengambil data portofolio atau data pribadi pengguna untuk seed.

Waktu acuan demo dibekukan saat seed pertama dibuat agar skenario tidak berubah tanpa penjelasan. Banner memperlihatkan tanggal/jam simulasi dan alat demo menyediakan “Maju 1 jam”, “Maju 1 hari”, “Maju ke tanggal/jam tertentu”, serta reset. Pemilihan waktu tertentu harus lebih maju dari jam demo saat ini; ini memungkinkan booking singkat dan keterlambatan dalam hitungan menit diuji tanpa melompati waktunya. Waktu acuan disimpan bersama dataset sehingga reload tidak menggeser jatuh tempo.

Seluruh validasi masa lalu, overdue, check-out/check-in, dan filter hari ini menggunakan jam demo yang sama. Timestamp aktivitas/transaksi juga memakai jam demo. Unit test kalender menggunakan waktu tetap; uji manual dapat memakai kontrol maju waktu. Jangan membuat waktu server dan waktu simulasi bercampur tanpa label.

Dataset seed wajib memenuhi invariant; kasus konflik disediakan sebagai percobaan input, bukan data rusak yang sudah tertanam.

## 8. Arah UX dan visual untuk persetujuan

### Rekomendasi

Dashboard operasional dengan latar netral, kontras teks tinggi, satu warna utama untuk tindakan, dan warna status yang selalu disertai label. Gunakan tipografi sans-serif yang mudah dibaca, angka nominal rata kanan, serta kepadatan tabel sedang.

Ini belum merupakan identitas merek final. Nama aplikasi, logo, warna utama, dan font dipilih setelah struktur layar disetujui. Tidak perlu gambar AI, foto kendaraan eksternal, animasi rumit, atau landing page untuk membuktikan alur demo.

### Pola interaksi

- Setiap halaman memiliki satu aksi utama yang jelas, misalnya “Buat booking”.
- Form booking bertahap menampilkan ringkasan harga yang tetap mudah diakses.
- Pilihan mobil/sopir yang tidak tersedia menunjukkan alasan, bukan sekadar hilang tanpa penjelasan.
- Aksi destruktif/keuangan memerlukan ringkasan dampak sebelum konfirmasi.
- Toast melengkapi perubahan UI; bukan pengganti hasil tindakan.
- Aksi tidak tersedia menampilkan alasan, misalnya “Deposit kurang Rp200.000”.
- Peringatan piutang tidak disamakan dengan kegagalan serah-terima jika kebijakan memperbolehkannya.
- Input angka memformat tampilan rupiah tetapi domain tetap menerima integer.

### Empty, error, dan loading state

- Perusahaan baru: “Belum ada kendaraan. Tambahkan armada untuk mulai menerima booking.”
- Konflik jadwal: tampilkan mobil/sopir, rentang waktu konflik, dan ajakan memilih waktu lain.
- Hasil pencarian kosong: sediakan reset filter, bukan tombol buat transaksi yang tidak relevan.
- Halaman tidak ditemukan: arahkan kembali ke daftar dalam perusahaan aktif.
- Penyimpanan gagal: jelaskan bahwa perubahan belum tersimpan permanen.
- Tidak perlu spinner/delay palsu karena semua data demo lokal; loading hanya untuk pekerjaan nyata.

### Aksesibilitas dan perangkat

Target desain mengacu pada WCAG 2.2 AA, tetapi klaim kepatuhan memerlukan pengujian nyata. Periksa kontras, nama kontrol, urutan heading, fokus dialog, navigasi keyboard, dan reduced motion.

Uji 390×844, 768×1024, dan 1440×900. Target sentuh sekitar 44×44 piksel untuk tindakan utama. Tampilan mobile mempertahankan urutan tugas dan semua informasi penting; tabel/kalender dapat memiliki scroll internal.

## 9. Pemisahan dari produksi

| Aspek | Demo | Syarat sebelum produksi |
| --- | --- | --- |
| Identitas | Pemilih peran | Login dan sesi aman, pemulihan akun |
| Tenant | Filter serta guard state | Keanggotaan diverifikasi server; isolasi database dan pengujian akses lintas tenant |
| Jadwal | Validasi satu dataset browser | Transaksi database/locking untuk menolak race condition |
| Pembayaran | Catatan manual fiktif | Rekonsiliasi; webhook terverifikasi dan idempotensi jika memakai gateway |
| Audit | Log lokal dapat diubah | Audit server terlindungi dengan kebijakan retensi |
| Penyimpanan | localStorage | Database, backup, restore teruji, migrasi |
| Dokumen | Checklist teks tanpa unggahan | Penyimpanan privat, kontrol akses, retensi, persetujuan yang relevan |
| Finansial | Ringkasan operasional | Kebijakan invoice, refund, pajak, dan pencatatan yang dikonfirmasi |
| SaaS | Banyak ruang kerja demo | Provisioning tenant, manajemen anggota, paket dan billing bila diperlukan |

Arsitektur produksi yang masuk akal untuk dievaluasi kemudian adalah frontend web + satu layanan backend + PostgreSQL dengan isolasi tenant. Pilihan vendor hosting/auth/payment tidak ditetapkan tanpa kebutuhan produksi, anggaran, dan persetujuan pengguna.

## 10. Gerbang sebelum menulis kode

1. Pengguna menyetujui PRD dan penyederhanaan bisnis.
2. Pengguna menyetujui fokus demo lokal dan stack, atau memilih alternatif.
3. Wireframe inti disetujui: dashboard, kalender, form booking, detail/pengembalian.
4. Setelah izin implementasi, aplikasi dibangun bertahap mengikuti dokumen 04.
5. Sebelum dinyatakan selesai, jalankan dev server, gunakan alur nyata di browser, periksa console, dan uji ukuran layar target.

Tidak ada aplikasi, screenshot implementasi, atau hasil tes yang diklaim sudah tersedia pada tahap dokumentasi ini.
