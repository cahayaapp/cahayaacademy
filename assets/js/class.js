import {
  auth,onAuthStateChanged,fetchProfile,fetchClass,fetchVideos,subscribeVideos,fetchVideoSource,fetchEnrollment,joinFreeClass,subscribeEnrollment,
  fetchSettings,uploadProof,submitPayment,subscribeForum,submitForumPost,logoutUser,
  initials,toast,rupiah,escapeHtml,fetchProgress,saveLessonProgress,markLessonComplete,subscribeProgress,
  fetchQuiz,fetchQuizResult,submitQuizResult,fetchClassCompletion,logActivity,normalizeWa,saveRecentLearning
} from './core.js';

const $=id=>document.getElementById(id);
const qs=s=>document.querySelector(s);
const classId=new URLSearchParams(location.search).get('class');
const requestedVideoId=new URLSearchParams(location.search).get('video');
let user,profile,classData,videos=[],video,enrollment,settings,progressMap={},quizData,quizResult;
let forumUnsub,enrollmentUnsub,progressUnsub,videoListUnsub,replyingTo=null,ytPlayer=null,progressTimer=null,uiTimer=null,currentVideoSource=null;
let ytApiPromise;

function hasAccess(){return !classData?.isPaid||enrollment?.status==='active'||['admin','mentor'].includes(profile?.role);}
function switchTab(id){document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('hidden',p.id!==id));}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));

