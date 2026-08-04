# CAHAYA ACADEMY

Learning Management System berbasis **Firebase Authentication**, **Firebase Realtime Database**, dan **YouTube Embed** untuk Pesantren Cahaya Fajrul Islam.

## Fitur yang sudah tersedia

- Login email dan kata sandi.
- Aktivasi administrator pertama.
- Peran administrator, pengajar, dan peserta.
- Pembuatan akun pengguna tanpa mengeluarkan sesi administrator.
- Pengelolaan kelas dan akses peserta.
- Modul pembelajaran.
- Jadwal YouTube Live dan tayangan ulang.
- Materi pendamping berbasis tautan.
- Presensi otomatis ketika ruang pertemuan dibuka.
- Pencatatan durasi aktif dan progres video melalui YouTube IFrame Player API.
- Catatan pribadi yang tersimpan otomatis.
- Diskusi per pertemuan.
- Kuis pilihan ganda formatif.
- Tugas, pengumpulan jawaban, nilai, dan umpan balik.
- Laporan kelas serta ekspor CSV.
- Pengumuman.
- PWA dasar dan tampilan responsif.

## Struktur utama

- `index.html` — aplikasi utama.
- `setup.html` — aktivasi administrator pertama.
- `js/firebase-config.js` — konfigurasi Firebase project.
- `database.rules.json` — Security Rules Realtime Database.
- `css/app.css` — seluruh desain responsif.
- `assets/logofi.png` — logo aplikasi.

## Aktivasi

Baca `LANGKAH-AKTIVASI.txt` dan ikuti urutannya.

## Deploy dengan GitHub Pages

1. Buat repository baru.
2. Upload seluruh isi folder paket ini ke root repository.
3. Buka **Settings → Pages**.
4. Pilih **Deploy from a branch**, branch `main`, folder `/root`.
5. Tambahkan domain GitHub Pages ke Firebase Authentication → Settings → Authorized domains.
6. Buka `https://alamat-anda/setup.html` untuk mengaktifkan administrator pertama.

## Deploy dengan Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only database,hosting
```

Project default di `.firebaserc` sudah diarahkan ke `cahayaacademy-f8787`.

## Struktur data

```text
system
users
publicProfiles
classes
teacherClasses
userClasses
classMembers
modules
meetings
assignments
submissions
attendance
watchProgress
notes
discussions
quizzes
quizResults
announcements
```

## Catatan keamanan

- Jangan menggunakan Test Mode.
- Pasang `database.rules.json` sebelum menjalankan `setup.html`.
- Halaman setup hanya dapat mengklaim pemilik ketika `system/ownerUid` masih kosong.
- Kuis pada versi ini adalah kuis formatif client-side. Untuk ujian resmi, kunci jawaban dan proses penilaian perlu dipindahkan ke Cloud Functions atau server tepercaya.
- Materi saat ini menggunakan tautan eksternal. Firebase Storage dapat ditambahkan pada tahap berikutnya.

## Logo

Logo yang ada dalam paket merupakan placeholder. Ganti `assets/logofi.png`, `assets/icon-192.png`, dan `assets/icon-512.png` dengan logo resmi tanpa mengubah nama filenya.
