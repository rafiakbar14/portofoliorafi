# PRD — Aplikasi Manajemen Rental Mobil SaaS

Versi: 0.1 — draft untuk persetujuan, bukan izin implementasi.
Tanggal: 13 November 2026.
Nama produk: belum ditentukan; “Rental Mobil SaaS” adalah nama kerja.

## 1. Ringkasan produk

Aplikasi membantu beberapa bisnis rental mengelola armada, pelanggan, sopir, penyewaan, serah-terima, dan pencatatan pembayaran di satu platform. Setiap bisnis memiliki ruang kerja sendiri.

Versi pertama adalah demo interaktif menggunakan data fiktif. Tujuannya memvalidasi alur operasional dan pengalaman pengguna, bukan menerima pelanggan atau transaksi sungguhan.

### Keputusan dari pengguna

- Produk melayani banyak bisnis rental, bukan satu perusahaan saja.
- Mendukung lepas kunci, dengan sopir, dan kontrak bulanan.
- Target pertama adalah demo/prototipe.
- Pekerjaan ditempatkan dalam folder baru, tanpa mengganti portofolio yang ada.
- PRD dan dokumen pendukung dibuat sebelum aplikasi.

### Usulan yang belum disetujui

| Topik | Usulan awal | Alasan |
| --- | --- | --- |
| Pengguna aplikasi | Pengelola platform, pemilik rental, staf operasional | Memvalidasi SaaS dan operasional sebelum menambah portal pelanggan |
| Kanal | Aplikasi web responsif, desktop-first untuk pekerjaan padat data | Dapat dicoba melalui browser tanpa instalasi |
| Wilayah | Bahasa Indonesia, rupiah, zona waktu Asia/Jakarta | Batas demo yang mudah dievaluasi; bukan dukungan semua zona Indonesia |
| Struktur bisnis | Satu cabang per perusahaan untuk demo | Memisahkan konsep multi-perusahaan dari multi-cabang |
| Pembayaran | Pencatatan manual tunai/transfer | Tidak memerlukan rekening atau payment gateway |
| Identitas pelanggan | Nama fiktif, nomor simulasi, status pemeriksaan dokumen | Tidak memerlukan KTP, SIM, atau data pribadi asli |
| Desain | Dashboard operasional yang jelas, bukan landing page promosi | Fokus pada pencarian, ketersediaan, dan tindakan staf |

Seluruh kebijakan tarif, deposit, pembatalan, dan keterlambatan di dokumen ini adalah usulan demo. Ini bukan kebijakan bisnis yang telah dikonfirmasi atau nasihat hukum/akuntansi.

## 2. Masalah yang ingin diselesaikan

Hipotesis yang perlu divalidasi bersama calon pengguna:

1. Jadwal yang tersebar di chat atau spreadsheet menyulitkan pengecekan ketersediaan.
2. Status kendaraan dan penugasan sopir dapat tidak sinkron dengan booking.
3. Uang sewa, uang jaminan, dan piutang berpotensi tercampur.
4. Kondisi kendaraan saat keluar dan kembali tidak selalu tercatat konsisten.
5. Pemilik sulit melihat kegiatan rental tanpa meminta rekap manual.

Demo harus memperlihatkan apakah alur terpadu membantu masalah tersebut; dokumen ini tidak mengklaim sudah ada riset pengguna atau hasil penghematan terukur.

## 3. Tujuan dan ukuran keberhasilan

### Tujuan produk

- Pemilik dapat melihat aktivitas dan kewajiban keuangan per perusahaan.
- Staf dapat menyelesaikan booking sampai pengembalian tanpa berpindah sistem.
- Booking kendaraan dan sopir yang bertabrakan ditolak.
- Penyewaan bulanan memiliki periode dan tagihan yang jelas.
- Konteks perusahaan aktif selalu terlihat.

### Target validasi demo