function ytId(url=''){
  const raw=String(url||'');
  const m=raw.match(/\/embed\/([^?&/]+)/)||raw.match(/youtu\.be\/([^?&/]+)/)||raw.match(/[?&]v=([^?&/]+)/);
  return m?.[1]||'';
}
function loadYT(){
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(ytApiPromise)return ytApiPromise;
  ytApiPromise=new Promise(resolve=>{
    const previous=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{try{previous?.();}catch(_){}resolve(window.YT);};
    const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';s.async=true;document.head.appendChild(s);
  });
  return ytApiPromise;
}
function clearTracking(){
  if(progressTimer)clearInterval(progressTimer);progressTimer=null;
  if(uiTimer)clearInterval(uiTimer);uiTimer=null;
  try{ytPlayer?.destroy?.();}catch(_){}
  ytPlayer=null;currentVideoSource=null;
}
async function persistYT(force=false){
  if(!ytPlayer||!video||!user)return;
  try{
    const d=Number(ytPlayer.getDuration?.()||0),t=Number(ytPlayer.getCurrentTime?.()||0);if(!d)return;
    const pct=force?100:Math.min(100,Math.max(0,Math.round(t/d*100))),completed=force||pct>=90;
    const prev=progressMap[video.id]||{};
    const payload={completed,percent:pct,lastPosition:completed?d:t,duration:d,watchedSeconds:Math.max(Number(prev.watchedSeconds||0),t),sourceType:'youtube'};
    await Promise.all([
      saveLessonProgress(user.uid,classId,video.id,payload),
      saveRecentLearning(user.uid,classId,video.id)
    ]);
  }catch(err){console.warn('progress save failed',err);}
}
function syncCustomControls(){
  if(!ytPlayer)return;
  const seek=$('playerSeek'),time=$('playerTime'),play=$('playerPlay'),vol=$('playerVolume');
  try{
    const d=Number(ytPlayer.getDuration?.()||0),t=Number(ytPlayer.getCurrentTime?.()||0),state=ytPlayer.getPlayerState?.();
    if(seek&&!seek.matches(':active'))seek.value=d?String(Math.round(t/d*1000)):0;
    if(time)time.textContent=`${formatClock(t)} / ${formatClock(d)}`;
    if(play)play.textContent=state===1?'❚❚':'▶';
    if(vol&&!vol.matches(':active'))vol.value=String(Math.round(Number(ytPlayer.getVolume?.()||100)));
  }catch(_){}
}
function formatClock(sec){sec=Math.max(0,Math.floor(Number(sec||0)));const m=Math.floor(sec/60),s=sec%60;return `${m}:${String(s).padStart(2,'0')}`;}
function bindCustomControls(){
  const play=$('playerPlay'),seek=$('playerSeek'),vol=$('playerVolume'),full=$('playerFullscreen'),shell=$('videoShell');
  play?.addEventListener('click',()=>{try{const st=ytPlayer.getPlayerState();st===1?ytPlayer.pauseVideo():ytPlayer.playVideo();}catch(_){}});
  seek?.addEventListener('input',()=>{try{const d=ytPlayer.getDuration();ytPlayer.seekTo(d*(Number(seek.value)/1000),true);}catch(_){}});
  vol?.addEventListener('input',()=>{try{ytPlayer.setVolume(Number(vol.value));}catch(_){}});
  full?.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await shell.requestFullscreen?.();else await document.exitFullscreen?.();}catch(_){}});
}
function youtubePlayerMarkup(){
  return `<div class="secure-player-wrap"><div id="ytPlayer" class="yt-fill"></div><div class="custom-player-controls" aria-label="Kontrol video"><button id="playerPlay" class="player-control-btn" type="button" aria-label="Putar atau jeda">▶</button><input id="playerSeek" class="player-seek" type="range" min="0" max="1000" value="0" aria-label="Posisi video"><span id="playerTime" class="player-time">0:00 / 0:00</span><input id="playerVolume" class="player-volume" type="range" min="0" max="100" value="100" aria-label="Volume"><button id="playerFullscreen" class="player-control-btn" type="button" aria-label="Layar penuh">⛶</button></div></div>`;
}
async function renderYouTube(source){
  const id=ytId(source?.url||'');
  const shell=$('videoShell');
  if(!id){shell.innerHTML='<div class="empty-state">Sumber YouTube tidak valid.</div>';return;}
  shell.innerHTML=youtubePlayerMarkup();
  const YT=await loadYT();
  ytPlayer=new YT.Player('ytPlayer',{
    host:'https://www.youtube-nocookie.com',videoId:id,
    playerVars:{rel:0,playsinline:1,enablejsapi:1,origin:location.origin,controls:0,disablekb:1,fs:0,iv_load_policy:3,cc_load_policy:0},
    events:{
      onReady:e=>{
        const iframe=e.target.getIframe?.();
        if(iframe){iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');iframe.setAttribute('referrerpolicy','strict-origin-when-cross-origin');iframe.style.pointerEvents='none';iframe.setAttribute('tabindex','-1');}
        const p=progressMap[video.id];if(p?.lastPosition&&!p.completed)try{e.target.seekTo(Number(p.lastPosition),true);}catch(_){}
        bindCustomControls();syncCustomControls();
        uiTimer=setInterval(syncCustomControls,800);
      },
      onStateChange:async e=>{
        if(e.data===YT.PlayerState.PLAYING){await saveRecentLearning(user.uid,classId,video.id);clearInterval(progressTimer);progressTimer=setInterval(()=>persistYT(false),20000);}
        else if(e.data===YT.PlayerState.PAUSED){clearInterval(progressTimer);progressTimer=null;await persistYT(false);}
        else if(e.data===YT.PlayerState.ENDED){clearInterval(progressTimer);progressTimer=null;await persistYT(true);await logActivity(user.uid,{type:'lesson',title:`Menyelesaikan video ${video.title}`,classId,videoId:video.id});}
      }
    }
  });
}
async function renderDrive(source){
  const shell=$('videoShell');
  const url=String(source?.url||'');
  if(!url){shell.innerHTML='<div class="empty-state">Sumber Google Drive tidak tersedia.</div>';return;}
  shell.innerHTML=`<div class="secure-drive-wrap"><iframe class="drive-frame" title="Video pembelajaran" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" referrerpolicy="no-referrer" allow="autoplay; fullscreen" src="${escapeHtml(url)}"></iframe><div class="secure-source-note">Video diputar di dalam ruang kelas</div></div>`;
  const prev=progressMap[video.id]||{};
  if(!prev.completed && Number(prev.percent||0)<5){await saveLessonProgress(user.uid,classId,video.id,{...prev,percent:5,lastOpenedAt:Date.now(),sourceType:'gdrive'});}
  await saveRecentLearning(user.uid,classId,video.id);
}
async function renderVideo(){
  clearTracking();
  const shell=$('videoShell');$('videoSummary').textContent=video?.summary||'Ringkasan materi belum tersedia.';
  if(!hasAccess()){shell.innerHTML='<div class="locked-video"><div class="lock-icon">🔒</div><strong>Video tersedia setelah akses kelas aktif</strong><span>Gunakan tab Akses Kelas untuk menyelesaikan pembayaran.</span></div>';return;}
  if(!video){shell.innerHTML='<div class="empty-state">Video belum tersedia.</div>';return;}
  shell.innerHTML='<div class="player-loading">Memuat video aman…</div>';
  try{
    currentVideoSource=await fetchVideoSource(classId,video.id);
    if(!currentVideoSource?.url)throw new Error('Sumber video belum tersedia atau belum dimigrasikan.');
    if(currentVideoSource.sourceType==='gdrive'||video.sourceType==='gdrive')await renderDrive(currentVideoSource);else await renderYouTube(currentVideoSource);
  }catch(err){shell.innerHTML=`<div class="empty-state">${escapeHtml(err.message||'Gagal memuat video.')}</div>`;}
}
function renderMeta(){
  $('classTitle').textContent=classData.title;$('classTeacher').textContent=classData.teacherName||'-';$('classCategoryBadge').textContent=classData.category||'Video Pembelajaran';
  $('classPriceBadge').className=`badge ${classData.isPaid?'paid':'free'}`;$('classPriceBadge').textContent=classData.isPaid?rupiah(classData.price):'Gratis';
  const text=!classData.isPaid?'Akses langsung':enrollment?.status==='active'?'Akses aktif':enrollment?.paymentStatus==='pending'?'Menunggu verifikasi':enrollment?.paymentStatus==='rejected'?'Perlu kirim ulang':'Belum aktif';
  $('accessBadge').className=`badge ${(!classData.isPaid||enrollment?.status==='active')?'free':'pending'}`;$('accessBadge').textContent=text;
}
function renderVideoList(){
  $('videoList').innerHTML=videos.length?videos.map(v=>{const p=progressMap[v.id]||{};const done=p.completed||Number(p.percent||0)>=90;return `<button class="lesson-item ${v.id===video?.id?'active':''}" data-video="${v.id}"><div class="lesson-row"><div class="grow"><strong>${escapeHtml(v.title)}</strong><div class="muted mini">${escapeHtml(v.duration||'-')} • ${done?'Selesai':`${Number(p.percent||0)}%`}</div><div class="progress-track compact"><span style="width:${done?100:Number(p.percent||0)}%"></span></div></div><span class="lesson-state ${done?'done':''}">${done?'✓':'▶'}</span></div></button>`;}).join(''):'<div class="empty-state">Belum ada video pada kelas ini.</div>';
  $('videoList').querySelectorAll('[data-video]').forEach(b=>b.addEventListener('click',async()=>{
    await persistYT(false);video=videos.find(v=>v.id===b.dataset.video);if(!video)return;
    history.replaceState(null,'',`class.html?class=${encodeURIComponent(classId)}&video=${encodeURIComponent(video.id)}`);
    await saveRecentLearning(user.uid,classId,video.id);
    renderVideoList();renderProgress();await renderVideo();subscribeForumCurrent();await loadQuiz();
  }));
}
function renderProgress(){const p=progressMap[video?.id]||{};const pct=p.completed?100:Math.max(0,Math.min(100,Number(p.percent||0)));$('lessonProgressBar').style.width=`${pct}%`;$('lessonProgressText').textContent=p.completed?'Materi selesai':pct?`${pct}% dipelajari`:'Belum dimulai';$('markCompleteBtn').textContent=p.completed?'✓ Sudah Selesai':'Tandai Selesai';$('markCompleteBtn').disabled=Boolean(p.completed)||!hasAccess();}

function forumCard(x,reply=false){return `<div class="forum-item ${reply?'reply':''}"><div class="avatar">${initials(x.name)}</div><div class="forum-bubble"><div class="forum-meta"><strong>${escapeHtml(x.name)}</strong><span class="badge ${['admin','mentor'].includes(x.role)?'mentor':'student'}">${['admin','mentor'].includes(x.role)?'Pembimbing':'Peserta'}</span><span class="muted mini">${new Date(x.createdAt||Date.now()).toLocaleString('id-ID')}</span></div><div class="forum-content">${escapeHtml(x.text)}</div><button class="reply-action" data-reply="${x.id}" data-name="${escapeHtml(x.name)}">Balas</button></div></div>`;}
function renderForum(items){
  const roots=items.filter(x=>!x.parentId),replies=items.filter(x=>x.parentId),map={};replies.forEach(x=>(map[x.parentId]??=[]).push(x));
  $('forumList').innerHTML=roots.length?roots.map(r=>forumCard(r)+(map[r.id]||[]).map(x=>forumCard(x,true)).join('')).join(''):'<div class="empty-state">Belum ada pertanyaan. Mulai diskusi dari video ini.</div>';
  $('forumList').querySelectorAll('[data-reply]').forEach(b=>b.addEventListener('click',()=>{replyingTo={id:b.dataset.reply,name:b.dataset.name};$('replyingText').textContent=`Membalas ${replyingTo.name}`;$('replyingBanner').classList.remove('hidden');$('forumText').focus();}));
}
function subscribeForumCurrent(){if(forumUnsub)forumUnsub();if(!video||!hasAccess()){$('forumList').innerHTML='<div class="empty-state">Forum tersedia setelah akses kelas aktif.</div>';return;}forumUnsub=subscribeForum(classId,video.id,renderForum);}

async function loadQuiz(){if(!video)return;[quizData,quizResult]=await Promise.all([fetchQuiz(classId,video.id),fetchQuizResult(user.uid,classId,video.id)]);renderQuiz();}
function renderQuiz(){
  const area=$('quizArea');if(!hasAccess()){area.innerHTML='<div class="empty-state">Kuis tersedia setelah akses kelas aktif.</div>';return;}
  if(!quizData?.questions||!Object.keys(quizData.questions).length){area.innerHTML='<div class="empty-state">Belum ada kuis untuk video ini.</div>';return;}
  const qs=Object.entries(quizData.questions),result=quizResult?`<div class="quiz-result"><div class="quiz-score">${Number(quizResult.score||0)}</div><div><strong>${quizResult.passed?'Alhamdulillah, kuis lulus.':'Nilai belum mencapai batas lulus.'}</strong><div class="muted">Batas lulus ${Number(quizData.passScore||70)}. Hasil tersimpan online dan kuis dapat diulang.</div></div></div>`:'';
  area.innerHTML=`${result}<form id="quizAnswerForm">${qs.map(([id,q],i)=>`<div class="quiz-question"><h4>${i+1}. ${escapeHtml(q.text)}</h4>${Object.entries(q.options||{}).map(([k,v])=>`<label class="quiz-option"><input type="radio" name="${id}" value="${k}" required><span><strong>${k.toUpperCase()}.</strong> ${escapeHtml(v)}</span></label>`).join('')}</div>`).join('')}<button class="btn primary">Kumpulkan Jawaban</button></form>`;
  $('quizAnswerForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.target);let correct=0;const answers={};qs.forEach(([id,q])=>{const a=fd.get(id);answers[id]=a;if(a===q.correct)correct++;});const score=Math.round(correct/qs.length*100),passed=score>=Number(quizData.passScore||70);await submitQuizResult(user.uid,classId,video.id,{score,passed,correct,total:qs.length,answers});quizResult={score,passed,correct,total:qs.length,answers};if(passed)await logActivity(user.uid,{type:'quiz',title:`Lulus kuis ${video.title}`,classId,videoId:video.id,score});renderQuiz();toast(passed?'Kuis lulus dan tersimpan online.':'Nilai tersimpan online. Silakan pelajari lagi.');await refreshCompletion();});
}

async function renderPayment(){
  if(!classData.isPaid){$('freeAccessBox').classList.remove('hidden');$('paidAccessBox').classList.add('hidden');return;}
  $('freeAccessBox').classList.add('hidden');$('paidAccessBox').classList.remove('hidden');
  $('paymentBankName').textContent=settings.payment.bankName||'-';$('paymentBankNumber').textContent=settings.payment.accountNumber||'-';$('paymentBankAccountName').textContent=`a.n. ${settings.payment.accountName||'-'}`;$('paymentAmountText').textContent=rupiah(classData.price);
  const status=enrollment?.paymentStatus==='pending'?'Menunggu verifikasi admin':enrollment?.paymentStatus==='approved'?'Pembayaran disetujui — akses aktif':enrollment?.paymentStatus==='rejected'?'Bukti perlu diperiksa ulang':'Belum ada pembayaran';$('paymentStatusBox').textContent=status;
  $('paymentForm').classList.toggle('hidden',enrollment?.paymentStatus==='pending'||enrollment?.paymentStatus==='approved');
}
async function refreshCompletion(){
  if(!hasAccess()){$('courseProgressBar').style.width='0%';$('courseProgressText').textContent='0%';$('certificateHint').textContent='Sertifikat tersedia setelah akses kelas aktif dan seluruh materi dituntaskan.';$('certificateBtn').classList.add('hidden');return {percent:0,completedVideos:0,totalVideos:0,quizzesPassed:false,eligible:false};}
  const c=await fetchClassCompletion(user.uid,classId);$('courseProgressBar').style.width=`${c.percent}%`;$('courseProgressText').textContent=`${c.percent}%`;
  if(c.eligible){$('certificateHint').textContent='Semua materi selesai dan kuis wajib lulus. Sertifikat tersimpan online setelah diterbitkan.';$('certificateBtn').classList.remove('hidden');$('certificateBtn').href=`certificate.html?class=${encodeURIComponent(classId)}`;}
  else{$('certificateHint').textContent=`${c.completedVideos}/${c.totalVideos} video selesai${c.quizzesPassed?'':' • masih ada kuis yang belum lulus'}.`;$('certificateBtn').classList.add('hidden');}
  return c;
}

$('markCompleteBtn').addEventListener('click',async()=>{if(!video||!hasAccess())return;try{await Promise.all([markLessonComplete(user.uid,classId,video.id,true),saveRecentLearning(user.uid,classId,video.id)]);await logActivity(user.uid,{type:'lesson',title:`Menyelesaikan video ${video.title}`,classId,videoId:video.id});toast('Materi ditandai selesai dan disimpan online');}catch(err){toast(err.message||'Gagal menyimpan progres','error');}});
$('cancelReplyBtn').addEventListener('click',()=>{replyingTo=null;$('replyingBanner').classList.add('hidden');});
$('forumForm').addEventListener('submit',async e=>{e.preventDefault();const text=$('forumText').value.trim();if(!text)return;if(!hasAccess())return toast('Forum tersedia setelah akses aktif','error');await submitForumPost(classId,video.id,{uid:user.uid,name:profile.name,role:profile.role,text,parentId:replyingTo?.id||null});$('forumText').value='';replyingTo=null;$('replyingBanner').classList.add('hidden');});
$('paymentForm').addEventListener('submit',async e=>{e.preventDefault();const file=$('proofFile').files[0];if(!file)return toast('Pilih bukti transfer','error');if(file.size>10*1024*1024)return toast('Ukuran foto maksimal 10 MB','error');const wa=normalizeWa(settings.payment.whatsappAdmin||''),waWindow=wa?window.open('about:blank','_blank'):null;try{const proofData=await uploadProof(file);const p=await submitPayment({uid:user.uid,classId,amount:classData.price,senderName:$('senderName').value.trim(),senderBank:$('senderBank').value.trim(),proofData});enrollment={status:'pending_payment',paymentStatus:'pending',paymentId:p.id};renderMeta();renderPayment();toast('Bukti pembayaran berhasil dikirim');if(wa&&waWindow){const msg=encodeURIComponent(`Assalamu'alaikum. Saya ${profile.name} sudah mengirim bukti pembayaran kelas "${classData.title}" sebesar ${rupiah(classData.price)} melalui belajarislam.online.`);waWindow.location.href=`https://wa.me/${wa}?text=${msg}`;}}catch(err){try{waWindow?.close();}catch(_){}toast(err.message||'Gagal mengirim bukti pembayaran','error');}});
$('copyAccountBtn').addEventListener('click',async()=>{await navigator.clipboard.writeText(settings.payment.accountNumber||'');toast('Nomor rekening disalin');});
$('copyAmountBtn').addEventListener('click',async()=>{await navigator.clipboard.writeText(String(classData.price||0));toast('Nominal disalin');});
$('classMobileChatFab')?.addEventListener('click',()=>location.href='dashboard.html#chat');
$('mobileForumLink')?.addEventListener('click',e=>{e.preventDefault();switchTab('forumPanel');$('forumPanel')?.scrollIntoView({behavior:'smooth',block:'start'});});
$('classLogoutBtn').addEventListener('click',async()=>{await persistYT(false);await logoutUser();location.href='../index.html';});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistYT(false);});
window.addEventListener('pagehide',()=>{if(progressTimer)clearInterval(progressTimer);if(uiTimer)clearInterval(uiTimer);try{videoListUnsub?.();progressUnsub?.();forumUnsub?.();enrollmentUnsub?.();}catch(_){}persistYT(false);});

