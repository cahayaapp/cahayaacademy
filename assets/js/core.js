import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  ref,
  get,
  set,
  update,
  push,
  onValue,
  remove
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

export const state = { user:null, profile:null, classes:[], selectedClass:null, selectedVideo:null };

export const DEFAULT_SETTINGS = {
  siteName: 'belajarislam.online',
  siteTagline: 'Belajar Islam kapan saja, di mana saja.',
  payment: {
    bankName: 'Bank Syariah Indonesia (BSI)',
    accountNumber: '',
    accountName: 'belajarislam.online',
    whatsappAdmin: ''
  },
  certificate: {
    issuer: 'belajarislam.online',
    signerName: 'Admin belajarislam.online',
    signerTitle: 'Pembimbing Program'
  }
};

export function qs(sel, root=document){ return root.querySelector(sel); }
export function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
export function rupiah(num=0){ return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(num||0)); }
export function formatDate(ts){ if(!ts) return '-'; return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(ts)); }
export function initials(name=''){ return name.split(' ').filter(Boolean).slice(0,2).map(v=>v[0]?.toUpperCase()).join('') || 'BI'; }
export function slugify(text=''){ return String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
export function escapeHtml(str=''){ return String(str).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
export function normalizeWa(value=''){ let s=String(value).replace(/\D/g,''); if(s.startsWith('0')) s='62'+s.slice(1); if(!s.startsWith('62') && s) s='62'+s; return s; }
export function coverGradient(theme='emerald'){
  const map={
    emerald:'linear-gradient(135deg,#075985,#0f766e 55%,#d4a017)',
    teal:'linear-gradient(135deg,#0f766e,#0d9488 55%,#84cc16)',
    bluegold:'linear-gradient(135deg,#0c4a6e,#0369a1 55%,#d4a017)',
    darkteal:'linear-gradient(135deg,#022c22,#0f766e 55%,#d4a017)',
    purple:'linear-gradient(135deg,#4c1d95,#0f766e 60%,#eab308)',
    amber:'linear-gradient(135deg,#78350f,#0f766e 62%,#f59e0b)'
  }; return map[theme] || map.emerald;
}
export function toast(message='Berhasil',type='default'){
  const el=qs('#toast'); if(!el) return;
  el.textContent=message; el.dataset.type=type; el.classList.add('show');
  clearTimeout(window.__biToast); window.__biToast=setTimeout(()=>el.classList.remove('show'),2600);
}

export function youtubeEmbedUrl(input=''){
  const raw=String(input).trim();
  let id='';
  try{
    const u=new URL(raw);
    if(u.hostname.includes('youtu.be')) id=u.pathname.split('/').filter(Boolean)[0]||'';
    else if(u.pathname.includes('/embed/')) id=u.pathname.split('/embed/')[1]?.split('/')[0]||'';
    else if(u.pathname.includes('/shorts/')) id=u.pathname.split('/shorts/')[1]?.split('/')[0]||'';
    else id=u.searchParams.get('v')||'';
  }catch(_){ id=raw; }
  if(!id) return raw;
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1&enablejsapi=1`;
}
export function drivePreviewUrl(input=''){
  const raw=String(input).trim();
  const m=raw.match(/\/d\/([^/]+)/) || raw.match(/[?&]id=([^&]+)/);
  if(!m) return raw;
  return `https://drive.google.com/file/d/${m[1]}/preview`;
}
export function normalizeVideoUrl(sourceType,input){ return sourceType==='gdrive' ? drivePreviewUrl(input) : youtubeEmbedUrl(input); }

export async function registerUser({name,email,password,whatsapp}){
  const cred=await createUserWithEmailAndPassword(auth,email,password);
  await updateProfile(cred.user,{displayName:name});
  await set(ref(db,`users/${cred.user.uid}`),{
    uid:cred.user.uid,name:String(name).trim(),email:String(email).trim().toLowerCase(),whatsapp:normalizeWa(whatsapp),role:'student',createdAt:Date.now(),updatedAt:Date.now()
  });
  return cred.user;
}
export async function loginUser(email,password){ return (await signInWithEmailAndPassword(auth,email,password)).user; }
export async function logoutUser(){ await signOut(auth); }
export async function fetchProfile(uid){ const s=await get(ref(db,`users/${uid}`)); return s.val(); }
export async function saveProfile(uid,payload){
  const clean={...payload}; if('whatsapp' in clean) clean.whatsapp=normalizeWa(clean.whatsapp);
  await update(ref(db,`users/${uid}`),{...clean,updatedAt:Date.now()});
}
export async function setUserRole(uid,role){ await update(ref(db,`users/${uid}`),{role,updatedAt:Date.now()}); }
export async function fetchUsers(){ const s=await get(ref(db,'users')); return Object.values(s.val()||{}).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)); }