| Area | Target penerimaan, bukan hasil pengujian |
| --- | --- |
| Alur inti | Seluruh skenario wajib dalam dokumen 04 lolos |
| Booking | Penguji dapat membuat booking harian dalam paling lama 3 menit setelah pengenalan singkat |
| Konflik | Semua kasus konflik kendaraan/sopir dalam test matrix ditolak |
| Pemisahan perusahaan | Data perusahaan lain tidak muncul dalam tampilan, pencarian, maupun navigasi demo |
| Finansial | Total tagihan, pembayaran, piutang, deposit, dan refund sesuai contoh hitungan |
| Perangkat | Tindakan inti bisa digunakan pada lebar 390, 768, dan 1440 piksel |
| Kejujuran demo | Banner demo terlihat dan tidak ada klaim login, pembayaran, atau keamanan produksi |

Uji kegunaan awal diusulkan bersama 3–5 calon pengguna. Jumlah tersebut bukan ukuran validasi pasar secara statistik.

## 4. Persona dan batas peran

| Peran | Kebutuhan | Hak demo |
| --- | --- | --- |
| Pengelola platform | Melihat perusahaan yang menggunakan SaaS | Melihat ringkasan perusahaan, membuat perusahaan demo, mengganti status aktif/nonaktif |
| Pemilik rental | Memantau operasional dan uang masuk | Seluruh data perusahaan sendiri, laporan, pengaturan tarif/deposit/buffer |
| Staf operasional | Menangani kegiatan harian | Armada, pelanggan, sopir, booking, serah-terima, pencatatan pembayaran/refund |
| Sopir | Sumber daya yang dijadwalkan | Dicatat sebagai data; belum memiliki akun atau aplikasi sendiri |
| Pelanggan penyewa | Pihak yang menyewa kendaraan | Dicatat oleh staf; belum memiliki portal atau akun |

Pemilihan peran dan perusahaan adalah simulasi demo, bukan login. Pengelola platform tidak otomatis dapat membaca identitas pelanggan dan transaksi rinci perusahaan. Perpindahan perusahaan di kontrol demo berbeda dari fitur produksi untuk pengguna yang benar-benar menjadi anggota beberapa perusahaan.

## 5. Cakupan versi pertama

P0 = wajib agar demo dinyatakan lengkap. P1 = tambahan setelah alur inti stabil dan disetujui. Di luar demo = tidak dibangun pada tahap ini.

| ID | Modul | Kebutuhan | Prioritas |
| --- | --- | --- | --- |
| FR-01 | Konteks SaaS | Pemilih perusahaan/peran demo, nama perusahaan aktif, pembatasan tampilan per perusahaan | P0 |
| FR-02 | Admin platform | Daftar perusahaan, tambah perusahaan demo, aktif/nonaktif; tanpa tagihan langganan SaaS | P0 |
| FR-03 | Dashboard | Kendaraan sedang disewa, jadwal keluar/kembali, booking, piutang jatuh tempo, kas sewa bersih | P0 |
| FR-04 | Armada | Tambah/edit/arsip mobil, pelat, kategori, transmisi, tarif harian/bulanan, status operasional | P0 |
| FR-05 | Ketersediaan | Kalender mingguan dan daftar jadwal; filter kendaraan/tanggal; cek konflik | P0 |
| FR-06 | Pelanggan | Tambah/edit/arsip pelanggan fiktif, status verifikasi, riwayat penyewaan | P0 |
| FR-07 | Sopir | Tambah/edit/arsip sopir, tarif harian/bulanan, status aktif, konflik penugasan | P0 |
| FR-08 | Booking | Lepas kunci/dengan sopir; tarif harian/bulanan; harga tersimpan saat konfirmasi | P0 |
| FR-09 | Siklus sewa | Draft, confirmed, active, completed, cancelled; pembatalan sebelum serah-terima | P0 |
| FR-10 | Serah-terima | Checklist, odometer, bahan bakar, catatan kerusakan, verifikasi pelanggan | P0 |
| FR-11 | Tagihan & uang | Tagihan sewa, pembayaran parsial, deposit terpisah, refund terkontrol | P0 |
| FR-12 | Kontrak bulanan | Durasi 1–12 bulan, tanggal akhir kalender, tagihan per periode bulanan | P0 |
| FR-13 | Laporan dasar | Kas sewa bersih, piutang, saldo deposit, jumlah sewa; filter periode | P0 |
| FR-14 | Pengaturan | Profil perusahaan, buffer kendaraan, deposit default, tarif keterlambatan | P0 |
| FR-15 | Ketahanan demo | Data tersimpan lokal, reset dengan konfirmasi, empty/error/success state | P0 |
| FR-16 | Aktivitas | Riwayat tindakan penting dan pelaku simulasi dalam perusahaan aktif | P0 |
| FR-17 | Keluaran tambahan | Ekspor CSV, cetak invoice, tampilan kalender bulanan | P1 |

