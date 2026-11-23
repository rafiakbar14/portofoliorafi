# Rancangan Alur, Layar, dan Data

Status: usulan pendamping [PRD](01-PRD.md), belum diimplementasikan.
Aturan bisnis BR-01 sampai BR-10 pada PRD adalah sumber kebenaran.

## 1. Peta aplikasi

```text
Masuk demo — pilih peran, bukan login
├── Pengelola platform
│   └── Perusahaan rental: daftar, tambah, aktif/nonaktif
└── Ruang kerja perusahaan
    ├── Dashboard
    ├── Jadwal
    ├── Penyewaan
    │   ├── Daftar dan filter
    │   ├── Buat booking
    │   └── Detail: ringkasan, serah-terima, tagihan, aktivitas
    ├── Armada
    ├── Pelanggan
    ├── Sopir
    ├── Keuangan: tagihan, pembayaran, deposit, refund
    ├── Laporan — pemilik
    └── Pengaturan — pemilik
```

Nama perusahaan aktif, peran simulasi, dan banner “Demo — gunakan data fiktif” berada pada kerangka aplikasi. Kontrol reset dan jam demo berada pada panel alat demo, bukan dianggap fitur operasional produksi.

## 2. Matriks akses

Tanda “ya” hanya berlaku untuk perusahaan aktif milik peran simulasi. Seluruh pembatasan di sini adalah perilaku demo, bukan kontrol keamanan nyata.

| Tindakan | Pengelola platform | Pemilik rental | Staf operasional |
| --- | --- | --- | --- |
| Daftar/tambah/aktifkan perusahaan | Ya | Tidak | Tidak |
| Lihat pelanggan dan transaksi rinci perusahaan | Tidak | Ya | Ya |
| Kelola armada, sopir, pelanggan | Tidak | Ya | Ya |
| Buat/konfirmasi/batalkan booking | Tidak | Ya | Ya |
| Check-out dan check-in | Tidak | Ya | Ya |
| Catat pembayaran, deposit, refund | Tidak | Ya | Ya |
| Laporan agregat perusahaan | Tidak | Ya | Tidak |
| Pengaturan tarif default dan kebijakan | Tidak | Ya | Tidak |
| Ubah tarif master mobil/sopir | Tidak | Ya | Tidak |
| Lihat ringkasan piutang terkait operasional | Tidak | Ya | Ya |

Staf boleh mengubah data nonharga armada/sopir. Saat menambah mobil/sopir, tarif diisi pemilik sebelum sumber daya bisa dipakai untuk basis tarif tersebut. Tarif yang belum disiapkan ditandai jelas, bukan dianggap nol atau gratis. Tarif sopir nol boleh disimpan oleh pemilik secara eksplisit jika memang menjadi kebijakan demo.

## 3. User journey

### A. Pengelola platform menyiapkan perusahaan

1. Masuk sebagai pengelola platform demo.
2. Lihat dua perusahaan contoh tanpa identitas pelanggan atau transaksi rinci.
3. Buat perusahaan dengan nama, kode unik, dan kontak fiktif opsional.
4. Sistem membuat ruang kerja kosong dengan pengaturan default serta pemilik dan staf simulasi.
5. Perusahaan baru muncul di pemilih ruang kerja pemilik/staf demo.
6. Penonaktifan memerlukan konfirmasi, menolak akses ruang kerja, dan mempertahankan data.
7. Pengaktifan kembali memulihkan akses demo tanpa membuat ulang data.

### B. Staf membuat booking harian lepas kunci

1. Pilih perusahaan dan buka Penyewaan → Buat booking.
2. Pilih pelanggan atau tambahkan pelanggan fiktif.
3. Pilih lepas kunci, tarif harian, serta waktu mulai dan selesai.
4. Sistem menampilkan mobil tersedia beserta tarif dan alasan mobil lain tidak tersedia.
5. Staf memilih mobil; sistem menghitung hari, total tagihan, dan deposit terpisah.
6. Simpan sebagai draft atau konfirmasi setelah meninjau ringkasan.
7. Saat konfirmasi, sistem memeriksa ulang konflik dan membuat tagihan beserta snapshot harga.
8. Staf dapat mencatat DP ke tagihan dan penerimaan deposit secara terpisah.
9. Jadwal, keuangan, dashboard, dan riwayat pelanggan mencerminkan booking yang sama.

Jika pelanggan belum diverifikasi, booking tetap boleh dibuat; check-out yang akan diblokir.

### C. Booking dengan sopir