export async function fetchClasses(){
  const s=await get(ref(db,'classes')); const data=s.val()||{};
  return Object.entries(data).map(([id,v])=>({id,...v})).filter(x=>x.status!=='archived').sort((a,b)=>(a.order??999)-(b.order??999));
}
export async function fetchClass(classId){ const s=await get(ref(db,`classes/${classId}`)); return s.exists()?{id:classId,...s.val()}:null; }
export async function saveClass(payload,classId=null){
  let id=classId || payload.slug || slugify(payload.title) || `kelas-${Date.now()}`;
  let current=classId ? (await get(ref(db,`classes/${id}`))).val() : null;
  if(!classId){ const existing=await get(ref(db,`classes/${id}`)); if(existing.exists()) id=`${id}-${Date.now().toString(36).slice(-5)}`; }
  await set(ref(db,`classes/${id}`),{...(current||{}),...payload,updatedAt:Date.now(),createdAt:current?.createdAt||Date.now(),status:payload.status||current?.status||'published'});
  return id;
}
export async function archiveClass(classId){ await update(ref(db,`classes/${classId}`),{status:'archived',updatedAt:Date.now()}); }
export async function fetchVideos(classId){ const s=await get(ref(db,`videos/${classId}`)); const data=s.val()||{}; return Object.entries(data).map(([id,v])=>({id,...v})).sort((a,b)=>(a.order??999)-(b.order??999)); }
export async function saveVideo(classId,payload,videoId=null){
  const id=videoId || payload.id || `v${Date.now()}`;
  const current=videoId ? (await get(ref(db,`videos/${classId}/${id}`))).val() : null;
  const sourceType=payload.sourceType||current?.sourceType||'youtube';
  const rawUrl=payload.embedUrl||current?.embedUrl||'';
  await set(ref(db,`videos/${classId}/${id}`),{...(current||{}),...payload,sourceType,embedUrl:normalizeVideoUrl(sourceType,rawUrl),updatedAt:Date.now(),createdAt:current?.createdAt||Date.now()});
  return id;
}
export async function deleteVideo(classId,videoId){ await remove(ref(db,`videos/${classId}/${videoId}`)); }

export async function fetchEnrollment(uid,classId){ const s=await get(ref(db,`enrollments/${uid}/${classId}`)); return s.val(); }
export async function joinFreeClass(uid,classId){
  const cls=await fetchClass(classId); if(!cls) throw new Error('Kelas tidak ditemukan'); if(cls.isPaid) throw new Error('Kelas ini berbayar');
  const current=await fetchEnrollment(uid,classId); if(current) return current;
  const payload={status:'active',paymentStatus:'free',classType:'free',createdAt:Date.now(),updatedAt:Date.now()};
  await set(ref(db,`enrollments/${uid}/${classId}`),payload); return payload;
}

export function subscribeEnrollment(uid,classId,cb){
  const off=onValue(ref(db,`enrollments/${uid}/${classId}`),snap=>cb(snap.val()));
  return ()=>off();
}

