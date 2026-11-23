# Backlog, Tahapan, dan Rencana Pengujian

Status: rencana kerja untuk disetujui; seluruh implementasi dan pengujian aplikasi belum dilakukan.
Referensi: [PRD](01-PRD.md), [alur/data](02-ALUR-DAN-DATA.md), [spesifikasi prototipe](03-SPESIFIKASI-PROTOTIPE.md).

## 1. Tahapan dan gerbang penerimaan

Tidak ada estimasi waktu/biaya pasti sebelum scope, desain, dan ketersediaan penguji disetujui. Urutan berikut adalah dependensi, bukan janji tanggal selesai.

| Tahap | Hasil | Bergantung pada | Gerbang lanjut |
| --- | --- | --- | --- |
| 0. Penemuan dan dokumen | PRD, aturan, alur, model data, backlog | Jawaban pengguna | Persetujuan pengguna; tahap saat ini |
| 1. Wireframe | Dashboard, jadwal, form booking, detail/check-in | Tahap 0 disetujui | Susunan informasi dan alur disetujui |
| 2. Fondasi demo | Shell, peran/tenant, domain, seed, storage, jam demo | Tahap 1 | Tenant switching, reload, reset, guard dasar lolos |
| 3. Satu alur end-to-end | Armada/pelanggan, booking harian lepas kunci, invoice, check-out/check-in | Tahap 2 | Skenario TC-01 sampai TC-07 yang relevan lolos |
| 4. Variasi operasional | Sopir, bulanan, deposit/refund, biaya akhir | Tahap 3 | Konflik, kalender bulanan, ledger, pembatalan lolos |
| 5. Kelengkapan SaaS | Admin perusahaan, laporan, pengaturan, aktivitas, empty state | Tahap 4 | Seluruh FR P0 terhubung dan konsisten |
| 6. QA dan demo | Unit/integrasi/E2E, responsif, aksesibilitas, perbaikan | Tahap 5 | Definition of Done terpenuhi dan UAT pengguna |

Publikasi online dan pembangunan backend produksi adalah keputusan terpisah setelah demo, bukan bagian otomatis dari tahapan ini.

## 2. Backlog dengan kriteria penerimaan

### EP-01 — Ruang kerja SaaS (FR-01, FR-02)

**US-01 — Memilih konteks demo.** Sebagai penguji, saya ingin memilih perusahaan dan peran agar memahami pengalaman tiap pengguna.

- Given dua tenant dengan data berbeda, when beralih perusahaan, then seluruh daftar, pencarian, KPI, dan detail hanya memakai tenant tujuan.
- Form yang belum disimpan memerlukan konfirmasi sebelum berpindah.
- Mengakses ID tenant lain menghasilkan state tidak ditemukan.
- Role selector diberi label simulasi; tidak ada form kata sandi palsu.

**US-02 — Mengelola perusahaan.** Sebagai admin platform, saya ingin menambah dan menonaktifkan perusahaan demo.

- Kode perusahaan wajib unik; nama wajib diisi.
- Perusahaan baru memiliki settings default, pemilik/staf simulasi, dan empty state tanpa data tenant lain.
- Penonaktifan memerlukan konfirmasi, mempertahankan data, dan menolak akses ruang kerja.
- Pengaktifan kembali mengembalikan akses; admin platform tidak melihat data pelanggan/transaksi rinci.

### EP-02 — Data operasional (FR-04, FR-06, FR-07)

**US-03 — Mengelola armada.** Sebagai staf, saya ingin mencatat kendaraan dan status operasionalnya.

- Pelat duplikat setelah normalisasi ditolak dalam tenant yang sama; pelat sama di tenant berbeda diperbolehkan.
- maintenance/inactive tidak dapat dikonfirmasi untuk booking.
- Kendaraan dengan booking confirmed/active tidak dapat diarsipkan atau dinonaktifkan.
- Staf mengelola data nonharga; hanya pemilik mengubah tarif. Tarif kendaraan yang belum diatur tidak dianggap gratis.

**US-04 — Mengelola pelanggan.** Sebagai staf, saya ingin mencatat pelanggan fiktif dan status pemeriksaan identitas.

