import {
  auth,onAuthStateChanged,fetchProfile,fetchClasses,fetchUserEnrollments,joinFreeClass,
  fetchVideos,fetchProgress,fetchClassCompletion,fetchActivities,logActivity,
  logoutUser,coverGradient,rupiah,initials,toast,escapeHtml,
  subscribeNotifications,markAllNotifRead,subscribeLiveChat,sendLiveChatMessage,saveProfile
} from './core.js';

const sections=[...document.querySelectorAll('main section')];
const navLinks=[...document.querySelectorAll('[data-section]')];
const triggers=[...document.querySelectorAll('[data-section-trigger]')];
const classGrid=document.getElementById('dashboardClassGrid');
const myClassGrid=document.getElementById('myClassGrid');
const continueLearning=document.getElementById('continueLearning');
const activityList=document.getElementById('activityList');
const searchInput=document.getElementById('dashSearch');
const filterButtons=[...document.querySelectorAll('#catalogSection [data-filter]')];
let user,profile,classes=[],enrollments={},notifications=[],activeFilter='all',chatUnsub=null,completionByClass={};

function switchSection(id){
  sections.forEach(s=>s.classList.toggle('hidden',s.id!==id));
  navLinks.forEach(a=>a.classList.toggle('active',a.dataset.section===id));
  history.replaceState(null,'',`#${id.replace('Section','')}`);
  window.scrollTo({top:0,behavior:'smooth'});
}
navLinks.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();switchSection(a.dataset.section);}));
triggers.forEach(b=>b.addEventListener('click',()=>switchSection(b.dataset.sectionTrigger)));
document.getElementById('mobileChatFab')?.addEventListener('click',()=>switchSection('chatSection'));

function courseCard(c){
  const e=enrollments[c.id]; const completion=completionByClass[c.id]; const paid=Boolean(c.isPaid);
  const active=e?.status==='active'; const pending=e?.paymentStatus==='pending';
  let status=active?'Akses aktif':pending?'Menunggu verifikasi':paid?'Belum dibeli':'Gratis';
  let cta=active?'Buka Kelas':paid?'Lihat Kelas':'Ambil Gratis';
  return `<article class="panel class-card">
    <div class="class-cover" style="background:${coverGradient(c.coverTheme)}"><div><span class="badge ${paid?'paid':'free'}">${paid?'Berbayar':'Gratis'}</span><div class="cover-title">${escapeHtml(c.title)}</div><div class="cover-meta">${escapeHtml(c.teacherName||'Pembimbing')}</div></div></div>
    <div class="class-body"><div class="class-title">${escapeHtml(c.title)}</div><div class="muted class-desc">${escapeHtml(c.description||'')}</div>
      ${completion?.totalVideos?`<div class="course-progress-line"><div class="progress-track"><span style="width:${completion.percent}%"></span></div><strong>${completion.percent}%</strong></div>`:''}
      <div class="card-footer-row"><div>${paid?`<div class="course-price">${rupiah(c.price)}</div>`:'<div class="course-price free-price">Gratis</div>'}<div class="muted mini">${status}</div></div><button class="btn small primary course-cta" data-course="${c.id}" data-paid="${paid?1:0}">${cta}</button></div>
    </div></article>`;
}