export async function fetchUserEnrollments(uid){ const s=await get(ref(db,`enrollments/${uid}`)); return s.val()||{}; }
export async function fetchAllEnrollments(){ const s=await get(ref(db,'enrollments')); return s.val()||{}; }

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error('Gagal membaca gambar'));
    reader.readAsDataURL(file);
  });
}
function loadImage(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('Format gambar tidak dapat dibaca'));
    img.src=src;
  });
}
export async function uploadProof(file){
  if(!file || !String(file.type||'').startsWith('image/')) throw new Error('Bukti transfer harus berupa foto/gambar');
  if(file.size>10*1024*1024) throw new Error('Ukuran foto maksimal 10 MB sebelum kompresi');
  const original=await fileToDataUrl(file);
  const img=await loadImage(original);
  let maxSide=1500;
  let quality=.82;
  const targetChars=460000; // sekitar 340 KB file JPEG setelah Base64
  let result='';
  for(let attempt=0;attempt<10;attempt++){
    const ratio=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    const w=Math.max(1,Math.round((img.naturalWidth||img.width)*ratio));
    const h=Math.max(1,Math.round((img.naturalHeight||img.height)*ratio));
    const canvas=document.createElement('canvas');
    canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,w,h);
    ctx.drawImage(img,0,0,w,h);
    result=canvas.toDataURL('image/jpeg',quality);
    if(result.length<=targetChars) break;
    if(quality>.56) quality-=.08; else maxSide=Math.round(maxSide*.82);
  }
  if(!result || result.length>650000) throw new Error('Foto masih terlalu besar. Silakan pilih foto lain atau screenshot bukti transfer.');
  return result;
}
export async function submitPayment({uid,classId,amount,senderName,senderBank,proofData}){
  const p=push(ref(db,'payments')); const id=p.key; const now=Date.now();
  if(!proofData || !String(proofData).startsWith('data:image/jpeg;base64,')) throw new Error('Bukti transfer tidak valid');
  const payload={id,uid,classId,amount:Number(amount||0),senderName:String(senderName).trim(),senderBank:String(senderBank).trim(),hasProof:true,proofMode:'rtdb-compressed',status:'pending',createdAt:now,updatedAt:now};
  const notif=push(ref(db,'notifications/admin')).key;
  const updates={};
  updates[`payments/${id}`]=payload;
  updates[`paymentProofs/${id}`]={paymentId:id,uid,classId,data:proofData,mime:'image/jpeg',createdAt:now};
  updates[`enrollments/${uid}/${classId}`]={status:'pending_payment',paymentStatus:'pending',classType:'paid',paymentId:id,createdAt:now,updatedAt:now};
  updates[`notifications/admin/${notif}`]={type:'payment',title:'Bukti pembayaran baru',message:`${payload.senderName} mengirim bukti pembayaran.`,paymentId:id,uid,classId,read:false,createdAt:now};
  await update(ref(db),updates);
  return payload;
}
export async function fetchPaymentProof(paymentId){
  const s=await get(ref(db,`paymentProofs/${paymentId}`));
  return s.val();
}
export async function fetchAllPayments(){ const s=await get(ref(db,'payments')); return Object.values(s.val()||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); }
export async function approvePayment(paymentId){
  const s=await get(ref(db,`payments/${paymentId}`)); const p=s.val(); if(!p) throw new Error('Pembayaran tidak ditemukan');
  await update(ref(db,`payments/${paymentId}`),{status:'approved',updatedAt:Date.now()});
  await update(ref(db,`enrollments/${p.uid}/${p.classId}`),{status:'active',paymentStatus:'approved',approvedAt:Date.now(),updatedAt:Date.now()});
  await push(ref(db,`notifications/${p.uid}`),{type:'payment-approved',title:'Pembayaran disetujui',message:'Akses kelas Anda sudah aktif.',classId:p.classId,read:false,createdAt:Date.now()});
}
export async function rejectPayment(paymentId){
  const s=await get(ref(db,`payments/${paymentId}`)); const p=s.val(); if(!p) throw new Error('Pembayaran tidak ditemukan');
  await update(ref(db,`payments/${paymentId}`),{status:'rejected',updatedAt:Date.now()});
  await update(ref(db,`enrollments/${p.uid}/${p.classId}`),{status:'pending_payment',paymentStatus:'rejected',updatedAt:Date.now()});
  await push(ref(db,`notifications/${p.uid}`),{type:'payment-rejected',title:'Bukti pembayaran perlu diperiksa',message:'Silakan cek kembali bukti transfer dan kirim ulang jika diperlukan.',classId:p.classId,read:false,createdAt:Date.now()});
}

export async function fetchSettings(){ const s=await get(ref(db,'settings')); const v=s.val()||{}; return { ...DEFAULT_SETTINGS, ...v, payment:{...DEFAULT_SETTINGS.payment,...(v.payment||{})}, certificate:{...DEFAULT_SETTINGS.certificate,...(v.certificate||{})} }; }
export async function saveSettings(payload){ await update(ref(db,'settings'),payload); }

export function subscribeNotifications(path,cb){ const off=onValue(ref(db,path),s=>{ const data=s.val()||{}; cb(Object.entries(data).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))); }); return ()=>off(); }
export async function markNotifRead(basePath,id){ await update(ref(db,`${basePath}/${id}`),{read:true}); }
export async function markAllNotifRead(basePath,items=[]){ await Promise.all(items.filter(x=>!x.read).map(x=>markNotifRead(basePath,x.id))); }

export async function sendLiveChatMessage(roomId,payload){ const p=push(ref(db,`liveChats/${roomId}/messages`)); await set(p,{...payload,text:String(payload.text||'').trim(),createdAt:Date.now()}); }
export function subscribeLiveChat(roomId,cb){ const off=onValue(ref(db,`liveChats/${roomId}/messages`),s=>{ const data=s.val()||{}; cb(Object.entries(data).map(([id,v])=>({id,...v})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))); }); return ()=>off(); }

