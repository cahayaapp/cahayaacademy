# belajarislam.online LMS v6.4.0

Full package LMS berbasis Firebase Authentication + Firebase Realtime Database.

## Fokus v6.4.0
- Seluruh data belajar penting disimpan online di Firebase: profil, nomor WhatsApp, kelas, akses pembelian, progres video, materi terakhir, kuis, hasil kuis, sertifikat, forum, chat, notifikasi, pembayaran, ebook, dan file ebook.
- Perubahan video pada panel admin memakai listener realtime: tambah/edit/hapus langsung tampil tanpa refresh.
- Kelas Saya membaca `enrollments/{uid}` realtime sehingga kelas premium yang disetujui admin langsung masuk.
- Materi Terakhir membaca `recentLearning` + `lessonProgress` dari Firebase.
- Terbaru dan Rekomendasi sudah aktif dan berbasis data online.
- Produk ebook PDF bisa gratis atau berbayar, tanpa video.
- Link sumber video dipisahkan dari metadata publik dan disimpan di `videoSources`, hanya dapat dibaca akun yang memiliki akses kelas atau admin/pembimbing.
- Mobile di-hardening agar tidak horizontal scroll dan player tetap 16:9.

## Catatan keamanan video
Aplikasi menghilangkan link sumber dari HTML statis/metadata kelas, mengambilnya dari Firebase setelah akses terverifikasi, menonaktifkan interaksi langsung ke iframe YouTube, memakai kontrol LMS sendiri, dan membatasi sandbox Google Drive. Namun sumber yang benar-benar diputar oleh browser tidak mungkin dibuat 100% tak terlihat bagi pengguna teknis yang memeriksa Network/DevTools; browser tetap harus menerima informasi yang diperlukan untuk memutar konten.

## Penyimpanan
Paket ini tidak membutuhkan Firebase Storage untuk alur utama. Cover, bukti transfer, dan PDF ebook disimpan di Realtime Database dengan pembatasan ukuran pada sisi aplikasi. PDF ebook maksimal 5 MB pada mode ini.
