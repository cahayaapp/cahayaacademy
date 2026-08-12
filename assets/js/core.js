import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
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
    emerald:'linear-gradient(135deg,#075e54,#0f766e 55%,#f59e0b)',
    teal:'linear-gradient(135deg,#064e3b,#10b981 55%,#84cc16)',
    bluegold:'linear-gradient(135deg,#0c4a6e,#0f766e 55%,#f59e0b)',
    darkteal:'linear-gradient(135deg,#022c22,#075e54 55%,#f59e0b)',
    purple:'linear-gradient(135deg,#4c1d95,#0f766e 60%,#eab308)',
    amber:'linear-gradient(135deg,#78350f,#0f766e 62%,#f59e0b)'
  }; return map[theme] || map.emerald;
}
const FALLBACK_COVERS={
  aqidah:new URL('../img/covers/aqidah.svg',import.meta.url).href,
  fiqih:new URL('../img/covers/fiqih.svg',import.meta.url).href,
  tafsir:new URL('../img/covers/tafsir.svg',import.meta.url).href,
  adab:new URL('../img/covers/adab.svg',import.meta.url).href
};
export function fallbackCoverUrl(classData={}){
  const hay=`${classData.category||''} ${classData.title||''}`.toLowerCase();
  if(hay.includes('fiqih')||hay.includes('fikih')) return FALLBACK_COVERS.fiqih;
  if(hay.includes('tafsir')||hay.includes('qur')) return FALLBACK_COVERS.tafsir;
  if(hay.includes('adab')||hay.includes('akhlak')||hay.includes('sirah')) return FALLBACK_COVERS.adab;
  return FALLBACK_COVERS.aqidah;
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
export async function fetchProfile(uid){
  const s=await get(ref(db,`users/${uid}`));
  const data=s.val()||null;
  if(!data) return null;
  const fallbackName=auth.currentUser?.displayName||'';
  if(!data.name && fallbackName){
    try{ await update(ref(db,`users/${uid}`),{name:fallbackName,updatedAt:Date.now()}); }catch(_){}
    data.name=fallbackName;
  }
  return data;
}
export function subscribeProfile(uid,cb){ const off=onValue(ref(db,`users/${uid}`),s=>cb(s.val()||null)); return ()=>off(); }
export async function saveProfile(uid,payload){
  const clean={...payload};
  if('whatsapp' in clean) clean.whatsapp=normalizeWa(clean.whatsapp);
  if('name' in clean) clean.name=String(clean.name||'').trim();
  await update(ref(db,`users/${uid}`),{...clean,updatedAt:Date.now()});
  if(auth.currentUser && auth.currentUser.uid===uid && clean.name){
    await updateProfile(auth.currentUser,{displayName:clean.name});
  }
}
export async function changePassword(currentPassword,newPassword){
  const current=auth.currentUser;
  if(!current?.email) throw new Error('Akun tidak tersedia. Silakan login ulang.');
  if(String(newPassword||'').length<6) throw new Error('Password baru minimal 6 karakter.');
  const credential=EmailAuthProvider.credential(current.email,String(currentPassword||''));
  await reauthenticateWithCredential(current,credential);
  await updatePassword(current,String(newPassword));
}
export async function setUserRole(uid,role){ await update(ref(db,`users/${uid}`),{role,updatedAt:Date.now()}); }
export async function fetchUsers(){ const s=await get(ref(db,'users')); return Object.values(s.val()||{}).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)); }
export function subscribeUsers(cb){ const off=onValue(ref(db,'users'),s=>cb(Object.values(s.val()||{}).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)))); return ()=>off(); }

