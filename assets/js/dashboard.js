import {
  auth, onAuthStateChanged, fetchProfile, fetchClasses, fetchEnrollment, ensureEnrollment,
  fetchVideos, logoutUser, state, coverGradient, rupiah, initials, toast,
  ref, get, subscribeNotifications, subscribeLiveChat, sendLiveChatMessage, saveProfile, db
} from './core.js';

const sections = [...document.querySelectorAll('main section')];
const navLinks = [...document.querySelectorAll('[data-section]')];
const triggerButtons = [...document.querySelectorAll('[data-section-trigger]')];
const classGrid = document.getElementById('dashboardClassGrid');
const myClassGrid = document.getElementById('myClassGrid');
const continueLearning = document.getElementById('continueLearning');
const activityList = document.getElementById('activityList');
const profileForm = document.getElementById('profileForm');
const searchInput = document.getElementById('dashSearch');
const filterButtons = [...document.querySelectorAll('#catalogSection [data-filter]')];
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const notifCount = document.getElementById('notifCount');
let allClasses = [];
let activeFilter = 'all';
let currentUser = null;
let currentProfile = null;
let enrollments = {};
let notifications = [];
let chatUnsub = null;

function switchSection(id) {
  sections.forEach(sec => sec.classList.toggle('hidden', sec.id !== id));
  navLinks.forEach(link => link.classList.toggle('active', link.dataset.section === id));
}
navLinks.forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); switchSection(link.dataset.section); }));
triggerButtons.forEach(btn => btn.addEventListener('click', ()=> switchSection(btn.dataset.sectionTrigger)));

function classCard(item, enrolled) {
  const badge = item.isPaid ? '<span class="badge paid">Berbayar</span>' : '<span class="badge free">Gratis</span>';
  const enroll = enrollments[item.id];
  const status = enroll?.status === 'active' ? 'Akses aktif' : enroll?.paymentStatus === 'pending' ? 'Menunggu verifikasi' : item.isPaid ? 'Perlu pembayaran' : 'Belum diambil';
  return `
    <article class="panel class-card">
      <div class="class-cover" style="background:${coverGradient(item.coverTheme)}">
        <div>
          ${badge}
          <div style="margin-top:12px; font-size:24px; font-weight:800; max-width:220px;">${item.title}</div>
          <div style="margin-top:6px; opacity:.88;">${item.teacherName}</div>
        </div>
      </div>
      <div class="class-body">
        <div class="class-title">${item.title}</div>
        <div class="muted" style="line-height:1.7; min-height:66px;">${item.description || ''}</div>
        <div style="margin-top:14px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div>
            ${item.isPaid ? `<div class="course-price">${rupiah(item.price)}</div>` : '<div class="course-price" style="color:#0d7a52;">Gratis</div>'}
            <div class="muted" style="font-size:13px;">${status}</div>
          </div>
          <a class="btn small primary" href="class.html?class=${item.id}">${enrolled ? 'Buka Kelas' : 'Lihat Detail'}</a>
        </div>
      </div>
    </article>
  `;
}

function renderCatalog() {
  const keyword = (searchInput?.value || '').trim().toLowerCase();
  const filtered = allClasses.filter(item => {
    const matchesFilter = activeFilter === 'all' || (activeFilter === 'free' ? !item.isPaid : item.isPaid);
    const hay = `${item.title} ${item.description} ${item.category} ${item.teacherName}`.toLowerCase();
    return matchesFilter && hay.includes(keyword);
  });
  classGrid.innerHTML = filtered.length ? filtered.map(item => classCard(item, Boolean(enrollments[item.id]))).join('') : '<div class="empty-state" style="grid-column:1/-1;">Tidak ada kelas yang cocok.</div>';
}


async function fetchUserEnrollments(uid) {
  const snap = await get(ref(db, `enrollments/${uid}`));
  return snap.val() || {};
}

function renderMyClasses() {
  const mine = allClasses.filter(item => enrollments[item.id]);
  myClassGrid.innerHTML = mine.length ? mine.map(item => classCard(item, true)).join('') : '<div class="empty-state" style="grid-column:1/-1;">Anda belum mengambil kelas apa pun. Jelajahi katalog dan mulai belajar.</div>';
}

