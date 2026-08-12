# belajarislam.online LMS v5.2.0

Full package LMS berbasis HTML/CSS/JavaScript + Firebase Authentication dan Realtime Database. Versi 5.2.0 merupakan **UI/UX overhaul penuh** yang diarahkan ke gaya LMS nasional: modern, fresh, islami, ringan, dan responsif di desktop maupun mobile.

## Identitas visual
- Nama: **belajarislam.online**
- Domain: `belajarislam.online`
- Palet: hijau emerald/teal, putih lembut, aksen emas
- Logo dan favicon presisi: ICO + PNG 16/32/48/64/128/180/192/256/512
- Dark mode tetap tersedia
- PWA/service worker dasar

## UI/UX v5.2.0
- Landing hero besar dengan visual islami modern dan panel daftar/masuk
- Header lebih ringkas dan premium
- Katalog kelas bergaya kartu modern
- Dashboard pelajar dengan sidebar desktop, hero personal, progres, lanjut belajar, aktivitas terbaru
- Mobile bottom navigation yang ringkas
- Live chat mobile tetap melalui tombol mengambang kanan bawah
- Ruang kelas dengan video besar, daftar materi di kanan (desktop), forum/kuis/pembayaran di bawah video
- Video full-width responsif di mobile tanpa scroll horizontal
- Admin Center bergaya dashboard operasional modern
- Semua layout menggunakan komponen konsisten: card, badge, form, table, modal, progress, chat bubble

## Modul Pelajar
- Registrasi mandiri dan login
- Katalog kelas gratis / berbayar
- Kelas Saya
- Video YouTube atau Google Drive
- Tracking progres YouTube + tombol tandai selesai
- Kuis pilihan ganda per video
- Forum diskusi khusus setiap video + reply thread
- Sertifikat setelah kelas selesai dan kuis wajib lulus
- Pembayaran transfer, copy rekening dan nominal, upload bukti
- Upload bukti transfer tanpa Firebase Storage: foto dikompres otomatis dan disimpan di Realtime Database
- Notifikasi pembayaran
- Live chat realtime dengan admin
- Profil peserta tersinkron ke admin

## Modul Admin/Pembimbing
- Dashboard statistik dan analitik pembelajaran
- Buat/edit/arsip kelas
- Tambah/edit/hapus video
- Kelas gratis/berbayar
- Verifikasi pembayaran + lihat bukti transfer saat diperlukan
- Kelola kuis per video
- Data pengguna + ubah role student/mentor/admin
- Live chat peserta
- Pengaturan rekening, WhatsApp admin, dan sertifikat

## Firebase
Konfigurasi project ada di `assets/js/firebase-config.js`.

Sebelum produksi:
1. Firebase Authentication > Sign-in method > aktifkan Email/Password.
2. Authentication > Settings > Authorized domains: tambahkan `belajarislam.online` dan `www.belajarislam.online` jika dipakai.
3. Realtime Database > Rules: ganti seluruh rules dengan `database.rules.json` lalu Publish.
4. Firebase Storage **tidak diperlukan** untuk bukti transfer pada paket ini.
5. Pastikan akun admin memiliki `users/{uid}/role = "admin"`.
6. Login admin lalu isi rekening, WhatsApp admin, dan identitas sertifikat di Pengaturan.

## Bukti transfer tanpa Storage
Foto dikompresi di browser menjadi JPEG ringan dan disimpan terpisah pada `paymentProofs/{paymentId}`. Bukti tidak ikut dimuat saat daftar transaksi dibuka; baru diambil saat admin menekan tombol lihat.

## Catatan video
YouTube memakai embed `youtube-nocookie.com`. Elemen tertentu dari YouTube masih dapat tampil sesuai kebijakan player YouTube. Google Drive memakai mode preview/embed.
