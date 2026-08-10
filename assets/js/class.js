import {
  auth, onAuthStateChanged, fetchProfile, fetchClass, fetchVideos, fetchEnrollment, ensureEnrollment,
  fetchSettings, uploadProof, submitPayment, subscribeForum, submitForumPost,
  logoutUser, initials, toast, rupiah
} from './core.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('class');
let currentUser = null;
let profile = null;
let classData = null;
let videos = [];
let currentVideo = null;
let enrollment = null;
let settings = null;
let forumUnsub = null;

function switchTab(tabId) {
  document.querySelectorAll('.tabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== tabId));
}
document.querySelectorAll('.tabs button').forEach(btn => btn.addEventListener('click', ()=> switchTab(btn.dataset.tab)));

function renderVideoEmbed(video) {
  const shell = document.getElementById('videoShell');
  if (!video) {
    shell.innerHTML = '<div class="empty-state">Video belum tersedia.</div>';
    return;
  }
  if (video.sourceType === 'gdrive') {
    shell.innerHTML = `<iframe class="drive-frame" src="${video.embedUrl}" allow="autoplay"></iframe>`;
  } else {
    shell.innerHTML = `<iframe src="${video.embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  }
  document.getElementById('videoSummary').textContent = video.summary || 'Ringkasan materi belum tersedia.';
}

function renderVideoList() {
  const container = document.getElementById('videoList');
  container.innerHTML = videos.length ? videos.map(item => `
    <button class="lesson-item ${item.id === currentVideo?.id ? 'active' : ''}" data-video="${item.id}" style="text-align:left; width:100%; background:#fff;">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
        <div>
          <div style="font-weight:800;">${item.title}</div>
          <div class="muted" style="margin-top:4px;">${item.duration || '-'}</div>
        </div>
        <span class="badge ${item.id === currentVideo?.id ? 'free' : ''}">${item.sourceType === 'gdrive' ? 'Drive' : 'YouTube'}</span>
      </div>
    </button>
  `).join('') : '<div class="empty-state">Belum ada video pada kelas ini.</div>';
  container.querySelectorAll('[data-video]').forEach(btn => btn.addEventListener('click', ()=> {
    currentVideo = videos.find(v => v.id === btn.dataset.video);
    renderVideoEmbed(currentVideo);
    renderVideoList();
    subscribeForumForCurrentVideo();
  }));
}

function renderMeta() {
  document.getElementById('classTitle').textContent = classData.title;
  document.getElementById('classTeacher').textContent = classData.teacherName || '-';
  document.getElementById('classCategoryBadge').textContent = classData.category || 'Video Pembelajaran';
  const priceBadge = document.getElementById('classPriceBadge');
  priceBadge.className = `badge ${classData.isPaid ? 'paid' : 'free'}`;
  priceBadge.textContent = classData.isPaid ? rupiah(classData.price) : 'Gratis';
  const accessBadge = document.getElementById('accessBadge');
  const accessText = classData.isPaid
    ? (enrollment?.status === 'active' ? 'Akses aktif' : enrollment?.paymentStatus === 'pending' ? 'Menunggu verifikasi' : 'Belum aktif')
    : 'Akses langsung';
  accessBadge.className = `badge ${enrollment?.status === 'active' || !classData.isPaid ? 'free' : 'pending'}`;
  accessBadge.textContent = accessText;
}

function renderForum(items) {
  const list = document.getElementById('forumList');
  list.innerHTML = items.length ? items.map(item => `
    <div class="forum-item">
      <div class="avatar">${initials(item.name)}</div>
      <div class="forum-bubble">
        <div class="forum-meta">
          <strong>${item.name}</strong>
          <span class="badge ${item.role === 'admin' || item.role === 'mentor' ? 'mentor' : 'student'}">${item.role === 'admin' || item.role === 'mentor' ? 'Pembimbing' : 'Peserta'}</span>
          <span class="muted">${new Date(item.createdAt || Date.now()).toLocaleString('id-ID')}</span>
        </div>
        <div class="forum-content">${item.text}</div>
      </div>
    </div>
  `).join('') : '<div class="empty-state">Belum ada pertanyaan. Jadilah yang pertama bertanya di forum ini.</div>';
}

function subscribeForumForCurrentVideo() {
  if (forumUnsub) forumUnsub();
  if (!currentVideo) return;
  forumUnsub = subscribeForum(classId, currentVideo.id, renderForum);
}

async function renderPayment() {
  const freeBox = document.getElementById('freeAccessBox');
  const paidBox = document.getElementById('paidAccessBox');
  if (!classData.isPaid) {
    freeBox.classList.remove('hidden');
    paidBox.classList.add('hidden');
    return;
  }
  freeBox.classList.add('hidden');
  paidBox.classList.remove('hidden');
  document.getElementById('paymentBankName').textContent = settings.payment.bankName;
  document.getElementById('paymentBankNumber').textContent = settings.payment.accountNumber;
  document.getElementById('paymentBankAccountName').textContent = `a.n. ${settings.payment.accountName}`;
  document.getElementById('paymentAmountText').textContent = rupiah(classData.price);
  let statusText = 'Belum ada pembayaran';
  if (enrollment?.paymentStatus === 'pending') statusText = 'Menunggu verifikasi admin';
  if (enrollment?.paymentStatus === 'approved') statusText = 'Pembayaran disetujui — akses aktif';
  if (enrollment?.paymentStatus === 'rejected') statusText = 'Pembayaran perlu diperiksa ulang';
  document.getElementById('paymentStatusBox').textContent = statusText;
}

function guardLearningAccess() {
  const locked = classData.isPaid && enrollment?.status !== 'active' && profile.role !== 'admin' && profile.role !== 'mentor';
  document.getElementById('forumForm').style.display = locked ? 'none' : 'block';
  if (locked) {
    document.getElementById('videoShell').innerHTML = '<div class="empty-state">Akses video penuh akan terbuka setelah pembayaran disetujui admin. Silakan gunakan tab Akses Kelas.</div>';
  } else {
    renderVideoEmbed(currentVideo);
  }
}

document.getElementById('forumForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('forumText').value.trim();
  if (!text) return;
  if (classData.isPaid && enrollment?.status !== 'active' && profile.role !== 'admin' && profile.role !== 'mentor') {
    toast('Forum aktif setelah akses kelas terbuka', 'error');
    return;
  }
  try {
    await submitForumPost(classId, currentVideo.id, {
      uid: currentUser.uid,
      name: profile.name,
      role: profile.role,
      text
    });
    document.getElementById('forumText').value = '';
    toast('Pertanyaan berhasil dikirim');
  } catch (err) {
    toast(err.message || 'Gagal mengirim ke forum', 'error');
  }
});

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = document.getElementById('proofFile').files[0];
  if (!file) { toast('Silakan pilih bukti transfer', 'error'); return; }
  try {
    const proofUrl = await uploadProof(file, currentUser.uid, classId);
    await submitPayment({
      uid: currentUser.uid,
      classId,
      amount: classData.price,
      senderName: document.getElementById('senderName').value.trim(),
      senderBank: document.getElementById('senderBank').value.trim(),
      proofUrl
    });
    toast('Bukti pembayaran berhasil dikirim');
    enrollment = { ...(enrollment || {}), status: 'pending_payment', paymentStatus: 'pending' };
    renderMeta();
    renderPayment();
  } catch (err) {
    toast(err.message || 'Gagal mengirim bukti pembayaran', 'error');
  }
});

document.getElementById('copyAccountBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(settings.payment.accountNumber);
  toast('Nomor rekening disalin');
});

document.getElementById('copyAmountBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(String(classData.price || 0));
  toast('Nominal disalin');
});

document.getElementById('classLogoutBtn').addEventListener('click', async () => {
  await logoutUser();
  window.location.href = '../index.html';
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  if (!classId) { window.location.href = 'dashboard.html'; return; }
  currentUser = user;
  profile = await fetchProfile(user.uid);
  classData = await fetchClass(classId);
  if (!classData) { toast('Kelas tidak ditemukan', 'error'); return; }
  settings = await fetchSettings();
  enrollment = await ensureEnrollment(user.uid, classId, classData);
  videos = await fetchVideos(classId);
  currentVideo = videos[0] || null;
  renderMeta();
  renderVideoList();
  guardLearningAccess();
  subscribeForumForCurrentVideo();
  renderPayment();
  if (!classData.isPaid) document.getElementById('paymentTabBtn').textContent = 'Akses Kelas';
});