- Nama wajib; kontak bersifat fiktif dan tidak meminta dokumen identitas asli.
- Pelanggan belum diverifikasi boleh booking, tetapi tidak boleh check-out.
- Pelanggan dengan confirmed/active tidak dapat diarsipkan; riwayat pelanggan yang kemudian diarsipkan tetap terlihat.

**US-05 — Mengelola sopir.** Sebagai staf, saya ingin menentukan sopir yang dapat ditugaskan.

- Sopir memiliki status dan tarif harian/bulanan terpisah.
- Sopir inactive/arsip atau tarif belum diatur tidak dapat dipakai untuk konfirmasi terkait.
- Penugasan yang bertabrakan ditolak meskipun kendaraannya berbeda.

### EP-03 — Booking dan jadwal (FR-05, FR-08, FR-09, FR-12)

**US-06 — Booking harian.** Sebagai staf, saya ingin membuat booking dengan harga yang dapat dijelaskan.

- Durasi 24 jam dihitung satu hari; 25 jam dihitung dua hari.
- Draft tidak memblokir jadwal dan tidak memiliki invoice.
- Konfirmasi memeriksa ulang sumber daya, mengunci snapshot, dan membuat satu tagihan sewa.
- Perubahan tarif master tidak mengubah tagihan booking yang sudah dikonfirmasi.
- Dengan sopir menambahkan tarif sopir sesuai jumlah hari; lepas kunci tidak menerima driverId tersembunyi.

**US-07 — Kalender ketersediaan.** Sebagai staf, saya ingin melihat penggunaan armada mingguan.

- Kalender membedakan confirmed, active, dan buffer dengan label/legenda.
- Pencarian rentang memeriksa booking dan buffer, bukan hanya status ready kendaraan.
- Klik booking membuka detail perusahaan yang sama.
- Mobil active yang terlambat memblokir konfirmasi baru hingga check-in; booking berikutnya yang sudah confirmed diberi peringatan konflik aktual.

**US-08 — Kontrak bulanan.** Sebagai staf, saya ingin membuat kontrak dengan tagihan per bulan kalender.

- Jumlah bulan harus integer 1–12.
- Batas periode dihitung dari tanggal awal kontrak; tanggal 31 tidak bergeser permanen menjadi 28.
- Satu invoice per periode dibuat saat konfirmasi dengan dueAt awal periode.
- Tagihan masa depan tidak dianggap overdue; total kontrak sama dengan jumlah invoice sewa.
- Bulanan dengan sopir memblokir satu sopir untuk seluruh kontrak dan memakai tarif bulanannya.

### EP-04 — Serah-terima (FR-10)

**US-09 — Check-out.** Sebagai staf, saya ingin mencatat kondisi keluar sebelum menyerahkan mobil.

- Hanya confirmed yang bisa check-out, pada waktu mulai hingga sebelum akhir.
- Verifikasi pelanggan, checklist, saldo deposit, status sumber daya, konflik active, dan buffer sebelumnya diperiksa.
- Piutang sewa menampilkan peringatan dengan pengakuan eksplisit, bukan otomatis menolak.
- Check-out membuat tepat satu Handover out dan mengubah booking menjadi active.

**US-10 — Check-in.** Sebagai staf, saya ingin mencatat pengembalian dan biaya tambahan secara transparan.

- Odometer akhir tidak boleh kurang dari awal; fuelPercent berada pada 0–100.
- Keterlambatan memakai tarif snapshot; biaya manual membutuhkan alasan.
- Handover in, status completed, dan invoice biaya akhir tersimpan bersama.
- Piutang tetap tercatat jika belum lunas; deposit tidak otomatis dipotong/dikembalikan.
- Pengembalian lebih awal tidak menghasilkan prorata otomatis.

### EP-05 — Keuangan dan pembatalan (FR-11)

**US-11 — Pencatatan uang sewa.** Sebagai staf, saya ingin mencatat pembayaran penuh/parsial terhadap invoice.

- Nominal integer positif dan tidak melebihi sisa tagihan; metode tunai atau transfer manual.
- Catatan pembayaran memperbarui sisa tagihan dan status open/partial/paid.
- Invoice void tidak menerima pembayaran baru.
- Klik ganda tidak menambah pembayaran identik dua kali dari satu pengiriman form.