Gunakan alur B, lalu pilih sopir aktif yang tersedia sepanjang periode. Tarif sopir mengikuti basis harian/bulanan yang dipilih. Konfirmasi ditolak bila sopir tidak ada, berbeda perusahaan, belum memiliki tarif yang diperlukan, atau memiliki jadwal bertabrakan.

### D. Kontrak bulanan

1. Pilih basis bulanan dan jenis layanan.
2. Pilih tanggal mulai dan jumlah bulan 1–12.
3. Sistem menghitung tanggal akhir serta batas tiap periode dari tanggal awal kontrak.
4. Tampilkan seluruh periode, nilai per bulan, total kontrak, dan deposit sebelum konfirmasi.
5. Konfirmasi membuat semua tagihan periodik sekaligus dengan jatuh tempo masing-masing.
6. Staf mencatat pembayaran pada tagihan yang dipilih; satu pembayaran tidak otomatis menyebar ke beberapa periode.
7. Piutang yang belum jatuh tempo dibedakan dari piutang lewat jatuh tempo.

Tidak ada scheduler atau penagihan jaringan di demo; seluruh jadwal sudah tersimpan sejak konfirmasi.

### E. Serah-terima kendaraan

1. Buka booking confirmed ketika waktu mulai tiba dan sebelum waktu akhir.
2. Sistem memeriksa mobil/sopir, sewa active lain, verifikasi pelanggan, dan deposit.
3. Isi odometer, level bahan bakar, kondisi bodi/interior, kelengkapan, dan catatan.
4. Jika sewa belum lunas, tampilkan nominal piutang dan minta pengakuan eksplisit staf.
5. Konfirmasi serah-terima menyimpan checklist dan waktu aktual sekaligus mengubah status menjadi active.
6. Klik ganda tidak boleh menghasilkan dua checklist atau dua transisi.

### F. Pengembalian kendaraan

1. Buka booking active dan pilih Kembalikan kendaraan.
2. Isi odometer akhir, bahan bakar, kondisi, serta kelengkapan kembali.
3. Sistem menampilkan waktu kembali aktual, selisih odometer, dan biaya keterlambatan jika ada.
4. Staf dapat menambahkan biaya kerusakan/BBM dengan nominal dan alasan.
5. Tampilkan ringkasan tagihan lama, biaya akhir, saldo deposit, dan tindakan refund terpisah.
6. Simpan pengembalian; booking menjadi completed dan tagihan tambahan dibuat bila total biaya akhir positif.
7. Mobil tetap diblokir sampai waktu kembali aktual + buffer snapshot booking.
8. Pelunasan dan pengembalian deposit dapat dicatat kemudian; keduanya tidak otomatis dianggap selesai.

### G. Pembatalan dan refund

1. Pilih booking draft/confirmed dan masukkan alasan pembatalan.
2. Tampilkan dampak pada jadwal, tagihan, pembayaran yang harus dikembalikan, dan deposit.
3. Konfirmasi mengubah status menjadi cancelled, melepaskan reservasi, dan mem-void tagihan.
4. Setiap pembayaran sewa pada tagihan void menjadi saldo refund yang belum diselesaikan.
5. Catat refund sewa dan refund deposit sebagai arus uang terpisah setelah benar-benar disimulasikan dikembalikan.
6. Refund melebihi saldo, bernilai nol/negatif, atau untuk booking yang tidak memenuhi syarat ditolak.

### H. Berpindah perusahaan

1. Jika ada perubahan formulir yang belum disimpan, minta konfirmasi sebelum meninggalkan halaman.
2. Bersihkan pencarian, filter, detail terbuka, dan pilihan entitas dari perusahaan lama.
3. Kembali ke dashboard perusahaan tujuan; jangan mempertahankan detail booking perusahaan asal.
4. URL/ID lintas perusahaan menampilkan “Data tidak ditemukan di perusahaan ini”.
5. Jika perusahaan nonaktif, tampilkan status nonaktif dan arahkan ke pemilih demo, tanpa memperlihatkan data operasional.

## 4. Siklus status

### Booking

```text
draft ──konfirmasi──> confirmed ──check-out──> active ──check-in──> completed
  │                       │
  └────batalkan───────────┴───────────────> cancelled
```