### Di luar demo

- Autentikasi nyata, undangan anggota, MFA, reset kata sandi, dan otorisasi server.
- Payment gateway, pembayaran kartu, verifikasi transfer bank, serta penarikan dana.
- Billing langganan SaaS; kontrak rental bulanan berbeda dari langganan platform.
- Portal booking pelanggan, aplikasi sopir, pelacakan GPS, dan telematika.
- WhatsApp/email/SMS otomatis, unggahan KTP/SIM/foto pelanggan.
- Banyak cabang, perpindahan kendaraan antarcabang, dan marketplace antar-rental.
- Jadwal servis terperinci, biaya perawatan, laba/rugi akuntansi, pajak, e-Faktur.
- Pergantian mobil/sopir di tengah kontrak, perpanjangan aktif, prorata, paket kilometer.
- E-signature, perjanjian hukum final, penanganan klaim asuransi, dan penagihan otomatis.

Status kendaraan “maintenance” tetap ada sebagai blokir operasional sederhana, bukan modul bengkel.

## 6. Aturan bisnis usulan

### BR-01 — Pemisahan perusahaan

Semua data operasional memiliki tenantId. Setiap pembacaan/perubahan melalui konteks perusahaan aktif. Relasi booking dengan mobil, pelanggan, dan sopir harus berasal dari perusahaan yang sama. ID dari URL tidak boleh membuka data perusahaan lain.

Demo hanya membuktikan perilaku tampilan dan logika aplikasi. Semua data dummy tetap dapat diperiksa melalui browser; ini bukan isolasi keamanan produksi.

### BR-02 — Jenis layanan dan tarif

Jenis layanan adalah lepas kunci atau dengan sopir. Basis tarif adalah harian atau bulanan. Dengan demikian ada empat kombinasi yang sah, termasuk kontrak bulanan dengan sopir.

Untuk demo, satu mobil dan maksimal satu sopir terikat pada satu booking sepanjang periode. Kontrak bulanan dengan sopir memblokir sopir selama periode penuh; jadwal shift dan hari libur belum dimodelkan.

### BR-03 — Jadwal dan konflik

- Semua waktu ditampilkan sebagai WIB dan dihitung dalam Asia/Jakarta.
- Akhir harus sesudah awal. Booking baru yang akan dikonfirmasi tidak boleh mulai di masa lalu.
- Interval sewa adalah [mulai, selesai): awal termasuk, akhir tidak termasuk.
- Mobil diblokir sampai waktu selesai ditambah buffer pembersihan; usulan default 2 jam.
- Sopir diblokir selama interval sewa, tanpa buffer pembersihan mobil.
- Booking confirmed dan active memblokir sumber daya; draft dan cancelled tidak.
- Booking active yang belum kembali tetap menghalangi serah-terima booking berikutnya meskipun jadwalnya sudah lewat. Jika terlambat, booking baru untuk mobil itu tidak boleh dikonfirmasi sebelum pengembalian dicatat.
- Pengembalian mempertahankan blokir mobil sampai waktu kembali aktual ditambah buffer. Sopir bebas setelah waktu kembali aktual.
- Status operasional maintenance/inactive menolak konfirmasi dan serah-terima.
- Perubahan mobil/sopir menjadi tidak aktif atau pengarsipan ditolak ketika masih terikat booking confirmed/active. Staf harus membatalkan booking mendatang terlebih dahulu; penggantian sumber daya belum tersedia.

### BR-04 — Tarif harian

Jumlah hari = maksimum 1, pembulatan ke atas durasi jam / 24. Durasi 25 jam berarti 2 hari.

Subtotal = jumlah hari × (tarif mobil harian + tarif sopir harian jika dipilih). Tidak ada diskon, pajak, atau biaya antar otomatis pada demo. Satu tagihan diterbitkan saat konfirmasi dan jatuh tempo saat mulai sewa.