function attachCourseActions(root){
  root.querySelectorAll('.course-cta').forEach(btn=>btn.addEventListener('click',async()=>{
    const c=classes.find(x=>x.id===btn.dataset.course); if(!c)return;
    try{
      if(!c.isPaid && !enrollments[c.id]){ await joinFreeClass(user.uid,c.id); enrollments=await fetchUserEnrollments(user.uid); await logActivity(user.uid,{type:'enrollment',title:`Mengambil kelas ${c.title}`}); }
      window.location.href=`class.html?class=${encodeURIComponent(c.id)}`;
    }catch(err){toast(err.message||'Gagal membuka kelas','error');}
  }));
}
function renderCatalog(){
  const q=(searchInput?.value||'').trim().toLowerCase();
  const list=classes.filter(c=>{const f=activeFilter==='all'||(activeFilter==='free'?!c.isPaid:c.isPaid);const hay=`${c.title} ${c.description||''} ${c.category||''} ${c.teacherName||''}`.toLowerCase();return f&&hay.includes(q);});
  classGrid.innerHTML=list.length?list.map(courseCard).join(''):'<div class="empty-state span-all">Tidak ada kelas yang cocok.</div>'; attachCourseActions(classGrid);
}
function renderMyClasses(){
  const mine=classes.filter(c=>enrollments[c.id]);
  myClassGrid.innerHTML=mine.length?mine.map(courseCard).join(''):'<div class="empty-state span-all">Belum ada kelas yang Anda ambil. Jelajahi katalog dan mulai dari kelas gratis.</div>'; attachCourseActions(myClassGrid);
}
async function renderContinue(){
  const mine=classes.filter(c=>enrollments[c.id]?.status==='active');
  if(!mine.length){continueLearning.innerHTML='<div class="empty-state">Belum ada kelas aktif.</div>';return;}
  const rows=[];
  for(const c of mine.slice(0,4)){
    const vids=await fetchVideos(c.id); const prog=await fetchProgress(user.uid,c.id); const next=vids.find(v=>!(prog[v.id]?.completed||Number(prog[v.id]?.percent||0)>=90))||vids[vids.length-1];
    rows.push(`<div class="lesson-item continue-row"><div class="mini-cover" style="background:${coverGradient(c.coverTheme)}"></div><div class="grow"><strong>${escapeHtml(c.title)}</strong><div class="muted">${escapeHtml(next?.title||'Materi tersedia')}</div><div class="progress-track compact"><span style="width:${completionByClass[c.id]?.percent||0}%"></span></div></div><a class="btn small primary" href="class.html?class=${encodeURIComponent(c.id)}">Lanjutkan</a></div>`);
  }
  continueLearning.innerHTML=rows.join('');
}
async function renderActivities(){
  const items=await fetchActivities(user.uid,8);
  if(!items.length){activityList.innerHTML='<div class="empty-state">Aktivitas belajar akan muncul di sini setelah Anda mulai mengikuti kelas.</div>';return;}
  activityList.innerHTML=items.map(x=>`<div class="lesson-item"><strong>${escapeHtml(x.title||'Aktivitas')}</strong><div class="muted mini">${new Date(x.createdAt).toLocaleString('id-ID')}</div></div>`).join('');
}
function renderProfile(){
  document.getElementById('sideUserName').textContent=profile.name||'Pelajar'; document.getElementById('sideUserEmail').textContent=profile.email||'-';
  document.getElementById('heroUserName').textContent=(profile.name||'Pelajar').split(' ')[0];
  document.getElementById('profileName').value=profile.name||''; document.getElementById('profileEmail').value=profile.email||''; document.getElementById('profileWhatsApp').value=profile.whatsapp||''; document.getElementById('profileBio').value=profile.bio||'';
  if(['admin','mentor'].includes(profile.role)) document.getElementById('goAdminBtn').style.display='inline-flex';
  const initialsEl=document.getElementById('mobileUserInitials'); if(initialsEl) initialsEl.textContent=initials(profile.name);
}
function renderLearningSummary(){
  const active=Object.values(completionByClass).filter(x=>x.totalVideos>0); const avg=active.length?Math.round(active.reduce((a,b)=>a+b.percent,0)/active.length):0;
  const ring=document.querySelector('.progress-ring'); if(ring) ring.style.background=`conic-gradient(var(--accent) ${avg}%, var(--ring-rest) 0)`;
  document.getElementById('progressValue').textContent=`${avg}%`;
  const activeCount=Object.values(enrollments).filter(x=>x.status==='active').length;
  const completedCount=Object.values(completionByClass).filter(x=>x.eligible).length;
  document.getElementById('weeklySummaryText').textContent=`${activeCount} kelas aktif • ${completedCount} kelas tuntas`;
  document.getElementById('weeklySummarySub').textContent=avg?`Rata-rata progres seluruh kelas ${avg}%.`:'Mulai kelas pertama Anda hari ini.';
}
function renderNotifications(){
  const unread=notifications.filter(n=>!n.read).length; document.getElementById('notifCount').textContent=unread;
  const m=document.getElementById('notificationList'); if(m) m.innerHTML=notifications.length?notifications.slice(0,20).map(n=>`<div class="notif-item ${n.read?'':'unread'}"><strong>${escapeHtml(n.title||'Notifikasi')}</strong><div>${escapeHtml(n.message||'')}</div><small>${new Date(n.createdAt||Date.now()).toLocaleString('id-ID')}</small></div>`).join(''):'<div class="empty-state">Belum ada notifikasi.</div>';
}
function toggleNotif(show){ document.getElementById('notificationModal')?.classList.toggle('show',show); }