- Tidak ada transisi mundur atau penghapusan riwayat.
- Draft tidak memiliki tagihan maupun pembayaran dan tidak menahan mobil/sopir.
- Confirmed sudah memiliki snapshot tarif serta tagihan.
- Active tidak boleh dibatalkan; pengembalian lebih awal dilakukan melalui check-in.
- Completed tidak berarti semua tagihan sudah lunas atau deposit sudah dikembalikan.
- Cancelled tidak berarti uang sudah dikembalikan.
- “Terlambat kembali” adalah active dengan jam demo melewati jadwal akhir, bukan status booking baru.

### Tagihan

- open: pembayaran bersih nol, tagihan belum void.
- partial: pembayaran bersih lebih besar dari nol dan kurang dari total.
- paid: pembayaran bersih sama dengan total.
- void: tagihan dibatalkan; nilai terutang nol, tetapi penerimaan sebelumnya masih dapat menjadi kewajiban refund.
- overdue: indikator tambahan jika waktu saat ini melewati dueAt dan sisa tagihan positif.

Status open/partial/paid dan indikator overdue dihitung dari transaksi, bukan input manual. Void disimpan sebagai kejadian pembatalan.

### Status sumber daya

Mobil memiliki operationalStatus ready/maintenance/inactive. Sopir memiliki active/inactive. available/reserved/in_use/overdue adalah hasil perhitungan konteks waktu dan booking. Arsip mempertahankan riwayat dan menyembunyikan entitas dari pilihan booking baru.

## 5. Spesifikasi layar low-fidelity

Ini susunan informasi, bukan desain visual yang sudah disetujui.

| Layar | Isi utama | Aksi utama | State wajib |
| --- | --- | --- | --- |
| Masuk demo | Penjelasan demo, pemilih peran/perusahaan | Buka ruang kerja | Perusahaan nonaktif, belum ada perusahaan |
| Admin platform | Nama/kode perusahaan, status, jumlah mobil/booking agregat | Tambah, aktif/nonaktif | Daftar kosong, kode duplikat |
| Dashboard | Jadwal hari ini, terlambat kembali, piutang, ringkasan mobil | Buat booking, buka detail | Belum ada transaksi, tidak ada jadwal hari ini |
| Jadwal | Minggu aktif, baris kendaraan, blok booking/buffer | Ganti minggu, buka booking | Tak ada kendaraan, konflik jadwal |
| Penyewaan | Nomor, pelanggan, mobil, layanan, periode, status, sisa tagihan | Cari/filter, buat, buka detail | Pencarian kosong, ID tidak ditemukan |
| Form booking | Pelanggan → layanan/periode → mobil/sopir → ringkasan | Simpan draft, konfirmasi | Jadwal invalid, konflik, tarif belum diatur |
| Detail booking | Status, jadwal, snapshot tarif, checklists, tagihan, aktivitas | Aksi sesuai status | Piutang, refund tertunda, keterlambatan |
| Armada | Pelat, model, tarif, status operasional, ketersediaan | Tambah/edit/arsip | Pelat duplikat, perubahan status terblokir |
| Pelanggan | Nama, kontak fiktif, verifikasi, riwayat | Tambah/edit/arsip | Belum diverifikasi, tanpa riwayat |
| Sopir | Nama, tarif, status, penugasan | Tambah/edit/arsip | Konflik, tarif belum diatur |
| Keuangan | Tagihan, pembayaran, saldo deposit, kewajiban refund | Catat pembayaran/refund | Lunas, void, nominal melebihi saldo |
| Laporan | Filter periode, kas sewa bersih, piutang, deposit, jumlah sewa | Terapkan filter | Periode tanpa transaksi |
| Pengaturan | Profil, buffer, deposit default, tarif terlambat | Simpan | Input invalid, perubahan belum disimpan |

### Kerangka desktop

```text
[Banner demo + kontrol peran/perusahaan]
[Sidebar] [Nama perusahaan | judul halaman | aksi utama]
          [Peringatan yang memerlukan tindakan]
          [Filter dan ringkasan seperlunya]
          [Tabel / kalender / formulir / detail]
```

### Prinsip mobile

- Navigasi menjadi drawer; prioritas konten dan istilah tetap sama.
- Ringkasan dan formulir mengikuti lebar layar, tanpa teks atau input terpotong.
- Kalender/tabel boleh digeser dalam kontainernya; halaman tidak ikut melebar.
- Aksi utama tetap dapat ditemukan tanpa hover.
- Dialog panjang dapat digulir dan tidak menutup tombol konfirmasi secara permanen.

## 6. Model data konseptual

Ini kontrak data untuk perencanaan, bukan skema database produksi atau kode implementasi.

