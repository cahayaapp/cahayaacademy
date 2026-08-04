# IZZUDDIN ACADEMY LMS — v2.0.0

Learning Management System berbasis Firebase Authentication, Firebase Realtime Database, dan YouTube Embed.

## Pembaruan utama

- Identitas aplikasi sepenuhnya diubah menjadi **Izzuddin Academy**.
- Paket langsung menggunakan akun dan database yang sudah aktif.
- YouTube menggunakan **Clean Player Mode**: video baru dimuat setelah tombol putar ditekan, kontrol bawaan disembunyikan, mode privasi YouTube digunakan, dan layar akhir segera diganti agar rekomendasi tidak tampil.
- Navigasi bawah khusus mobile seperti aplikasi LMS modern.
- Tampilan halaman masuk, dashboard, kelas, ruang belajar, tabel, modal, dan kartu diperhalus untuk desktop maupun ponsel.
- PWA dan cache diperbarui ke versi 2.0.0.

## Fitur utama

- Login email dan kata sandi.
- Peran administrator, pengajar, dan peserta.
- Pengelolaan pengguna, kelas, modul, dan peserta kelas.
- YouTube Live dan tayangan ulang dalam halaman LMS.
- Presensi, durasi aktif, progres video, catatan, diskusi, kuis, tugas, nilai, laporan, dan pengumuman.
- Tampilan responsif untuk desktop, tablet, dan ponsel.

## Cara memperbarui aplikasi yang sudah aktif

1. Cadangkan repository atau folder versi sebelumnya.
2. Ganti seluruh file aplikasi lama dengan isi paket ini.
3. Pertahankan project Firebase yang sama; konfigurasi sudah tersedia di `js/firebase-config.js`.
4. Bila Security Rules sebelumnya sudah terpasang dan berjalan, tidak perlu membuat akun administrator ulang.
5. Setelah upload, lakukan hard refresh atau hapus cache situs sekali agar Service Worker versi lama terganti.

## Deploy Firebase Hosting

```bash
firebase deploy --only hosting
```

Untuk memperbarui Rules sekaligus:

```bash
firebase deploy --only database,hosting
```

## Deploy GitHub Pages

Upload seluruh isi folder ke root repository, lalu gunakan GitHub Pages dari branch `main` dan folder `/root`. Pastikan domain GitHub Pages telah dimasukkan ke Firebase Authentication → Authorized domains.

## Catatan YouTube Clean Player

Clean Player Mode menghilangkan kontrol bawaan, memuat video hanya setelah peserta menekan tombol putar, memakai `youtube-nocookie.com`, dan mengganti layar segera setelah video berakhir. Karena sumber tetap YouTube, identitas atau pesan bawaan YouTube masih dapat muncul pada kondisi tertentu, misalnya ketika pemilik video menonaktifkan embedding atau ketika YouTube menampilkan pesan kesalahan.

## Struktur utama

- `index.html` — aplikasi utama.
- `js/app.js` — logika LMS dan Clean Player Mode.
- `js/firebase-config.js` — konfigurasi Firebase.
- `database.rules.json` — Security Rules Realtime Database.
- `css/app.css` — desain desktop dan mobile.
- `assets/logo-izzuddin.png` — logo aplikasi.