document.getElementById('notifBtn').addEventListener('click',()=>toggleNotif(true));
document.getElementById('closeNotifBtn')?.addEventListener('click',()=>toggleNotif(false));
document.getElementById('markAllNotifBtn')?.addEventListener('click',async()=>{await markAllNotifRead(`notifications/${user.uid}`,notifications);toggleNotif(false);});
document.getElementById('notificationModal')?.addEventListener('click',e=>{if(e.target.id==='notificationModal')toggleNotif(false);});

function renderChat(items){
  const box=document.getElementById('chatMessages'); box.innerHTML=items.length?items.map(x=>`<div class="chat-item message-row ${x.uid===user.uid?'mine':''}"><div class="avatar">${initials(x.name)}</div><div class="message-bubble"><div class="forum-meta"><strong>${escapeHtml(x.name)}</strong><span class="badge ${['admin','mentor'].includes(x.role)?'mentor':'student'}">${['admin','mentor'].includes(x.role)?'Admin/Pembimbing':'Peserta'}</span></div><div class="forum-content">${escapeHtml(x.text)}</div><div class="muted mini">${new Date(x.createdAt||Date.now()).toLocaleString('id-ID')}</div></div></div>`).join(''):'<div class="empty-state">Belum ada pesan. Silakan mulai percakapan.</div>'; box.scrollTop=box.scrollHeight;
}

document.getElementById('profileForm').addEventListener('submit',async e=>{e.preventDefault();try{const payload={name:document.getElementById('profileName').value.trim(),whatsapp:document.getElementById('profileWhatsApp').value.trim(),bio:document.getElementById('profileBio').value.trim()};await saveProfile(user.uid,payload);profile={...profile,...payload};renderProfile();toast('Profil berhasil diperbarui');}catch(err){toast(err.message||'Gagal menyimpan profil','error');}});
document.getElementById('sendChatBtn').addEventListener('click',async()=>{const input=document.getElementById('chatInput');const text=input.value.trim();if(!text)return;try{await sendLiveChatMessage(`member_${user.uid}`,{uid:user.uid,name:profile.name,role:profile.role||'student',text});input.value='';}catch(err){toast(err.message||'Gagal mengirim pesan','error');}});
const doLogout=async()=>{await logoutUser();window.location.href='../index.html';};document.getElementById('logoutBtn').addEventListener('click',doLogout);document.getElementById('logoutProfileBtn')?.addEventListener('click',doLogout);
searchInput.addEventListener('input',renderCatalog); filterButtons.forEach(btn=>btn.addEventListener('click',()=>{filterButtons.forEach(b=>b.classList.remove('active'));btn.classList.add('active');activeFilter=btn.dataset.filter;renderCatalog();}));

async function initData(){
  classes=await fetchClasses(); enrollments=await fetchUserEnrollments(user.uid); completionByClass={};
  for(const c of classes){ if(enrollments[c.id]?.status==='active') completionByClass[c.id]=await fetchClassCompletion(user.uid,c.id); }
  renderProfile(); renderLearningSummary(); renderCatalog(); renderMyClasses(); await renderContinue(); await renderActivities();
  subscribeNotifications(`notifications/${user.uid}`,items=>{notifications=items;renderNotifications();});
  chatUnsub=subscribeLiveChat(`member_${user.uid}`,renderChat);
}

onAuthStateChanged(auth,async u=>{if(!u){window.location.href='../index.html';return;}user=u;profile=await fetchProfile(u.uid);if(!profile){window.location.href='../index.html';return;}await initData();const hash=location.hash.replace('#','');const map={home:'homeSection',catalog:'catalogSection',myclasses:'myClassSection',chat:'chatSection',profile:'profileSection'};if(map[hash])switchSection(map[hash]);});