**US-12 — Deposit.** Sebagai staf, saya ingin memisahkan uang jaminan dari uang sewa.

- Penerimaan hanya pada confirmed/active, maksimal kekurangan deposit yang disepakati.
- Refund hanya pada cancelled/completed dan tidak melebihi saldo deposit.
- Saldo deposit tidak menambah kas sewa atau mengurangi piutang.
- Tidak ada penghapusan CashEntry maupun pemotongan deposit otomatis.

**US-13 — Pembatalan dan refund sewa.** Sebagai staf, saya ingin membatalkan sebelum kendaraan diserahkan.

- Alasan wajib; active/completed tidak dapat dibatalkan.
- Pembatalan melepaskan reservasi dan mem-void seluruh invoice secara atomik.
- Pembayaran sebelumnya menjadi kewajiban refund, bukan hilang atau langsung dianggap dikembalikan.
- Refund sewa hanya untuk invoice void dari booking cancelled, maksimal penerimaan bersih invoice tersebut.

### EP-06 — Ringkasan dan kebijakan (FR-03, FR-13, FR-14, FR-16)

**US-14 — Dashboard/laporan.** Sebagai pemilik, saya ingin melihat angka yang sesuai transaksi.

- Kas sewa bersih dihitung dari rental_payment minus rental_refund pada rentang tanggal transaksi.
- Piutang dan deposit adalah snapshot saat ini dengan label jelas; bukan saldo historis dari filter tanggal.
- Piutang masa depan, piutang overdue, dan kewajiban refund dibedakan.
- Dashboard operasional staf tidak memberikan akses halaman laporan pemilik.

**US-15 — Pengaturan dan aktivitas.** Sebagai pemilik, saya ingin mengatur kebijakan tanpa merusak transaksi lama.

- Buffer berupa integer menit nonnegatif; deposit dan tarif terlambat berupa integer rupiah nonnegatif.
- Perubahan settings hanya berpengaruh pada konfirmasi setelah perubahan.
- Aktivitas menyimpan tindakan, waktu demo, dan pelaku simulasi per tenant.
- Activity diberi batasan sebagai riwayat demo lokal, bukan audit yang tahan manipulasi.

### EP-07 — Keandalan demo (FR-15)

**US-16 — Reload/reset.** Sebagai penguji, saya ingin mencoba skenario tanpa kehilangan konteks secara tak terduga.

- Reload mempertahankan dataset, tenant/peran, dan waktu demo jika storage tersedia.
- Reset meminta konfirmasi dan hanya menghapus/mengganti namespace rental-mobil-demo.
- Storage rusak tidak ditimpa otomatis; storage tidak tersedia menghasilkan peringatan mode sementara.
- Semua aksi dan state inti tetap dapat dipakai pada viewport target dengan keyboard.

## 3. Test matrix wajib

Semua baris berikut berstatus BELUM DIJALANKAN. Expected result adalah target, bukan bukti implementasi.

