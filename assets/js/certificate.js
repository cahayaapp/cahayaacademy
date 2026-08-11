import {
  auth, onAuthStateChanged, fetchProfile, fetchClass, fetchClassCompletion,
  issueCertificate, fetchSettings, toast
} from './core.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('class');

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  if (!classId) { window.location.href = 'dashboard.html'; return; }
  try {
    const [profile, classData, settings] = await Promise.all([
      fetchProfile(user.uid), fetchClass(classId), fetchSettings()
    ]);
    if (!classData) throw new Error('Kelas tidak ditemukan');
    const completion = await fetchClassCompletion(user.uid, classId);
    if (!completion.eligible && profile.role !== 'admin' && profile.role !== 'mentor') {
      throw new Error('Sertifikat belum tersedia. Selesaikan semua materi dan kuis terlebih dahulu.');
    }
    const cert = await issueCertificate(user.uid, classId, profile, classData);
    document.getElementById('certStudentName').textContent = cert.studentName || profile.name;
    document.getElementById('certClassTitle').textContent = cert.classTitle || classData.title;
    document.getElementById('certTeacherText').textContent = cert.teacherName ? `Dibimbing oleh ${cert.teacherName}` : 'Diterbitkan oleh belajarislam.online';
    document.getElementById('certDate').textContent = new Date(cert.issuedAt).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
    document.getElementById('certId').textContent = cert.certificateId;
    document.getElementById('certSigner').textContent = settings.certificate?.signerName || 'Admin belajarislam.online';
    document.getElementById('certSignerTitle').textContent = settings.certificate?.signerTitle || 'Pembimbing Program';
    document.getElementById('backToClass').href = `class.html?class=${encodeURIComponent(classId)}`;
  } catch (err) {
    toast(err.message || 'Sertifikat belum tersedia', 'error');
    setTimeout(() => { window.location.href = `class.html?class=${encodeURIComponent(classId || '')}`; }, 2200);
  }
});

document.getElementById('printCertBtn').addEventListener('click', () => window.print());