### BR-05 — Tarif bulanan

- Pengguna memilih tanggal mulai dan jumlah bulan 1–12, bukan mengubah tarif harian menjadi 30 hari.
- Batas setiap periode dihitung dari tanggal awal kontrak ditambah N bulan kalender.
- Jika tanggal tidak ada pada bulan tujuan, gunakan tanggal terakhir bulan itu; jam tetap sama.
- Contoh: 31 Januari → 28 Februari → 31 Maret pada tahun nonkabisat.
- Seluruh jadwal tagihan dibuat saat konfirmasi. Tiap periode memiliki satu tagihan, jatuh tempo pada awal periode tersebut.
- Total kontrak = jumlah bulan × (tarif mobil bulanan + tarif sopir bulanan jika dipilih).
- Belum ada prorata, perubahan harga di tengah kontrak, atau perpanjangan otomatis.

### BR-06 — Pembayaran dan deposit

- Nominal berupa bilangan bulat rupiah positif; pembayaran sewa tidak boleh melebihi sisa tagihan.
- Pembayaran parsial/DP dialokasikan ke satu tagihan, bukan ke saldo pelanggan umum.
- Deposit/jaminan dicatat terpisah, tidak mengurangi tagihan dan tidak dihitung sebagai kas sewa.
- Deposit wajib saat serah-terima hanya sebesar jumlah yang disetujui pada booking; nilai default dapat nol.
- Sewa boleh berjalan dengan piutang setelah staf mengakui peringatan; tidak ada persentase DP minimum tersembunyi.
- Pengembalian boleh diselesaikan meskipun tagihan belum lunas, dengan piutang tetap terlihat.
- Semua pembayaran diberi label “dicatat manual”; tidak ada klaim terverifikasi oleh bank.

### BR-07 — Perubahan dan pembatalan

Draft dapat diedit atau dibatalkan. Untuk demo, simpan draft membutuhkan isian pelanggan, mobil, layanan, periode, dan sopir jika diperlukan; draft bukan penyimpanan otomatis formulir yang belum lengkap dan tidak menjamin ketersediaan sumber daya. Konfirmasi mengunci kendaraan, pelanggan, sopir, jadwal, tarif, dan deposit agar riwayat/tagihan tetap konsisten. Kesalahan pada booking confirmed ditangani dengan pembatalan dan booking baru.

Pembatalan hanya untuk draft/confirmed, bukan sewa active/completed. Usulan demo: tanpa denda pembatalan. Tagihan booking yang dibatalkan menjadi void. Pembayaran yang sudah masuk menjadi kewajiban refund dan tidak otomatis dianggap telah dikembalikan. Staf mencatat refund aktual secara manual.

Deposit dapat dikembalikan setelah booking cancelled/completed, maksimal saldo deposit yang dipegang. Refund uang sewa hanya tersedia untuk tagihan void akibat pembatalan, maksimal penerimaan bersih pada tagihan tersebut. Tidak ada pemotongan deposit otomatis untuk kerusakan.

### BR-08 — Serah-terima dan pengembalian

Check-out mensyaratkan booking confirmed, waktu mulai telah tiba dan waktu akhir belum lewat, kendaraan operasional, tidak ada sewa active lain, pelanggan berstatus terverifikasi, checklist wajib lengkap, deposit mencukupi, serta sopir tersedia bila diperlukan.

Check-in mensyaratkan booking active, odometer tidak menurun, bahan bakar valid, dan checklist pengembalian lengkap. Waktu aktual menggunakan jam demo, bukan input bebas mundur.

Keterlambatan dihitung setelah waktu akhir kontrak, tanpa grace period tersembunyi. Biaya = pembulatan ke atas jam terlambat × tarif keterlambatan per jam yang tersimpan pada booking. Default tarif nol sampai pemilik menetapkan kebijakan. Biaya kerusakan/BBM tambahan dicatat sebagai baris manual dengan alasan; jika ada biaya akhir, terbitkan tagihan tambahan jatuh tempo saat pengembalian.

Pengembalian lebih awal tidak mengubah tagihan kontrak dan tidak menghasilkan refund otomatis. Ini perlu persetujuan bisnis sebelum dipakai di produksi.