Seluruh entitas operasional memiliki id, tenantId, createdAt, dan updatedAt. Nilai nominal disimpan sebagai integer IDR. Waktu disimpan sebagai ISO UTC dan ditampilkan/dihitung kalender dalam Asia/Jakarta. Local date input harus dikonversi eksplisit, bukan mengikuti zona waktu mesin.

| Entitas | Field penting | Relasi dan batas |
| --- | --- | --- |
| Tenant | id, code, name, status, fictitiousContact | Code unik global; active/inactive |
| DemoActor | id, displayName, role, tenantId opsional | Simulasi pemilik/staf; platform admin tidak memiliki tenantId |
| TenantSettings | tenantId, currency, timezone, vehicleBufferMinutes, defaultDeposit, lateFeePerHour | Satu per tenant; IDR dan Asia/Jakarta tetap untuk demo |
| Vehicle | plate, make, model, category, transmission, dailyRate, monthlyRate, operationalStatus, archivedAt | Pelat unik per tenant setelah normalisasi spasi/huruf; tarif dapat null sebelum diatur |
| Customer | name, fictitiousPhone, verificationStatus, verificationNote, archivedAt | Tidak menyimpan nomor/foto KTP atau SIM |
| Driver | name, fictitiousPhone, dailyRate, monthlyRate, status, archivedAt | Tarif dapat null; satu driver dapat punya banyak booking yang tidak tumpang tindih |
| Booking | number, customerId, vehicleId, driverId, serviceMode, billingBasis, startAt, endAt, months, status, pricingSnapshot, confirmedAt, cancelledAt, cancellationReason | Satu kendaraan, satu pelanggan, driverId wajib hanya untuk chauffeur |
| Invoice | number, bookingId, kind, periodStart, periodEnd, dueAt, lines, total, voidedAt | kind rental/final_charges; satu per periode atau satu tagihan harian |
| CashEntry | bookingId, invoiceId opsional, kind, amount, method, reference, occurredAt, actorId | kind rental_payment/rental_refund/deposit_received/deposit_refund |
| Handover | bookingId, direction, actualAt, odometer, fuelPercent, bodyCondition, interiorCondition, equipmentChecks, notes, actorId | direction out/in; unik per booking dan arah |
| Activity | entityType, entityId, action, actorId, occurredAt, summary | Log lokal penambahan/perubahan penting, bukan audit server |

### Snapshot harga booking

Disimpan saat konfirmasi: vehicleRate, driverRate, billingBasis, quantity, rentalTotal, depositRequired, lateFeePerHour, vehicleBufferMinutes. Draft memakai harga terkini dan menampilkan perubahan sebelum konfirmasi. Tarif tidak boleh null saat dikonfirmasi; tarif kendaraan harus positif, tarif sopir boleh nol bila disimpan eksplisit oleh pemilik.

### Baris tagihan

Setiap baris memiliki label, quantity, unitAmount, amount, dan kategori rental/driver/late/damage/fuel. amount = quantity × unitAmount; invoice.total adalah jumlah seluruh baris. Tagihan sewa selalu positif. Tagihan final_charges hanya diterbitkan jika total biaya akhir positif.

### Relasi inti

```text
Tenant
├── TenantSettings
├── DemoActor
├── Vehicle ──────────┐
├── Customer ─────────┼── Booking
├── Driver ───────────┘   ├── Invoice ── CashEntry (uang sewa)
│                         ├── CashEntry (deposit)
│                         └── Handover (keluar, kembali)
└── Activity
```

Referensi entitas harus cocok tenantId-nya. Tidak cukup hanya memfilter daftar; validasi wajib dilakukan kembali saat menyimpan tindakan.

## 7. Invarian data dan perhitungan

