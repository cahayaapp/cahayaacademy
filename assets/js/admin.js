import {
  auth, onAuthStateChanged, fetchProfile, logoutUser, fetchUsers, fetchAllPayments,
  fetchClasses, createClass, saveVideo, fetchSettings, saveSettings,
  approvePayment, rejectPayment, toast, rupiah, initials,
  subscribeLiveChat, sendLiveChatMessage
} from './core.js';

const sections = [...document.querySelectorAll('main section')];
const navLinks = [...document.querySelectorAll('[data-section]')];
navLinks.forEach(link => link.addEventListener('click', (e) => { e.preventDefault(); switchSection(link.dataset.section); }));
function switchSection(id) {
  sections.forEach(sec => sec.classList.toggle('hidden', sec.id !== id));
  navLinks.forEach(link => link.classList.toggle('active', link.dataset.section === id));
}

let currentUser = null;
let profile = null;
let users = [];
let classes = [];
let payments = [];
let settings = null;
let liveChatUnsub = null;

function renderStats() {
  const totalUsers = users.length;
  const totalClasses = classes.length;
  const pendingPayments = payments.filter(p => p.status === 'pending').length;
  const paidClasses = classes.filter(c => c.isPaid).length;
  document.getElementById('adminStats').innerHTML = `
    <div class="stat-card"><strong>${totalUsers}</strong>Pengguna terdaftar</div>
    <div class="stat-card"><strong>${totalClasses}</strong>Kelas aktif</div>
    <div class="stat-card"><strong>${pendingPayments}</strong>Pembayaran menunggu</div>
    <div class="stat-card"><strong>${paidClasses}</strong>Kelas berbayar</div>
  `;
}

