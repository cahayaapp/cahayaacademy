import { registerUser, loginUser, fetchClasses, fetchProfile, fetchClassCover, fallbackCoverUrl, auth, onAuthStateChanged, rupiah, toast, escapeHtml } from './core.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const grid=$('#landingClassGrid'), search=$('#landingSearch');
const loginForm=$('#loginForm'), registerForm=$('#registerForm'), tabLogin=$('#tabLogin'), tabRegister=$('#tabRegister');
const authModal=$('#authModal');
let classes=[],filter='all';

function renderCard(c){
  const paid=Boolean(c.isPaid), fallback=fallbackCoverUrl(c);
  return `<article class="course-card" data-class-card="${c.id}">
    <div class="course-image" data-cover="${c.id}" style="background-image:url('${fallback}')">
      <span class="badge ${paid?'paid':'free'}">${paid?'Premium':'Gratis'}</span>
      <button class="bookmark-btn" aria-label="Simpan kelas">♡</button>
    </div>
    <div class="course-body">
      <h3>${escapeHtml(c.title)}</h3>
      <div class="teacher-row"><span class="teacher-avatar">${escapeHtml((c.teacherName||'U')[0])}</span><span>${escapeHtml(c.teacherName||'Pembimbing')}</span></div>
      <p>${escapeHtml(c.description||'Pelajari materi Islam secara runtut dan mudah dipahami.')}</p>
      <div class="course-info"><span>▶ ${Number(c.totalVideos||0)||'—'} Video</span><span>✓ ${Number(c.totalQuizzes||0)||'—'} Kuis</span><span>? Forum</span></div>
      <div class="course-foot"><div>${paid?`<strong>${rupiah(c.price)}</strong>`:'<strong class="green-text">Gratis</strong>'}<small>${escapeHtml(c.level||'Semua level')}</small></div><button class="btn small primary" data-open-auth="login">Mulai</button></div>
    </div>
  </article>`;
}
async function hydrateCovers(list){
  await Promise.all(list.filter(c=>c.hasCover).map(async c=>{try{const cover=await fetchClassCover(c.id);if(cover?.data){document.querySelectorAll(`[data-cover="${CSS.escape(c.id)}"]`).forEach(el=>el.style.backgroundImage=`url("${cover.data}")`);}}catch(_){}}));
}
function render(){
  const q=(search?.value||'').trim().toLowerCase();
  const list=classes.filter(c=>{const matchFilter=filter==='all'||(filter==='free'?!c.isPaid:c.isPaid);const hay=`${c.title||''} ${c.teacherName||''} ${c.category||''} ${c.description||''}`.toLowerCase();return matchFilter&&hay.includes(q);});
  grid.innerHTML=list.length?list.map(renderCard).join(''):'<div class="empty-state span-all">Belum ada kelas yang sesuai.</div>';
  $('#publicClassCount').textContent=String(classes.length);
  hydrateCovers(list);
  bindAuthOpeners();
}
function setAuthTab(mode){const login=mode==='login';tabLogin.classList.toggle('active',login);tabRegister.classList.toggle('active',!login);loginForm.classList.toggle('hidden',!login);registerForm.classList.toggle('hidden',login);}
function openAuth(mode='login'){setAuthTab(mode);authModal.classList.add('show');authModal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');setTimeout(()=>authModal.querySelector('input')?.focus(),80);}
function closeAuth(){authModal.classList.remove('show');authModal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');}
function bindAuthOpeners(){$$('[data-open-auth]').forEach(el=>{if(el.dataset.bound)return;el.dataset.bound='1';el.addEventListener('click',e=>{e.preventDefault();openAuth(el.dataset.openAuth||'login');});});}

bindAuthOpeners();
$('#closeAuthModal').addEventListener('click',closeAuth);authModal.addEventListener('click',e=>{if(e.target===authModal)closeAuth();});
tabLogin.addEventListener('click',()=>setAuthTab('login'));tabRegister.addEventListener('click',()=>setAuthTab('register'));
search?.addEventListener('input',render);
$$('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{$$('[data-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');filter=btn.dataset.filter;render();}));
$('#mobilePublicMenu')?.addEventListener('click',()=>$('#mobilePublicPanel').classList.toggle('show'));
$$('#mobilePublicPanel a').forEach(a=>a.addEventListener('click',()=>$('#mobilePublicPanel').classList.remove('show')));

loginForm.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const btn=e.currentTarget.querySelector('button[type=submit],button:not([type])');try{btn.disabled=true;btn.textContent='Memproses...';await loginUser(fd.get('email'),fd.get('password'));toast('Berhasil masuk.');}catch(err){toast(err.message||'Gagal masuk','error');}finally{btn.disabled=false;btn.textContent='Masuk ke Akun Saya';}});
registerForm.addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);if(fd.get('password')!==fd.get('confirmPassword'))return toast('Konfirmasi password tidak sama','error');const btn=e.currentTarget.querySelector('button[type=submit],button:not([type])');try{btn.disabled=true;btn.textContent='Membuat akun...';await registerUser({name:fd.get('name'),email:fd.get('email'),password:fd.get('password'),whatsapp:fd.get('whatsapp')});toast('Akun berhasil dibuat.');}catch(err){toast(err.message||'Gagal mendaftar','error');}finally{btn.disabled=false;btn.textContent='Buat Akun Pelajar';}});

onAuthStateChanged(auth,async user=>{if(!user)return;const p=await fetchProfile(user.uid);location.href=(p?.role==='admin'||p?.role==='mentor')?'pages/admin.html':'pages/dashboard.html';});
(async()=>{try{classes=await fetchClasses();render();}catch(err){console.error(err);grid.innerHTML='<div class="empty-state span-all">Katalog belum dapat dimuat. Pastikan koneksi dan Rules Firebase sudah benar.</div>';}})();
