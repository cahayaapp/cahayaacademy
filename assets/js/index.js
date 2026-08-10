import {
  ensureSeedData, registerUser, loginUser, fetchClasses, fetchProfile,
  state, auth, onAuthStateChanged, coverGradient, rupiah, toast
} from './core.js';

const grid = document.getElementById('landingClassGrid');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const searchInput = document.getElementById('landingSearch');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
let allClasses = [];
let activeFilter = 'all';

function courseCard(item) {
  const typeBadge = item.isPaid ? '<span class="badge paid">Berbayar</span>' : '<span class="badge free">Gratis</span>';
  const priceText = item.isPaid ? `<div class="course-price">${rupiah(item.price)}</div>` : '<div class="course-price" style="color:#0d7a52;">Gratis</div>';
  return `
    <article class="panel class-card">
      <div class="class-cover" style="background:${coverGradient(item.coverTheme)};">
        <div>
          ${typeBadge}
          <div style="margin-top:12px; font-size:26px; font-weight:800; max-width:240px;">${item.title}</div>
          <div style="margin-top:6px; opacity:.88;">${item.category} • ${item.teacherName}</div>
        </div>
      </div>
      <div class="class-body">
        <div class="class-title">${item.title}</div>
        <div class="muted" style="line-height:1.7; min-height:66px;">${item.description || ''}</div>
        <div style="margin-top:14px; display:flex; justify-content:space-between; align-items:end; gap:12px;">${priceText}<a href="#auth" class="btn small primary">Mulai</a></div>
        <div class="class-meta"><span>${item.level || 'Semua level'}</span><span>${item.category}</span></div>
      </div>
    </article>
  `;
}

function renderClasses() {
  const keyword = searchInput.value.trim().toLowerCase();
  const filtered = allClasses.filter(item => {
    const matchesFilter = activeFilter === 'all' || (activeFilter === 'free' ? !item.isPaid : item.isPaid);
    const hay = `${item.title} ${item.description} ${item.teacherName} ${item.category}`.toLowerCase();
    return matchesFilter && hay.includes(keyword);
  });
  grid.innerHTML = filtered.length ? filtered.map(courseCard).join('') : '<div class="empty-state" style="grid-column:1/-1;">Belum ada kelas yang cocok dengan pencarian Anda.</div>';
}

function activateTab(mode='login') {
  const login = mode === 'login';
  tabLogin.classList.toggle('active', login);
  tabRegister.classList.toggle('active', !login);
  loginForm.classList.toggle('hidden', !login);
  registerForm.classList.toggle('hidden', login);
}

tabLogin.addEventListener('click', ()=> activateTab('login'));
tabRegister.addEventListener('click', ()=> activateTab('register'));
searchInput.addEventListener('input', renderClasses);
filterButtons.forEach(btn => btn.addEventListener('click', () => {
  filterButtons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  renderClasses();
}));

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(loginForm);
  try {
    await loginUser(form.get('email'), form.get('password'));
    toast('Berhasil masuk. Mengalihkan...');
  } catch (err) {
    toast(err.message || 'Gagal masuk', 'error');
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(registerForm);
  const password = form.get('password');
  const confirmPassword = form.get('confirmPassword');
  if (password !== confirmPassword) {
    toast('Konfirmasi password tidak sama', 'error');
    return;
  }
  try {
    await registerUser({
      name: form.get('name'),
      email: form.get('email'),
      password,
      whatsapp: form.get('whatsapp')
    });
    toast('Akun berhasil dibuat. Mengalihkan...');
  } catch (err) {
    toast(err.message || 'Gagal mendaftar', 'error');
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const profile = await fetchProfile(user.uid);
  if (profile?.role === 'admin' || profile?.role === 'mentor') {
    window.location.href = 'pages/admin.html';
  } else {
    window.location.href = 'pages/dashboard.html';
  }
});

(async function init() {
  await ensureSeedData();
  allClasses = await fetchClasses();
  renderClasses();
})();