| ID | Skenario | Hasil yang diharapkan | Lapisan utama |
| --- | --- | --- | --- |
| TC-01 | Pilih tenant A, buat pelanggan, pindah ke B, coba ID A | Tidak tampil/bisa diubah dari tenant B | E2E + integrasi |
| TC-02 | Staf membuka pengaturan/laporan atau mengubah tarif melalui action | Ditolak tanpa perubahan state | Integrasi + E2E |
| TC-03 | Mobil Rp350.000/hari, durasi 24 dan 25 jam | Rp350.000 dan Rp700.000 | Unit |
| TC-04 | Harian dengan sopir Rp200.000/hari selama 25 jam | Total Rp1.100.000 | Unit + E2E |
| TC-05 | Draft disimpan lalu konfirmasi dua kali | Satu konfirmasi, satu set invoice; draft tak memblokir | Integrasi |
| TC-06 | Booking berakhir 10.00, buffer 2 jam; kandidat 11.59 lalu 12.00 | 11.59 ditolak, 12.00 diterima jika tak ada konflik lain | Unit + E2E |
| TC-07 | Check-out valid lalu check-in normal | Transisi confirmed → active → completed; dua handover | E2E |
| TC-08 | Sopir sama, kendaraan berbeda, jadwal tumpang tindih | Konfirmasi ditolak | Unit + integrasi |
| TC-09 | Kontrak 31 Jan 2027 untuk 2 bulan, Rp6 juta/bulan | Periode 31 Jan–28 Feb–31 Mar; total Rp12 juta | Unit |
| TC-10 | Kontrak 31 Jan 2028 dan mulai 29 Feb 2028 selama 12 bulan | Kalender kabisat benar; akhir kontrak kedua 28 Feb 2029 | Unit |
| TC-11 | Kontrak bulanan dengan sopir | Tarif bulanan sopir terhitung, seluruh periode terblokir | E2E |
| TC-12 | Ubah tarif/buffer setelah konfirmasi | Snapshot booking lama tetap, booking baru mengikuti settings | Integrasi |
| TC-13 | Invoice Rp1,1 juta; bayar Rp400 ribu; terima deposit Rp500 ribu | Piutang Rp700 ribu, saldo deposit Rp500 ribu, kas sewa Rp400 ribu | Unit + E2E |
| TC-14 | Pembayaran nol, negatif, pecahan rupiah, atau melebihi saldo | Ditolak; tidak ada CashEntry baru | Unit + UI |
| TC-15 | Refund deposit saat active atau melebihi saldo | Ditolak; saldo tidak berubah | Unit + E2E |
| TC-16 | Batalkan confirmed dengan pembayaran/deposit seperti TC-13 | Piutang nol, refund sewa Rp400 ribu tertunda, deposit Rp500 ribu tetap | Integrasi + E2E |
| TC-17 | Catat kedua refund TC-16 lalu coba refund lagi | Saldo nol, kas sewa neto seluruh rangkaian nol, refund tambahan ditolak | Unit + E2E |
| TC-18 | Batalkan active/completed; bayar invoice void | Seluruh tindakan ditolak | Integrasi |
| TC-19 | Check-out sebelum mulai, setelah akhir, pelanggan belum diverifikasi, atau deposit kurang | Ditolak dengan alasan sesuai kasus | E2E |
| TC-20 | Check-out piutang tersisa, deposit cukup, syarat lain valid | Peringatan; lanjut hanya setelah pengakuan staf | E2E |
| TC-21 | Mobil/sopir masih active pada booking sebelumnya | Check-out berikutnya ditolak meskipun jadwal reservasi tampak selesai | Integrasi |
| TC-22 | Booking active terlambat, coba konfirmasi baru | Mobil/sopir diblokir sampai check-in | Integrasi + E2E |
| TC-23 | Kembali 61 menit terlambat, tarif snapshot Rp50 ribu/jam | Biaya Rp100 ribu; invoice biaya akhir; buffer dimulai dari aktual kembali | Unit + E2E |
| TC-24 | Check-in odometer lebih kecil, BBM di luar 0–100, biaya tanpa alasan | Ditolak tanpa perubahan sebagian | Unit + UI |
| TC-25 | Check-in lebih awal atau dengan piutang | Completed, tanpa prorata; piutang tetap terlihat | E2E |
| TC-26 | Ubah mobil/sopir menjadi nonaktif atau arsip ketika confirmed/active | Ditolak; riwayat dan booking tetap utuh | Integrasi |
| TC-27 | Tambah tenant, coba kode sama, nonaktifkan lalu aktifkan lagi | Empty state benar, kode duplikat ditolak, data dipertahankan | E2E |
| TC-28 | Reload lalu reset; storage aplikasi lain memiliki key | Reload konsisten; reset hanya namespace demo dan meminta persetujuan | E2E |
| TC-29 | Storage ditolak/penuh; envelope rusak | Mode sementara diperingatkan; data rusak meminta pemulihan eksplisit | Integrasi + E2E |
| TC-30 | Filter kas periode berisi refund tanpa penerimaan | Kas sewa boleh negatif; deposit tak masuk; saldo saat ini tetap berlabel | Unit + E2E |
| TC-31 | Semua aksi inti pada 390, 768, dan 1440 piksel | Tidak ada konten/aksi penting terpotong; scroll tabel terlokalisasi | Browser visual |
| TC-32 | Tab/Shift+Tab, dialog, Escape, label, error, fokus | Navigasi keyboard masuk akal dan fokus kembali ke pemicu | Manual + otomatis |
| TC-33 | Navigasi detail langsung, refresh, back/forward, ID hilang | Halaman tepat atau state tidak ditemukan, tanpa crash | E2E |
| TC-34 | Maju jam demo melewati jatuh tempo; reload | Indikator overdue berubah benar dan waktu tetap tersimpan | Integrasi + E2E |
| TC-35 | Perusahaan baru tanpa mobil, filter tanpa hasil, form batal | Empty state/feedback sesuai dan tidak membuat data palsu | E2E |
| TC-36 | Cek semua relasi seed dan jalankan alur sambil memantau console | Tidak ada orphan/cross-tenant relation atau error aplikasi | Integrasi + browser |
| TC-37 | Jam demo 09.00; booking 09.15–09.45; maju ke 09.15 lalu coba mundur | Check-out pada 09.15 dapat dilakukan jika syarat lain valid; waktu mundur ditolak | E2E |