async function loadAccessibleClassData(){
  videos=await fetchVideos(classId);progressMap=await fetchProgress(user.uid,classId);
  video=(requestedVideoId&&videos.find(v=>v.id===requestedVideoId))||(video&&videos.find(v=>v.id===video.id))||videos[0]||null;
  renderVideoList();renderProgress();await renderVideo();subscribeForumCurrent();if(video)await loadQuiz();else $('quizArea').innerHTML='<div class="empty-state">Belum ada kuis.</div>';
  if(progressUnsub)progressUnsub();
  progressUnsub=subscribeProgress(user.uid,classId,async next=>{progressMap=next||{};renderProgress();renderVideoList();await refreshCompletion();});
  if(videoListUnsub)videoListUnsub();
  videoListUnsub=subscribeVideos(classId,async next=>{
    const previousId=video?.id||null, previousSig=videos.map(v=>`${v.id}:${v.updatedAt||0}`).join('|'), nextSig=next.map(v=>`${v.id}:${v.updatedAt||0}`).join('|');
    videos=next;
    const nextCurrent=(previousId&&videos.find(v=>v.id===previousId))||videos[0]||null;
    const currentChanged=(nextCurrent?.id||null)!==previousId;
    video=nextCurrent;
    renderVideoList();renderProgress();
    if(currentChanged){await renderVideo();subscribeForumCurrent();if(video)await loadQuiz();else $('quizArea').innerHTML='<div class="empty-state">Belum ada kuis.</div>';}
    else if(video && previousSig!==nextSig){$('videoSummary').textContent=video.summary||'Ringkasan materi belum tersedia.';}
    await refreshCompletion();
  });
}