export async function submitForumPost(classId,videoId,payload){ const p=push(ref(db,`forumPosts/${classId}/${videoId}`)); await set(p,{...payload,text:String(payload.text||'').trim(),createdAt:Date.now()}); }
export function subscribeForum(classId,videoId,cb){ const off=onValue(ref(db,`forumPosts/${classId}/${videoId}`),s=>{ const data=s.val()||{}; cb(Object.entries(data).map(([id,v])=>({id,...v})).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))); }); return ()=>off(); }

export async function fetchProgress(uid,classId=null){ const s=await get(ref(db,classId?`lessonProgress/${uid}/${classId}`:`lessonProgress/${uid}`)); return s.val()||{}; }
export async function saveLessonProgress(uid,classId,videoId,payload){ await update(ref(db,`lessonProgress/${uid}/${classId}/${videoId}`),{...payload,updatedAt:Date.now()}); }
export async function markLessonComplete(uid,classId,videoId,completed=true){ await update(ref(db,`lessonProgress/${uid}/${classId}/${videoId}`),{completed,percent:completed?100:0,completedAt:completed?Date.now():null,updatedAt:Date.now()}); }
export async function fetchAllProgress(){ const s=await get(ref(db,'lessonProgress')); return s.val()||{}; }

export async function fetchQuiz(classId,videoId){ const s=await get(ref(db,`quizzes/${classId}/${videoId}`)); return s.val()||null; }
export async function fetchQuizzesForClass(classId){ const s=await get(ref(db,`quizzes/${classId}`)); return s.val()||{}; }
export async function saveQuizQuestion(classId,videoId,q,passScore=70){ const p=push(ref(db,`quizzes/${classId}/${videoId}/questions`)); await set(p,q); await update(ref(db,`quizzes/${classId}/${videoId}`),{passScore:Number(passScore||70),updatedAt:Date.now()}); return p.key; }
export async function deleteQuizQuestion(classId,videoId,qid){ await remove(ref(db,`quizzes/${classId}/${videoId}/questions/${qid}`)); }
export async function submitQuizResult(uid,classId,videoId,result){ await set(ref(db,`quizResults/${uid}/${classId}/${videoId}`),{...result,attemptedAt:Date.now()}); }
export async function fetchQuizResult(uid,classId,videoId){ const s=await get(ref(db,`quizResults/${uid}/${classId}/${videoId}`)); return s.val()||null; }
export async function fetchAllQuizResults(uid,classId=null){ const s=await get(ref(db,classId?`quizResults/${uid}/${classId}`:`quizResults/${uid}`)); return s.val()||{}; }
export async function fetchAllQuizResultsAdmin(){ const s=await get(ref(db,'quizResults')); return s.val()||{}; }

export async function fetchClassCompletion(uid,classId){
  const [videos,progress,results,quizzes]=await Promise.all([fetchVideos(classId),fetchProgress(uid,classId),fetchAllQuizResults(uid,classId),fetchQuizzesForClass(classId)]);
  if(!videos.length) return {percent:0,completedVideos:0,totalVideos:0,quizzesPassed:true,eligible:false};
  let completedVideos=0, quizzesPassed=true;
  for(const video of videos){
    const p=progress?.[video.id]||{}; if(p.completed || Number(p.percent||0)>=90) completedVideos++;
    const quiz=quizzes?.[video.id]; if(quiz?.questions && Object.keys(quiz.questions).length && !results?.[video.id]?.passed) quizzesPassed=false;
  }
  const percent=Math.round((completedVideos/videos.length)*100);
  return {percent,completedVideos,totalVideos:videos.length,quizzesPassed,eligible:completedVideos===videos.length && quizzesPassed};
}
export async function issueCertificate(uid,classId,profile,classData){
  const completion=await fetchClassCompletion(uid,classId); if(!completion.eligible) throw new Error('Syarat sertifikat belum terpenuhi');
  const r=ref(db,`certificates/${uid}/${classId}`); const existing=await get(r); if(existing.exists()) return existing.val();
  const cert={certificateId:`BIO-${Date.now().toString(36).toUpperCase()}-${uid.slice(0,5).toUpperCase()}`,uid,classId,studentName:profile.name,classTitle:classData.title,teacherName:classData.teacherName||'',issuedAt:Date.now()};
  await set(r,cert); return cert;
}
export async function fetchCertificate(uid,classId){ const s=await get(ref(db,`certificates/${uid}/${classId}`)); return s.val()||null; }

export async function logActivity(uid,payload){ const p=push(ref(db,`activities/${uid}`)); await set(p,{...payload,createdAt:Date.now()}); }
export async function fetchActivities(uid,limit=12){ const s=await get(ref(db,`activities/${uid}`)); const data=s.val()||{}; return Object.entries(data).map(([id,v])=>({id,...v})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,limit); }

export { auth, db, onAuthStateChanged, ref, get, set, update, push, remove };