function renderPaymentTable() {
  const wrap = document.getElementById('paymentTableWrap');
  if (!payments.length) {
    wrap.innerHTML = '<div class="empty-state">Belum ada pembayaran masuk.</div>';
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Tanggal</th><th>Peserta</th><th>Kelas</th><th>Nominal</th><th>Status</th><th>Bukti</th><th>Aksi</th></tr>
      </thead>
      <tbody>
        ${payments.map(item => {
          const user = users.find(u => u.uid === item.uid);
          const course = classes.find(c => c.id === item.classId);
          return `
            <tr>
              <td>${new Date(item.createdAt || Date.now()).toLocaleString('id-ID')}</td>
              <td><strong>${user?.name || item.senderName || '-'}</strong><div class="muted">${user?.whatsapp || '-'}</div></td>
              <td>${course?.title || item.classId}</td>
              <td>${rupiah(item.amount)}</td>
              <td><span class="badge ${item.status === 'approved' ? 'free' : item.status === 'rejected' ? 'pending' : 'paid'}">${item.status}</span></td>
              <td>${item.proofUrl ? `<a href="${item.proofUrl}" target="_blank" class="btn small">Lihat</a>` : '-'}</td>
              <td>
                <div class="utility-row">
                  <button class="btn small primary" data-approve="${item.id}">Setujui</button>
                  <button class="btn small" data-reject="${item.id}">Tolak</button>
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  wrap.querySelectorAll('[data-approve]').forEach(btn => btn.addEventListener('click', async ()=> {
    try { await approvePayment(btn.dataset.approve); toast('Pembayaran disetujui'); await reloadData(); } catch(err){ toast(err.message || 'Gagal menyetujui pembayaran','error'); }
  }));
  wrap.querySelectorAll('[data-reject]').forEach(btn => btn.addEventListener('click', async ()=> {
    try { await rejectPayment(btn.dataset.reject); toast('Pembayaran ditolak'); await reloadData(); } catch(err){ toast(err.message || 'Gagal menolak pembayaran','error'); }
  }));
}

function renderUserTable() {
  const wrap = document.getElementById('userTableWrap');
  if (!users.length) {
    wrap.innerHTML = '<div class="empty-state">Belum ada pengguna.</div>';
    return;
  }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>Nama</th><th>Email</th><th>WhatsApp</th><th>Role</th><th>Update Terakhir</th></tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${u.name || '-'}</td>
            <td>${u.email || '-'}</td>
            <td>${u.whatsapp || '-'}</td>
            <td><span class="badge ${u.role === 'admin' || u.role === 'mentor' ? 'mentor' : 'student'}">${u.role || 'student'}</span></td>
            <td>${u.updatedAt ? new Date(u.updatedAt).toLocaleString('id-ID') : '-'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function refreshClassSelect() {
  const select = document.getElementById('videoClassSelect');
  select.innerHTML = classes.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
}

function fillSettingsForm() {
  const form = document.getElementById('settingsForm');
  form.bankName.value = settings.payment.bankName || '';
  form.accountNumber.value = settings.payment.accountNumber || '';
  form.accountName.value = settings.payment.accountName || '';
  form.whatsappAdmin.value = settings.payment.whatsappAdmin || '';
}

function buildChatRooms() {
  const select = document.getElementById('chatRoomSelect');
  const studentUsers = users.filter(u => u.role !== 'admin' && u.role !== 'mentor');
  select.innerHTML = studentUsers.map(u => `<option value="member_${u.uid}">${u.name} — ${u.whatsapp || u.email}</option>`).join('');
  if (studentUsers.length) subscribeToRoom(select.value);
}

function renderAdminChat(items) {
  const box = document.getElementById('adminChatMessages');
  box.innerHTML = items.length ? items.map(item => `
    <div class="chat-item" style="display:flex; gap:12px; align-items:flex-start;">
      <div class="avatar">${initials(item.name)}</div>
      <div style="flex:1;">
        <div class="forum-meta"><strong>${item.name}</strong> <span class="badge ${item.role === 'admin' || item.role === 'mentor' ? 'mentor' : 'student'}">${item.role}</span> <span class="muted">${new Date(item.createdAt || Date.now()).toLocaleString('id-ID')}</span></div>
        <div class="forum-content">${item.text}</div>
      </div>
    </div>`).join('') : '<div class="empty-state">Belum ada pesan pada ruang ini.</div>';
  box.scrollTop = box.scrollHeight;
}

function subscribeToRoom(roomId) {
  if (liveChatUnsub) liveChatUnsub();
  if (!roomId) return;
  liveChatUnsub = subscribeLiveChat(roomId, renderAdminChat);
}

document.getElementById('chatRoomSelect').addEventListener('change', (e)=> subscribeToRoom(e.target.value));

document.getElementById('adminSendChatBtn').addEventListener('click', async () => {
  const text = document.getElementById('adminChatInput').value.trim();
  const roomId = document.getElementById('chatRoomSelect').value;
  if (!text || !roomId) return;
  try {
    await sendLiveChatMessage(roomId, { uid: currentUser.uid, name: profile.name, role: profile.role || 'admin', text });
    document.getElementById('adminChatInput').value = '';
  } catch (err) {
    toast(err.message || 'Gagal mengirim balasan','error');
  }
});

document.getElementById('classForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const classType = form.get('classType');
  try {
    await createClass({
      title: form.get('title'),
      category: form.get('category'),
      teacherName: form.get('teacherName'),
      isPaid: classType === 'paid',
      price: Number(form.get('price') || 0),
      level: form.get('level'),
      description: form.get('description'),
      coverTheme: 'emerald',
      order: classes.length + 1
    });
    toast('Kelas berhasil disimpan');
    e.target.reset();
    await reloadData();
  } catch (err) {
    toast(err.message || 'Gagal menyimpan kelas','error');
  }
});

document.getElementById('videoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await saveVideo(form.get('classId'), {
      title: form.get('title'),
      duration: form.get('duration'),
      sourceType: form.get('sourceType'),
      embedUrl: form.get('embedUrl'),
      summary: form.get('summary'),
      order: Date.now()
    });
    toast('Video berhasil disimpan');
    e.target.reset();
  } catch (err) {
    toast(err.message || 'Gagal menyimpan video','error');
  }
});

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await saveSettings({ payment: {
      bankName: form.get('bankName'),
      accountNumber: form.get('accountNumber'),
      accountName: form.get('accountName'),
      whatsappAdmin: form.get('whatsappAdmin')
    }});
    toast('Pengaturan pembayaran berhasil disimpan');
    await reloadData();
  } catch (err) {
    toast(err.message || 'Gagal menyimpan pengaturan','error');
  }
});

document.getElementById('adminLogoutBtn').addEventListener('click', async ()=> {
  await logoutUser();
  window.location.href = '../index.html';
});

async function reloadData() {
  users = await fetchUsers();
  classes = await fetchClasses();
  payments = await fetchAllPayments();
  settings = await fetchSettings();
  renderStats();
  renderPaymentTable();
  renderUserTable();
  refreshClassSelect();
  fillSettingsForm();
  buildChatRooms();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = '../index.html'; return; }
  currentUser = user;
  profile = await fetchProfile(user.uid);
  if (!profile || (profile.role !== 'admin' && profile.role !== 'mentor')) {
    window.location.href = 'dashboard.html';
    return;
  }
  document.getElementById('adminUserName').textContent = profile.name || 'Admin';
  document.getElementById('adminUserRole').textContent = profile.role || 'admin';
  await reloadData();
});