### BR-09 — Status bukan satu kolom serbaguna

Status operasional mobil: ready, maintenance, inactive. Label tersedia/dipesan/disewa/terlambat diturunkan dari jadwal dan waktu, bukan diedit manual sebagai pengganti booking.

Status pembayaran terpisah dari status booking: open, partial, paid, void. “Jatuh tempo lewat” adalah indikator turunan dari saldo dan waktu, bukan perpindahan status manual.

### BR-10 — Pengaturan dan riwayat

Perubahan tarif, deposit, buffer, atau tarif keterlambatan hanya memengaruhi booking yang dikonfirmasi setelah perubahan. Booking confirmed menyimpan snapshot nilainya. Data yang pernah dipakai transaksi diarsipkan, bukan dihapus permanen. Checklist dan nominal yang sudah dicatat tidak dihapus diam-diam.

## 7. Kebutuhan nonfungsional

- Tombol dan formulir dapat dipakai dengan keyboard; label, error, dan fokus terlihat.
- Status tidak disampaikan melalui warna saja; setiap status memiliki teks.
- Tidak ada scroll horizontal pada seluruh halaman; tabel boleh memiliki area scroll sendiri.
- Semua aksi P0 benar-benar mengubah state, bukan hanya menampilkan toast palsu.
- Perubahan entitas terkait diterapkan bersama atau dibatalkan seluruhnya jika validasi gagal.
- Saat penyimpanan lokal gagal, tampilkan peringatan bahwa perubahan hanya bertahan selama sesi.
- Tidak menggunakan data pribadi, kredensial, pembayaran, atau dokumen identitas asli.
- Satu tab/browser adalah batas penggunaan demo; sinkronisasi lintas pengguna belum dijanjikan.

## 8. Batas kesiapan produksi

Produksi membutuhkan backend dengan autentikasi, otorisasi berbasis keanggotaan, isolasi tenant di database, transaksi atomik, pencegahan booking bersamaan, audit yang tidak bisa dimodifikasi dari klien, backup/restore, dan kebijakan data pribadi.

Invoice demo bukan dokumen fiskal resmi. Penonaktifan perusahaan demo hanya menyembunyikan akses dalam simulasi dan tidak menguji pencabutan sesi server.

## 9. Risiko dan keputusan terbuka

| Risiko/keputusan | Dampak | Tindakan sebelum implementasi/produksi |
| --- | --- | --- |
| Banyak modul sekaligus | Demo lebar tetapi dangkal | Selesaikan satu alur end-to-end sebelum menambah variasi |
| Kebijakan belum berasal dari rental nyata | Perhitungan bisa tidak sesuai operasional | Setujui BR-03 sampai BR-08 sebelum implementasi |
| Kontrak bulanan dengan sopir | Pemblokiran penuh bisa tidak sesuai shift nyata | Terima penyederhanaan demo atau revisi model penugasan |
| Browser menyimpan seluruh data dummy | Tidak aman untuk data sungguhan | Banner tetap terlihat dan larang penggunaan operasional |
| Nama dan arah visual belum dipilih | Bisa terjadi revisi tampilan | Setujui wireframe sebelum UI lengkap |
| Portal pelanggan tidak masuk demo | Ekspektasi SaaS bisa berbeda | Konfirmasi bahwa fokus awal memang pengelola rental |

## 10. Gerbang persetujuan

Sebelum menulis kode aplikasi, pengguna perlu menyetujui atau merevisi:

1. Fokus dashboard internal multi-perusahaan, tanpa portal pelanggan pada demo.
2. Aturan tarif harian 24 jam, kalender bulanan, buffer 2 jam, deposit, dan pembatalan.
3. Satu cabang per perusahaan dan satu sopir per kontrak sebagai batas demo.
4. Pendekatan data dummy lokal, bukan backend produksi.
5. Rancangan layar dan urutan implementasi pada dokumen pendukung.

Dokumen terkait:
- [Alur, layar, dan model data](02-ALUR-DAN-DATA.md).
- [Spesifikasi prototipe](03-SPESIFIKASI-PROTOTIPE.md).
- [Backlog dan rencana pengujian](04-BACKLOG-DAN-PENGUJIAN.md).
