import { registerUser, loginUser, fetchClasses, fetchProfile, auth, onAuthStateChanged, coverGradient, rupiah, toast, escapeHtml } from './core.js';

const grid=document.getElementById('landingClassGrid');
const loginForm=document.getElementById('loginForm');
const registerForm=document.getElementById('registerForm');
const tabLogin=document.getElementById('tabLogin');
const tabRegister=document.getElementById('tabRegister');
const searchInput=document.getElementById('landingSearch');
const filterButtons=[...document.querySelectorAll('[data-filter]')];
let allClasses=[],activeFilter='all';

function card(item){
  const paid=Boolean(item.isPaid);
  return `<article class="panel class-card">
    <div class="class-cover" style="background:${coverGradient(item.coverTheme)};"><div>
      <span class="badge ${paid?'paid':'free'}">${paid?'Berbayar':'Gratis'}</span>
      <div class="cover-title">${escapeHtml(item.title)}</div>
      <div class="cover-meta">${escapeHtml(item.category||'Kelas Islam')} • ${escapeHtml(item.teacherName||'Pembimbing')}</div>
    </div></div>
    <div class="class-body">
      <div class="class-title">${escapeHtml(item.title)}</div>
      <div class="muted class-desc">${escapeHtml(item.description||'')}</div>
      <div class="card-footer-row">
        <div>${paid?`<div class="course-price">${rupiah(item.price)}</div>`:'<div class="course-price free-price">Gratis</div>'}<div class="muted mini">${escapeHtml(item.level||'Semua level')}</div></div>
        <a href="#auth" class="btn small primary">Mulai Belajar</a>
      </div>
    </div>
  </article>`;
}
function render(){
  const q=searchInput.value.trim().toLowerCase();
  const list=allClasses.filter(x=>{
    const filter=activeFilter==='all'||(activeFilter==='free'?!x.isPaid:x.isPaid);
    const hay=`${x.title||''} ${x.description||''} ${x.category||''} ${x.teacherName||''}`.toLowerCase();
    return filter&&hay.includes(q);
  });
  grid.innerHTML=list.length?list.map(card).join(''):'<div class="empty-state span-all">Belum ada kelas yang sesuai.</div>';
  const count=document.getElementById('publicClassCount'); if(count) count.textContent=String(allClasses.length);
}
function tab(mode){ const login=mode==='login'; tabLogin.classList.toggle('active',login); tabRegister.classList.toggle('active',!login); loginForm.classList.toggle('hidden',!login); registerForm.classList.toggle('hidden',login); }
tabLogin.addEventListener('click',()=>tab('login')); tabRegister.addEventListener('click',()=>tab('register'));
searchInput.addEventListener('input',render);
filterButtons.forEach(btn=>btn.addEventListener('click',()=>{filterButtons.forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeFilter=btn.dataset.filter;render();}));
loginForm.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(loginForm);try{await loginUser(f.get('email'),f.get('password'));toast('Berhasil masuk.');}catch(err){toast(err.message||'Gagal masuk','error');}});
registerForm.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(registerForm);if(f.get('password')!==f.get('confirmPassword'))return toast('Konfirmasi password tidak sama','error');try{await registerUser({name:f.get('name'),email:f.get('email'),password:f.get('password'),whatsapp:f.get('whatsapp')});toast('Akun berhasil dibuat.');}catch(err){toast(err.message||'Gagal mendaftar','error');}});
onAuthStateChanged(auth,async user=>{if(!user)return;const p=await fetchProfile(user.uid);window.location.href=(p?.role==='admin'||p?.role==='mentor')?'pages/admin.html':'pages/dashboard.html';});
(async()=>{try{allClasses=await fetchClasses();render();}catch(err){grid.innerHTML='<div class="empty-state span-all">Katalog belum dapat dimuat. Pastikan Rules Firebase sudah diperbarui.</div>';}})();
