# belajarislam.online LMS v6.0.0 FINAL

Full rebuild UI/UX berdasarkan master visual belajarislam.online: hijau emerald, teal, emas, putih, clean, premium, dan responsive.

## Fitur utama
- Landing page modern + katalog kelas publik
- Registrasi pelajar mandiri dan login Firebase Authentication
- Dashboard member desktop & mobile
- Katalog kelas gratis / premium
- Upload cover kelas langsung dari Admin Center
- Cover otomatis crop 16:9 dan kompres, tanpa Firebase Storage
- YouTube / Google Drive sebagai sumber video
- Progres belajar per video
- Forum diskusi per video + reply
- Kuis per video
- Sertifikat penyelesaian
- Pembayaran transfer + copy rekening/nominal + upload bukti transfer
- Approval pembayaran admin membuka kelas otomatis
- Bukti transfer dikompres dan disimpan terpisah di Realtime Database
- Profil member tersinkron ke admin
- Notifikasi realtime
- Live chat member ↔ admin
- Admin Center responsive
- PWA + dark mode

## Firebase
Project yang dipakai tetap `cahayaacademy-f8787` sesuai konfigurasi sebelumnya.

Wajib:
1. Authentication Email/Password aktif.
2. Realtime Database aktif.
3. Publish `database.rules.json` versi v6.0.0.
4. Tambahkan `belajarislam.online` dan bila dipakai `www.belajarislam.online` di Authentication → Authorized domains.

Firebase Storage tidak diperlukan untuk versi ini.