1. Nomor booking/tagihan unik dalam perusahaan; ID internal unik dalam seluruh dataset demo.
2. startAt < endAt; untuk bulanan, endAt harus sama dengan hasil kalender dari startAt dan months.
3. Dua interval [a, b) dan [c, d) bertabrakan jika a < d dan c < b.
4. Untuk mobil, b/d memasukkan buffer snapshot masing-masing booking. Untuk kandidat baru, gunakan buffer pengaturan saat konfirmasi.
5. Check-in membuat interval blokir aktual [actualOut, actualIn + buffer) bagi mobil dan [actualOut, actualIn) bagi sopir. Blokir sisa buffer tetap diperiksa meskipun booking completed.
6. Booking active yang sudah melewati endAt memblokir konfirmasi baru atas mobil dan sopir terkait sampai check-in. Booking confirmed berikutnya yang sudah ada diberi peringatan konflik aktual, bukan diam-diam digeser.
7. Check-out memeriksa buffer aktual dari pengembalian sebelumnya dan memastikan mobil/sopir tidak sedang active di booking lain.
8. Semua entitas terkait harus aktif/tidak diarsipkan saat konfirmasi. Pengarsipan pelanggan/mobil/sopir yang masih terkait confirmed/active ditolak.
9. Pembayaran, refund, dan perubahan status menghasilkan Activity tetapi tidak dapat diedit/hapus lewat UI demo.
10. Pembatalan confirmed beserta void seluruh invoice dilakukan dalam satu perubahan state.
11. Check-in beserta pembuatan tagihan biaya akhir dilakukan dalam satu perubahan state.
12. Klik ulang konfirmasi/check-in pada status yang sudah berubah tidak membuat tagihan ganda.

### Definisi angka di dashboard/laporan

- Pembayaran bersih tagihan = rental_payment − rental_refund yang terkait tagihan itu.
- Sisa tagihan non-void = total − pembayaran bersih. Untuk void, sisa tagihan selalu nol.
- Piutang total = jumlah sisa semua tagihan non-void, termasuk periode bulanan yang belum jatuh tempo; tampilkan bagian belum jatuh tempo dan lewat jatuh tempo terpisah.
- Kewajiban refund sewa = penerimaan bersih yang masih tersisa pada tagihan void.
- Saldo deposit dipegang = deposit_received − deposit_refund, tidak boleh negatif dan tidak boleh melebihi depositRequired saat penerimaan.
- Kas sewa bersih suatu periode = rental_payment − rental_refund berdasarkan occurredAt dalam periode itu; dapat negatif dan bukan laba atau pengakuan pendapatan akuntansi.
- Deposit tidak masuk kas sewa bersih, piutang sewa, atau nilai kontrak.
- Jumlah sewa mulai suatu periode = jumlah Handover out dengan actualAt dalam periode tersebut.
- Piutang, saldo deposit, dan refund tertunda adalah snapshot saat ini; filter tanggal laporan hanya memengaruhi arus kas dan jumlah sewa, bukan merekonstruksi saldo historis.

### Contoh hitungan dummy

Mobil Rp350.000/hari, sopir Rp200.000/hari, durasi 25 jam, deposit Rp500.000:

- Kuantitas = 2 hari.
- Tagihan sewa = 2 × (Rp350.000 + Rp200.000) = Rp1.100.000.
- Pembayaran sewa Rp400.000 menghasilkan piutang Rp700.000.
- Deposit diterima Rp500.000 menghasilkan saldo deposit Rp500.000, tanpa mengubah piutang.
- Pembatalan membuat tagihan void, piutang nol, refund sewa tertunda Rp400.000, dan deposit yang perlu dikembalikan Rp500.000.
- Setelah kedua refund dicatat, kas sewa bersih untuk seluruh rangkaian nol dan saldo deposit nol.

Kontrak dua bulan mulai 31 Januari 2027 pukul 09.00 WIB, mobil Rp6.000.000/bulan, tanpa sopir:

- Periode 1: 31 Januari–28 Februari, Rp6.000.000, jatuh tempo 31 Januari.
- Periode 2: 28 Februari–31 Maret, Rp6.000.000, jatuh tempo 28 Februari.
- Total kontrak Rp12.000.000; akhir kontrak 31 Maret pukul 09.00 WIB.

## 8. Kasus batas yang tidak boleh disembunyikan

- Mobil baru tanpa tarif tidak muncul sebagai mobil gratis.
- Waktu sama persis di batas akhir diperbolehkan hanya jika buffer kendaraan sudah habis.
- Draft dua staf dapat tampak memilih mobil sama; demo memeriksa ulang saat konfirmasi, tetapi tidak menjanjikan penguncian lintas browser.
- Pelanggan yang diarsipkan tetap terlihat di riwayat transaksi lama.
- Kontrak berakhir pada tahun kabisat memakai kalender yang benar.
- Booking confirmed yang seluruh waktunya sudah lewat tidak boleh di-check-out; harus dibatalkan dan dibuat ulang.
- Mengganti perusahaan tidak boleh membawa formulir atau pilihan pelanggan dari perusahaan sebelumnya.
- Tidak boleh menambah pembayaran ke invoice void atau menerima deposit pada draft/cancelled/completed.
- Refund deposit tidak tersedia saat sewa active; tidak tersedia untuk jumlah melebihi saldo.