export async function fetchClasses(){
  const s=await get(ref(db,'classes')); const data=s.val()||{};
  return Object.entries(data).map(([id,v])=>({id,...v})).filter(x=>x.status!=='archived').sort((a,b)=>(a.order??999)-(b.order??999));
}
export async function fetchClass(classId){ const s=await get(ref(db,`classes/${classId}`)); return s.exists()?{id:classId,...s.val()}:null; }
export function subscribeClasses(cb){ const off=onValue(ref(db,'classes'),s=>{const data=s.val()||{};cb(Object.entries(data).map(([id,v])=>({id,...v})).filter(x=>x.status!=='archived').sort((a,b)=>(a.order??999)-(b.order??999)));}); return ()=>off(); }
export async function saveClass(payload,classId=null){
  let id=classId || payload.slug || slugify(payload.title) || `kelas-${Date.now()}`;
  let current=classId ? (await get(ref(db,`classes/${id}`))).val() : null;
  if(!classId){ const existing=await get(ref(db,`classes/${id}`)); if(existing.exists()) id=`${id}-${Date.now().toString(36).slice(-5)}`; }
  await set(ref(db,`classes/${id}`),{...(current||{}),...payload,updatedAt:Date.now(),createdAt:current?.createdAt||Date.now(),status:payload.status||current?.status||'published'});
  return id;
}
export async function archiveClass(classId){ await update(ref(db,`classes/${classId}`),{status:'archived',updatedAt:Date.now()}); }
export async function fetchClassCover(classId){ const s=await get(ref(db,`classCovers/${classId}`)); return s.val()||null; }
export async function saveClassCover(classId,dataUrl){
  if(!dataUrl || !String(dataUrl).startsWith('data:image/')) throw new Error('Cover kelas tidak valid');
  await set(ref(db,`classCovers/${classId}`),{data:dataUrl,updatedAt:Date.now()});
  await update(ref(db,`classes/${classId}`),{hasCover:true,coverUpdatedAt:Date.now(),updatedAt:Date.now()});
}
export async function deleteClassCover(classId){ await remove(ref(db,`classCovers/${classId}`)); await update(ref(db,`classes/${classId}`),{hasCover:false,coverUpdatedAt:null,updatedAt:Date.now()}); }
export async function fetchVideos(classId){
  const s=await get(ref(db,`videos/${classId}`)); const data=s.val()||{};
  return Object.entries(data).map(([id,v])=>({id,...v,embedUrl:undefined,sourceUrl:undefined})).sort((a,b)=>(a.order??999)-(b.order??999));
}
export function subscribeVideos(classId,cb){
  const off=onValue(ref(db,`videos/${classId}`),s=>{const data=s.val()||{};cb(Object.entries(data).map(([id,v])=>({id,...v,embedUrl:undefined,sourceUrl:undefined})).sort((a,b)=>(a.order??999)-(b.order??999)));});
  return ()=>off();
}
export async function fetchVideoSource(classId,videoId){
  const s=await get(ref(db,`videoSources/${classId}/${videoId}`));
  return s.val()||null;
}
export async function refreshClassStats(classId){
  const [vs,qs]=await Promise.all([get(ref(db,`videos/${classId}`)),get(ref(db,`quizzes/${classId}`))]);
  const totalVideos=Object.keys(vs.val()||{}).length;
  const totalQuizzes=Object.values(qs.val()||{}).filter(q=>q?.questions&&Object.keys(q.questions).length).length;
  await update(ref(db,`classes/${classId}`),{totalVideos,totalQuizzes,updatedAt:Date.now()});
  return {totalVideos,totalQuizzes};
}
export async function saveVideo(classId,payload,videoId=null){
  const id=videoId || payload.id || `v${Date.now()}`;
  const current=videoId ? (await get(ref(db,`videos/${classId}/${id}`))).val() : null;
  const currentSource=videoId ? (await get(ref(db,`videoSources/${classId}/${id}`))).val() : null;
  const sourceType=payload.sourceType||currentSource?.sourceType||current?.sourceType||'youtube';
  const rawUrl=String(payload.embedUrl||payload.sourceUrl||currentSource?.url||current?.embedUrl||'').trim();
  if(!rawUrl && !currentSource?.url) throw new Error('Link sumber video wajib diisi.');
  const normalized=normalizeVideoUrl(sourceType,rawUrl||currentSource.url);
  const metadata={...(current||{}),...payload,sourceType,embedUrl:null,sourceUrl:null,hasProtectedSource:true,updatedAt:Date.now(),createdAt:current?.createdAt||Date.now()};
  delete metadata.embedUrl; delete metadata.sourceUrl;
  const updates={};
  updates[`videos/${classId}/${id}`]=metadata;
  updates[`videoSources/${classId}/${id}`]={sourceType,url:normalized,updatedAt:Date.now()};
  await update(ref(db),updates);
  await refreshClassStats(classId); return id;
}
export async function deleteVideo(classId,videoId){
  const updates={}; updates[`videos/${classId}/${videoId}`]=null; updates[`videoSources/${classId}/${videoId}`]=null;
  await update(ref(db),updates); await refreshClassStats(classId);
}
export async function migrateLegacyVideoSources(){
  const classes=await fetchClasses();
  for(const c of classes){
    const s=await get(ref(db,`videos/${c.id}`)); const data=s.val()||{};
    const updates={};
    for(const [vid,v] of Object.entries(data)){
      if(v?.embedUrl){
        const st=v.sourceType||'youtube';
        updates[`videoSources/${c.id}/${vid}`]={sourceType:st,url:normalizeVideoUrl(st,v.embedUrl),updatedAt:Date.now()};
        const clean={...v,hasProtectedSource:true,updatedAt:Date.now()}; delete clean.embedUrl; delete clean.sourceUrl;
        updates[`videos/${c.id}/${vid}`]=clean;
      }
    }
    if(Object.keys(updates).length) await update(ref(db),updates);
  }
}

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
export function subscribeUserEnrollments(uid,cb){ const off=onValue(ref(db,`enrollments/${uid}`),s=>cb(s.val()||{})); return ()=>off(); }
export async function saveRecentLearning(uid,classId,videoId){ await set(ref(db,`recentLearning/${uid}`),{classId,videoId,updatedAt:Date.now()}); }
export async function fetchRecentLearning(uid){ const s=await get(ref(db,`recentLearning/${uid}`)); return s.val()||null; }
export function subscribeRecentLearning(uid,cb){ const off=onValue(ref(db,`recentLearning/${uid}`),s=>cb(s.val()||null)); return ()=>off(); }
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
async function blobToDataUrl(blob){
  return await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error('Gagal membaca hasil kompresi gambar'));
    reader.readAsDataURL(blob);
  });
}
async function canvasToBlob(canvas,mime,quality){
  return await new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Browser gagal mengompresi gambar')),mime,quality);
  });
}
async function compressImage(file,{maxBytes=360000,targetWidth=null,targetHeight=null,maxSide=1500,quality=.84,aspectRatio=null,mime='image/jpeg'}={}){
  if(!file || !String(file.type||'').startsWith('image/')) throw new Error('File harus berupa gambar');
  if(file.size>25*1024*1024) throw new Error('Ukuran file awal maksimal 25 MB. Pilih gambar yang lebih kecil.');
  const original=await fileToDataUrl(file);
  const img=await loadImage(original);
  const iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height;
  let sx=0,sy=0,sw=iw,sh=ih;
  if(aspectRatio){
    const srcRatio=iw/ih;
    if(srcRatio>aspectRatio){ sw=Math.round(ih*aspectRatio); sx=Math.round((iw-sw)/2); }
    else if(srcRatio<aspectRatio){ sh=Math.round(iw/aspectRatio); sy=Math.round((ih-sh)/2); }
  }
  let w,h;
  if(targetWidth && targetHeight){
    w=Math.min(targetWidth,sw);
    h=Math.min(targetHeight,Math.round(w/(aspectRatio||sw/sh)));
    if(aspectRatio) h=Math.round(w/aspectRatio);
  }else{
    const scale=Math.min(1,maxSide/Math.max(sw,sh));
    w=Math.max(1,Math.round(sw*scale));
    h=Math.max(1,Math.round(sh*scale));
  }
  const minimumWidth=aspectRatio?640:520;
  let q=quality, bestBlob=null;
  for(let attempt=0;attempt<18;attempt++){
    const canvas=document.createElement('canvas');
    canvas.width=w; canvas.height=h;
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.fillStyle='#ffffff';
    ctx.fillRect(0,0,w,h);
    ctx.drawImage(img,sx,sy,sw,sh,0,0,w,h);
    let blob;
    try{ blob=await canvasToBlob(canvas,mime,q); }
    catch(_){ blob=await canvasToBlob(canvas,'image/jpeg',q); mime='image/jpeg'; }
    bestBlob=blob;
    if(blob.size<=maxBytes) break;
    if(q>0.54){ q=Math.max(0.54,q-0.06); }
    else if(w>minimumWidth){
      w=Math.max(minimumWidth,Math.round(w*0.88));
      h=aspectRatio?Math.round(w/aspectRatio):Math.max(1,Math.round(h*0.88));
      q=0.72;
    }else break;
  }
  if(!bestBlob || bestBlob.size>maxBytes*1.15) throw new Error('Gambar tidak dapat dioptimalkan ke ukuran web. Coba gunakan JPG/PNG/WebP lain.');
  return await blobToDataUrl(bestBlob);
}
export async function compressClassCover(file){
  return compressImage(file,{maxBytes:180000,targetWidth:960,targetHeight:540,quality:.80,aspectRatio:16/9,mime:'image/jpeg'});
}
export async function uploadProof(file){ return compressImage(file,{maxBytes:340000,maxSide:1500,quality:.82}); }
export async function submitPurchasePayment({uid,itemType='class',itemId,classId,amount,senderName,senderBank,proofData}){
  const resolvedId=itemId||classId; if(!resolvedId) throw new Error('Produk tidak ditemukan');
  const p=push(ref(db,'payments')); const id=p.key; const now=Date.now();
  if(!proofData || !String(proofData).startsWith('data:image/jpeg;base64,')) throw new Error('Bukti transfer tidak valid');
  const payload={id,uid,itemType,itemId:resolvedId,classId:itemType==='class'?resolvedId:null,ebookId:itemType==='ebook'?resolvedId:null,amount:Number(amount||0),senderName:String(senderName).trim(),senderBank:String(senderBank).trim(),hasProof:true,proofMode:'rtdb-compressed',status:'pending',createdAt:now,updatedAt:now};
  const notif=push(ref(db,'notifications/admin')).key;
  const updates={};
  updates[`payments/${id}`]=payload;
  updates[`paymentProofs/${id}`]={paymentId:id,uid,itemType,itemId:resolvedId,data:proofData,mime:'image/jpeg',createdAt:now};
  if(itemType==='ebook') updates[`ebookAccess/${uid}/${resolvedId}`]={status:'pending_payment',paymentStatus:'pending',paymentId:id,createdAt:now,updatedAt:now};
  else updates[`enrollments/${uid}/${resolvedId}`]={status:'pending_payment',paymentStatus:'pending',classType:'paid',paymentId:id,createdAt:now,updatedAt:now};
  updates[`notifications/admin/${notif}`]={type:'payment',title:'Bukti pembayaran baru',message:`${payload.senderName} mengirim bukti pembayaran ${itemType==='ebook'?'ebook':'kelas'}.`,paymentId:id,uid,itemType,itemId:resolvedId,read:false,createdAt:now};
  await update(ref(db),updates);
  return payload;
}
export async function submitPayment(args){ return submitPurchasePayment({...args,itemType:'class',itemId:args.classId}); }
export async function fetchPaymentProof(paymentId){
  const s=await get(ref(db,`paymentProofs/${paymentId}`));
  return s.val();
}
export async function fetchAllPayments(){ const s=await get(ref(db,'payments')); return Object.values(s.val()||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); }
export async function approvePayment(paymentId){
  const s=await get(ref(db,`payments/${paymentId}`)); const p=s.val(); if(!p) throw new Error('Pembayaran tidak ditemukan');
  const itemType=p.itemType||'class', itemId=p.itemId||p.ebookId||p.classId; const now=Date.now();
  const updates={}; updates[`payments/${paymentId}/status`]='approved'; updates[`payments/${paymentId}/updatedAt`]=now;
  if(itemType==='ebook') updates[`ebookAccess/${p.uid}/${itemId}`]={status:'active',paymentStatus:'approved',paymentId,approvedAt:now,updatedAt:now};
  else updates[`enrollments/${p.uid}/${itemId}`]={status:'active',paymentStatus:'approved',classType:'paid',paymentId,approvedAt:now,updatedAt:now};
  const nid=push(ref(db,`notifications/${p.uid}`)).key;
  updates[`notifications/${p.uid}/${nid}`]={type:'payment-approved',title:'Pembayaran disetujui',message:itemType==='ebook'?'Ebook Anda sudah dapat diunduh.':'Akses kelas Anda sudah aktif.',itemType,itemId,classId:itemType==='class'?itemId:null,ebookId:itemType==='ebook'?itemId:null,read:false,createdAt:now};
  await update(ref(db),updates);
}
export async function rejectPayment(paymentId){
  const s=await get(ref(db,`payments/${paymentId}`)); const p=s.val(); if(!p) throw new Error('Pembayaran tidak ditemukan');
  const itemType=p.itemType||'class', itemId=p.itemId||p.ebookId||p.classId; const now=Date.now();
  const updates={}; updates[`payments/${paymentId}/status`]='rejected'; updates[`payments/${paymentId}/updatedAt`]=now;
  if(itemType==='ebook') updates[`ebookAccess/${p.uid}/${itemId}`]={status:'pending_payment',paymentStatus:'rejected',paymentId,updatedAt:now};
  else updates[`enrollments/${p.uid}/${itemId}`]={status:'pending_payment',paymentStatus:'rejected',classType:'paid',paymentId,updatedAt:now};
  const nid=push(ref(db,`notifications/${p.uid}`)).key;
  updates[`notifications/${p.uid}/${nid}`]={type:'payment-rejected',title:'Bukti pembayaran perlu diperiksa',message:'Silakan cek kembali bukti transfer dan kirim ulang jika diperlukan.',itemType,itemId,read:false,createdAt:now};
  await update(ref(db),updates);
}
export async function repairApprovedPurchases(){
  const payments=await fetchAllPayments(); const updates={};
  for(const p of payments.filter(x=>x.status==='approved')){
    const itemType=p.itemType||'class', itemId=p.itemId||p.ebookId||p.classId; if(!p.uid||!itemId) continue;
    if(itemType==='ebook') updates[`ebookAccess/${p.uid}/${itemId}`]={status:'active',paymentStatus:'approved',paymentId:p.id,approvedAt:p.updatedAt||p.createdAt||Date.now(),updatedAt:Date.now()};
    else updates[`enrollments/${p.uid}/${itemId}`]={status:'active',paymentStatus:'approved',classType:'paid',paymentId:p.id,approvedAt:p.updatedAt||p.createdAt||Date.now(),updatedAt:Date.now()};
  }
  if(Object.keys(updates).length) await update(ref(db),updates);
}

