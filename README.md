# belajarislam.online LMS v5.1.0

Paket penuh LMS berbasis HTML/CSS/JavaScript + Firebase Authentication, Realtime Database, dan Storage. Tidak membutuhkan proses build.

## Identitas
- Nama: **belajarislam.online**
- Domain: `belajarislam.online`
- UI: emerald/teal + aksen emas, responsive desktop/mobile, dark mode
- Logo/app icon sudah termasuk dalam `assets/img/`

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
- Notifikasi pembayaran
- Live chat realtime dengan admin
- Profil peserta tersinkron ke admin
- Dark mode
- PWA/service worker dasar

## Modul Admin/Pembimbing
- Dashboard statistik dan analitik pembelajaran
- Buat/edit/arsip kelas
- Tambah/edit/hapus video
- Kelas gratis/berbayar
- Verifikasi pembayaran
- Kelola kuis per video
- Data pengguna + ubah role student/mentor/admin
- Live chat peserta
- Pengaturan rekening, WhatsApp admin, dan sertifikat

## Struktur penting
- `index.html` — landing, login, daftar, katalog publik
- `pages/dashboard.html` — dashboard pelajar
- `pages/class.html` — ruang belajar video, kuis, forum, pembayaran
- `pages/admin.html` — panel admin/pembimbing
- `pages/certificate.html` — sertifikat
- `database.rules.json` — Realtime Database Rules
- `storage.rules` — Storage Rules
- `CNAME` — custom domain GitHub Pages

## Firebase
Konfigurasi project yang sudah digunakan ada di `assets/js/firebase-config.js`.

Sebelum produksi:
1. Firebase Authentication > Sign-in method > aktifkan Email/Password.
2. Authentication > Settings > Authorized domains: tambahkan `belajarislam.online` dan `www.belajarislam.online` jika dipakai.
3. Realtime Database > Rules: ganti seluruh rules dengan `database.rules.json` lalu Publish.
4. Firebase Storage > Rules: ganti dengan `storage.rules` lalu Publish.
5. Pastikan akun admin lama memiliki `users/{uid}/role = "admin"`.
6. Admin masuk lalu isi rekening dan WhatsApp admin pada Pengaturan.

## Catatan video
YouTube diputar melalui `youtube-nocookie.com` dengan embed yang lebih bersih. YouTube tetap dapat menampilkan elemen platform tertentu karena batasan player YouTube. Google Drive memakai mode preview/embed; pembatasan download tetap bergantung pada pengaturan file Google Drive.

## Upgrade dari v4/v5
Struktur data utama tetap memakai path lama (`users`, `classes`, `videos`, `enrollments`, `payments`, `liveChats`, `notifications`), sehingga data lama dapat dilanjutkan. v5.1 menambahkan `lessonProgress`, `quizzes`, `quizResults`, `certificates`, dan `activities`.
