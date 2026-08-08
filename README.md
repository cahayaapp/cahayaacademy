# IZZUDDIN ACADEMY LMS — v4.0.0

Pembaruan LMS dengan pendaftaran mandiri, katalog kelas gratis/berbayar, pembayaran transfer, video YouTube/Google Drive, dan tampilan mobile yang diperkuat.

## Fitur baru

- Tab Masuk dan Daftar pada halaman awal.
- Akun pelajar dibuat mandiri dan langsung diarahkan ke katalog kelas.
- Admin memilih kelas Gratis atau Berbayar serta menentukan harga.
- Kelas gratis dapat diikuti langsung.
- Kelas berbayar: transfer, unggah bukti, notifikasi admin, WhatsApp siap kirim, verifikasi, lalu akses terbuka otomatis.
- Bukti transfer dikompres sebagai gambar dan disimpan privat di Realtime Database; tidak memerlukan Firebase Storage.
- Sumber video utama dan materi pendamping dapat memakai YouTube atau Google Drive.
- Clean Player YouTube menutup tampilan jeda/akhir agar rekomendasi tidak mengganggu.
- Antarmuka hanya memakai istilah Video Pembelajaran, tanpa istilah siaran langsung atau tayangan ulang.
- Frame video mobile mengikuti lebar layar dan tidak membutuhkan geser horizontal.
- Seluruh halaman aktivasi awal telah dihapus.

## Pembaruan situs aktif

1. Cadangkan repository lama.
2. Ganti seluruh file lama dengan isi paket ini.
3. Publish isi `database.rules.json` pada Realtime Database Rules.
4. Login sebagai admin, buka Pengaturan, lalu isi rekening dan nomor WhatsApp admin.
5. Upload ke GitHub Pages atau Firebase Hosting dan lakukan hard refresh sekali.

## Firebase CLI

```bash
firebase deploy --only database,hosting
```

Untuk GitHub Pages, upload seluruh isi folder ke root repository. Pastikan domain produksi sudah masuk Firebase Authentication → Authorized domains.

## Catatan privasi

YouTube sebaiknya Unlisted dan embedding aktif. Google Drive sebaiknya Viewer serta download, print, dan copy dinonaktifkan. Pembatasan layanan pihak ketiga bukan DRM absolut.


## Pembaruan v4.0.0
- Sinkronisasi profil peserta realtime ke halaman admin.
- Tombol salin nomor rekening dan nominal pembayaran.
- Live Chat realtime antara peserta dan admin.
- Informasi “Verifikasi sederhana” di formulir pembayaran dihapus.
- Rules Realtime Database ditambah untuk `supportChats`.