onAuthStateChanged(auth,async u=>{
  if(!u){location.href='../index.html';return;}if(!classId){location.href='dashboard.html';return;}
  user=u;profile=await fetchProfile(u.uid);classData=await fetchClass(classId);if(!classData)return toast('Kelas tidak ditemukan','error');
  settings=await fetchSettings();enrollment=await fetchEnrollment(u.uid,classId);if(!classData.isPaid&&!enrollment)enrollment=await joinFreeClass(u.uid,classId);
  renderMeta();await renderPayment();
  if(hasAccess()){await loadAccessibleClassData();$('forumForm').style.display='block';}else{videos=[];progressMap={};video=null;renderVideoList();renderProgress();await renderVideo();subscribeForumCurrent();$('quizArea').innerHTML='<div class="empty-state">Kuis tersedia setelah akses kelas aktif.</div>';$('forumForm').style.display='none';}
  await refreshCompletion();
  if(enrollmentUnsub)enrollmentUnsub();
  enrollmentUnsub=subscribeEnrollment(u.uid,classId,async next=>{
    const was=hasAccess();enrollment=next;const now=hasAccess();renderMeta();await renderPayment();
    if(!was&&now){await loadAccessibleClassData();$('forumForm').style.display='block';await refreshCompletion();toast('Akses kelas sudah aktif. Selamat belajar!');}
  });
});