## 4. Naskah demo untuk UAT

1. Buka perusahaan A sebagai pemilik, periksa mobil/tarif dan buffer.
2. Beralih sebagai staf perusahaan A, buat pelanggan fiktif belum diverifikasi.
3. Buat booking harian 25 jam dengan sopir, tinjau harga sebelum konfirmasi.
4. Coba booking kedua yang bertabrakan; pastikan sistem menjelaskan konflik.
5. Catat DP dan deposit secara terpisah; lihat perubahan piutang/deposit.
6. Maju ke waktu mulai; coba check-out sebelum verifikasi lalu lengkapi verifikasi/checklist.
7. Maju waktu, lakukan pengembalian, lihat biaya akhir dan buffer aktual.
8. Lunasi tagihan dan catat pengembalian deposit; periksa laporan sebagai pemilik.
9. Buat kontrak bulanan dan periksa jadwal tagihan kalender.
10. Buat booking terpisah, catat pembayaran, batalkan, lalu catat refund.
11. Berpindah ke perusahaan B; pastikan data contoh A tidak muncul.
12. Tambah/nonaktifkan/aktifkan perusahaan melalui admin platform.
13. Ulangi tindakan inti di mobile, reload, lalu reset dengan konfirmasi.

Catat apakah penguji bisa menyelesaikan tugas, bagian yang membingungkan, kesalahan input, dan durasi booking. Jangan menyimpulkan peningkatan bisnis dari uji demo kecil.

## 5. Definition of Done demo

- Seluruh FR P0 memiliki implementasi yang bisa digunakan, bukan tombol tanpa hasil.
- Seluruh test matrix wajib lolos; temuan yang menghalangi operasi diselesaikan.
- Unit test aturan kalender, konflik, uang, dan transisi status lulus.
- Dev server dijalankan dan alur inti dicoba dalam browser, bukan hanya build/typecheck.
- Console diperiksa selama alur, tanpa error aplikasi yang belum diselesaikan.
- Layout diperiksa pada semua viewport target, termasuk dialog dan keadaan error.
- Navigasi keyboard, label, fokus, dan kontras diverifikasi; tidak mengklaim audit penuh jika belum dilakukan.
- Aplikasi portofolio tidak diubah atau mengalami regresi akibat penempatan demo.
- Tidak ada data pribadi asli, secret, payment gateway, atau klaim keamanan produksi.
- Batas demo, cara reset, dan jam simulasi dapat ditemukan di UI.
- Pengguna melakukan UAT dan menyetujui demo sebelum langkah produksi/deployment.

## 6. Setelah demo disetujui

Urutan kandidat berikut bukan cakupan yang sudah dijanjikan:

1. Validasi kebijakan dengan bisnis rental nyata dan tetapkan aturan operasional/finansial final.
2. Tentukan auth, keanggotaan tenant, backend/database, hosting, backup, dan pengujian keamanan.
3. Putuskan apakah portal pelanggan, payment gateway, multi-cabang, atau billing SaaS memberi manfaat terbesar.
4. Susun PRD produksi, migrasi dari data fiktif, anggaran, dan kriteria peluncuran yang baru.

Persetujuan dokumen demo tidak otomatis mengizinkan deployment, penggunaan data nyata, atau perubahan proyek portofolio.