export async function fetchEbooks(){ const s=await get(ref(db,'ebooks')); const data=s.val()||{}; return Object.entries(data).map(([id,v])=>({id,...v})).filter(x=>x.status!=='archived').sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); }
export async function fetchEbook(ebookId){ const s=await get(ref(db,`ebooks/${ebookId}`)); return s.exists()?{id:ebookId,...s.val()}:null; }
export function subscribeEbooks(cb){ const off=onValue(ref(db,'ebooks'),s=>{const data=s.val()||{};cb(Object.entries(data).map(([id,v])=>({id,...v})).filter(x=>x.status!=='archived').sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)));}); return ()=>off(); }
export async function saveEbook(payload,ebookId=null){
  let id=ebookId||payload.slug||slugify(payload.title)||`ebook-${Date.now()}`; const current=ebookId?(await get(ref(db,`ebooks/${id}`))).val():null;
  if(!ebookId){const ex=await get(ref(db,`ebooks/${id}`)); if(ex.exists()) id=`${id}-${Date.now().toString(36).slice(-5)}`;}
  await set(ref(db,`ebooks/${id}`),{...(current||{}),...payload,productType:'ebook',updatedAt:Date.now(),createdAt:current?.createdAt||Date.now(),status:payload.status||current?.status||'published'}); return id;
}
export async function archiveEbook(ebookId){ await update(ref(db,`ebooks/${ebookId}`),{status:'archived',updatedAt:Date.now()}); }
export async function fetchEbookCover(ebookId){ const s=await get(ref(db,`ebookCovers/${ebookId}`)); return s.val()||null; }
export async function saveEbookCover(ebookId,dataUrl){ if(!String(dataUrl||'').startsWith('data:image/')) throw new Error('Cover ebook tidak valid'); await set(ref(db,`ebookCovers/${ebookId}`),{data:dataUrl,updatedAt:Date.now()}); await update(ref(db,`ebooks/${ebookId}`),{hasCover:true,coverUpdatedAt:Date.now(),updatedAt:Date.now()}); }
export async function deleteEbookCover(ebookId){ await remove(ref(db,`ebookCovers/${ebookId}`)); await update(ref(db,`ebooks/${ebookId}`),{hasCover:false,coverUpdatedAt:null,updatedAt:Date.now()}); }
export async function compressEbookCover(file){ return compressImage(file,{maxBytes:180000,targetWidth:960,targetHeight:540,quality:.80,aspectRatio:16/9,mime:'image/jpeg'}); }
export async function encodeEbookPdf(file){
  if(!file || file.type!=='application/pdf') throw new Error('File ebook harus PDF.');
  if(file.size>5*1024*1024) throw new Error('Ukuran PDF maksimal 5 MB pada mode tanpa Firebase Storage.');
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Gagal membaca PDF'));r.readAsDataURL(file);});
  return {data,fileName:file.name,size:file.size,mime:'application/pdf'};
}
export function extractGoogleDriveFileId(input=''){
  const value=String(input||'').trim();
  if(!value) return '';
  if(/^[A-Za-z0-9_-]{15,}$/.test(value)) return value;
  const patterns=[/\/file\/d\/([A-Za-z0-9_-]+)/i,/[?&]id=([A-Za-z0-9_-]+)/i,/\/d\/([A-Za-z0-9_-]+)/i];
  for(const pattern of patterns){ const match=value.match(pattern); if(match?.[1]) return match[1]; }
  return '';
}
export async function saveEbookFile(ebookId,filePayload){
  if(!String(filePayload?.data||'').startsWith('data:application/pdf;base64,')) throw new Error('File PDF tidak valid');
  await set(ref(db,`ebookFiles/${ebookId}`),{...filePayload,updatedAt:Date.now()});
  await remove(ref(db,`ebookSources/${ebookId}`));
  await update(ref(db,`ebooks/${ebookId}`),{hasFile:true,fileMode:'firebase',fileName:filePayload.fileName||'ebook.pdf',fileSize:filePayload.size||0,updatedAt:Date.now()});
}
export async function saveEbookDriveSource(ebookId,driveLinkOrId,fileName='ebook.pdf'){
  const fileId=extractGoogleDriveFileId(driveLinkOrId);
  if(!fileId) throw new Error('Link Google Drive tidak valid. Gunakan link file PDF Google Drive atau File ID.');
  await set(ref(db,`ebookSources/${ebookId}`),{mode:'gdrive',fileId,updatedAt:Date.now()});
  await remove(ref(db,`ebookFiles/${ebookId}`));
  await update(ref(db,`ebooks/${ebookId}`),{hasFile:true,fileMode:'gdrive',fileName:String(fileName||'ebook.pdf').trim()||'ebook.pdf',fileSize:null,updatedAt:Date.now()});
}
export async function fetchEbookFile(ebookId){ const s=await get(ref(db,`ebookFiles/${ebookId}`)); return s.val()||null; }
export async function fetchEbookSource(ebookId){ const s=await get(ref(db,`ebookSources/${ebookId}`)); return s.val()||null; }
export async function fetchUserEbookAccess(uid){ const s=await get(ref(db,`ebookAccess/${uid}`)); return s.val()||{}; }
export function subscribeUserEbookAccess(uid,cb){ const off=onValue(ref(db,`ebookAccess/${uid}`),s=>cb(s.val()||{})); return ()=>off(); }
export async function acquireFreeEbook(uid,ebookId){ const book=await fetchEbook(ebookId); if(!book) throw new Error('Ebook tidak ditemukan'); if(book.isPaid) throw new Error('Ebook ini berbayar'); const payload={status:'active',paymentStatus:'free',createdAt:Date.now(),updatedAt:Date.now()}; await set(ref(db,`ebookAccess/${uid}/${ebookId}`),payload); return payload; }

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
export function subscribeProgress(uid,classId,cb){ const off=onValue(ref(db,`lessonProgress/${uid}/${classId}`),s=>cb(s.val()||{})); return ()=>off(); }
export async function markLessonComplete(uid,classId,videoId,completed=true){ await update(ref(db,`lessonProgress/${uid}/${classId}/${videoId}`),{completed,percent:completed?100:0,completedAt:completed?Date.now():null,updatedAt:Date.now()}); }
export async function fetchAllProgress(){ const s=await get(ref(db,'lessonProgress')); return s.val()||{}; }