async function renderContinueLearning() {
  const first = allClasses[0];
  const activeClasses = allClasses.filter(item => enrollments[item.id]?.status === 'active' || !item.isPaid);
  if (!activeClasses.length) {
    continueLearning.innerHTML = '<div class="empty-state">Belum ada materi untuk dilanjutkan.</div>';
    return;
  }
  const cards = await Promise.all(activeClasses.slice(0,3).map(async item => {
    const videos = await fetchVideos(item.id);
    const firstVideo = videos[0];
    return `
      <div class="lesson-item" style="display:flex; gap:14px; align-items:center;">
        <div style="width:120px; aspect-ratio:16/9; border-radius:16px; background:${coverGradient(item.coverTheme)};"></div>
        <div style="flex:1;">
          <div class="badge ${item.isPaid ? 'paid' : 'free'}">${item.isPaid ? 'Berbayar' : 'Gratis'}</div>
          <h3 style="margin:8px 0 6px;">${item.title}</h3>
          <div class="muted">${firstVideo?.title || 'Materi pembuka'}</div>
          <div class="muted" style="font-size:13px; margin-top:6px;">${item.teacherName}</div>
        </div>
        <a class="btn small primary" href="class.html?class=${item.id}">Lanjutkan</a>
      </div>`;
  }));
  continueLearning.innerHTML = cards.join('');
}

function renderActivities() {
  const items = [
    'Menyelesaikan profil belajar.',
    'Membuka katalog kelas terbaru.',
    'Forum diskusi per video telah aktif.',
    'Kelas berbayar dapat diakses setelah verifikasi pembayaran.'
  ];
  activityList.innerHTML = items.map(text => `<div class="lesson-item">${text}</div>`).join('');
}

function renderProfile() {
  document.getElementById('sideUserName').textContent = currentProfile.name || 'Pelajar';
  document.getElementById('sideUserEmail').textContent = currentProfile.email || '-';
  document.getElementById('heroUserName').textContent = currentProfile.name?.split(' ')[0] || 'Pelajar';
  document.getElementById('profileName').value = currentProfile.name || '';
  document.getElementById('profileEmail').value = currentProfile.email || '';
  document.getElementById('profileWhatsApp').value = currentProfile.whatsapp || '';
  document.getElementById('profileBio').value = currentProfile.bio || '';
  if (currentProfile.role === 'admin' || currentProfile.role === 'mentor') {
    document.getElementById('goAdminBtn').style.display = 'inline-flex';
  }
}

function renderNotifications() {
  notifCount.textContent = notifications.filter(n => !n.read).length;
}

function renderChat(items) {
  chatMessages.innerHTML = items.length ? items.map(item => `
    <div class="chat-item" style="display:flex; gap:12px; align-items:flex-start;">
      <div class="avatar">${initials(item.name)}</div>
      <div style="flex:1;">
        <div class="forum-meta"><strong>${item.name}</strong> <span class="badge ${item.role === 'admin' || item.role === 'mentor' ? 'mentor' : 'student'}">${item.role === 'admin' || item.role === 'mentor' ? 'Admin/Pembimbing' : 'Peserta'}</span> <span class="muted">${new Date(item.createdAt || Date.now()).toLocaleString('id-ID')}</span></div>
        <div class="forum-content">${item.text}</div>
      </div>
    </div>`).join('') : '<div class="empty-state">Belum ada pesan. Silakan mulai chat dengan admin.</div>';
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('profileName').value.trim(),
    whatsapp: document.getElementById('profileWhatsApp').value.trim(),
    bio: document.getElementById('profileBio').value.trim()
  };
  try {
    await saveProfile(currentUser.uid, payload);
    currentProfile = { ...currentProfile, ...payload };
    renderProfile();
    toast('Profil berhasil diperbarui');
  } catch (err) {
    toast(err.message || 'Gagal menyimpan profil', 'error');
  }
});

sendChatBtn.addEventListener('click', async () => {
  const text = chatInput.value.trim();
  if (!text) return;
  try {
    await sendLiveChatMessage(`member_${currentUser.uid}`, {
      uid: currentUser.uid,
      name: currentProfile.name,
      role: currentProfile.role || 'student',
      text
    });
    chatInput.value = '';
  } catch (err) {
    toast(err.message || 'Gagal mengirim pesan', 'error');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await logoutUser();
  window.location.href = '../index.html';
});

document.getElementById('notifBtn').addEventListener('click', ()=> toast(`Ada ${notifications.filter(n=>!n.read).length} notifikasi belum dibaca.`));
searchInput.addEventListener('input', renderCatalog);
filterButtons.forEach(btn => btn.addEventListener('click', () => {
  filterButtons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  renderCatalog();
}));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }
  currentUser = user;
  currentProfile = await fetchProfile(user.uid);
  if (!currentProfile) {
    window.location.href = '../index.html';
    return;
  }
  allClasses = await fetchClasses();
  enrollments = await fetchUserEnrollments(user.uid);
  renderProfile();
  renderCatalog();
  renderMyClasses();
  renderContinueLearning();
  renderActivities();
  subscribeNotifications(`notifications/${user.uid}`, items => {
    notifications = items;
    renderNotifications();
  });
  chatUnsub = subscribeLiveChat(`member_${user.uid}`, renderChat);
});