export async function fetchQuiz(classId,videoId){ const s=await get(ref(db,`quizzes/${classId}/${videoId}`)); return s.val()||null; }
export async function fetchQuizzesForClass(classId){ const s=await get(ref(db,`quizzes/${classId}`)); return s.val()||{}; }
export async function saveQuizQuestion(classId,videoId,q,passScore=70){ const p=push(ref(db,`quizzes/${classId}/${videoId}/questions`)); await set(p,q); await update(ref(db,`quizzes/${classId}/${videoId}`),{passScore:Number(passScore||70),updatedAt:Date.now()}); await refreshClassStats(classId); return p.key; }
export async function deleteQuizQuestion(classId,videoId,qid){ await remove(ref(db,`quizzes/${classId}/${videoId}/questions/${qid}`)); await refreshClassStats(classId); }
export async function submitQuizResult(uid,classId,videoId,result){ await set(ref(db,`quizResults/${uid}/${classId}/${videoId}`),{...result,attemptedAt:Date.now()}); }
export async function fetchQuizResult(uid,classId,videoId){ const s=await get(ref(db,`quizResults/${uid}/${classId}/${videoId}`)); return s.val()||null; }
export function subscribeQuizResult(uid,classId,videoId,cb){ const off=onValue(ref(db,`quizResults/${uid}/${classId}/${videoId}`),s=>cb(s.val()||null)); return ()=>off(); }
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
export async function fetchCertificates(uid){ const s=await get(ref(db,`certificates/${uid}`)); return s.val()||{}; }
export function subscribeCertificates(uid,cb){ const off=onValue(ref(db,`certificates/${uid}`),s=>cb(s.val()||{})); return ()=>off(); }

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
