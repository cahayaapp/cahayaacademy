import {
  auth,onAuthStateChanged,fetchProfile,fetchEbook,fetchEbookCover,fetchEbookFile,fetchUserEbookAccess,subscribeUserEbookAccess,
  acquireFreeEbook,fetchSettings,uploadProof,submitPurchasePayment,logoutUser,rupiah,toast,normalizeWa
} from './core.js';

const $=id=>document.getElementById(id),ebookId=new URLSearchParams(location.search).get('ebook');
let user,profile,book,access={},settings,accessUnsub=null;
let downloadPreparing=false;

function active(){return access?.status==='active'||['admin','mentor'].includes(profile?.role);}
function safeFileName(name='ebook.pdf'){
  const clean=String(name||'ebook.pdf').replace(/[\\/:*?"<>|]+/g,'-').trim();
  return /\.pdf$/i.test(clean)?clean:`${clean||'ebook'}.pdf`;
}
function gatewayEndpoint(){
  return String(settings?.downloadGateway?.endpoint||'').trim().replace(/\/+$/,'');
}
function setDownloadButtonState(){
  const btn=$('downloadEbookBtn');
  if(!btn)return;
  if(!active()){btn.disabled=true;btn.textContent='↓ Download Ebook PDF';return;}
  if(book?.fileMode==='gdrive'&&!gatewayEndpoint()){
    btn.disabled=true;btn.textContent='Download belum dikonfigurasi';return;
  }
  btn.disabled=downloadPreparing;
  btn.textContent=downloadPreparing?'Menyiapkan download...':'↓ Download Ebook PDF';
}
async function startGatewayDownload(){
  const endpoint=gatewayEndpoint();
  if(!endpoint)throw new Error('Download Gateway belum diaktifkan admin.');
  downloadPreparing=true;setDownloadButtonState();
  const idToken=await user.getIdToken(true);
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),20000);
  let res;
  try{
    res=await fetch(`${endpoint}/prepare`,{
      method:'POST',mode:'cors',credentials:'omit',signal:ctrl.signal,
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${idToken}`},
      body:JSON.stringify({ebookId})
    });
  }finally{clearTimeout(timer);}
  if(!res?.ok){
    let msg='Gateway download gagal menyiapkan file.';
    try{const data=await res.json();if(data?.error)msg=data.error;}catch(_){}
    throw new Error(msg);
  }
  const data=await res.json();
  if(!data?.downloadUrl)throw new Error('URL download aman tidak tersedia.');
  // Top-level navigation to an attachment response triggers the browser/device native download manager.
  window.location.assign(data.downloadUrl);
}
function renderMeta(){
  $('ebookTitle').textContent=book.title||'Ebook';
  $('ebookAuthor').textContent=book.author?`Oleh ${book.author}`:'belajarislam.online';
  $('ebookDescription').textContent=book.description||'Ebook digital belajarislam.online.';
  const synopsis=String(book.synopsis||'').trim();
  $('ebookSynopsis').textContent=synopsis;
  $('ebookSynopsisBlock').classList.toggle('hidden',!synopsis);
  $('ebookFileMeta').textContent=book.fileSize?`PDF Digital • ${(Number(book.fileSize)/1024/1024).toFixed(2)} MB`:'PDF Digital';
  $('ebookPriceBadge').className=`badge ${book.isPaid?'paid':'free'}`;
  $('ebookPriceBadge').textContent=book.isPaid?rupiah(book.price):'Gratis';
  const status=active()?'Akses aktif':access?.paymentStatus==='pending'?'Menunggu verifikasi':access?.paymentStatus==='rejected'?'Perlu kirim ulang':book.isPaid?'Belum dibeli':'Belum diambil';
  $('ebookAccessBadge').className=`badge ${active()?'free':'pending'}`;
  $('ebookAccessBadge').textContent=status;
  $('ebookDownloadArea').classList.toggle('hidden',!active());
  setDownloadButtonState();
}
async function renderCover(){
  if(!book.hasCover)return;
  try{
    const c=await fetchEbookCover(book.id);
    if(c?.data){$('ebookCoverLarge').style.backgroundImage=`url("${c.data}")`;$('ebookCoverLarge').classList.add('has-image');$('ebookCoverLarge').innerHTML='';}
  }catch(_){}
}
function renderAccess(){
  if(active()){$('ebookAccessTitle').textContent='Ebook Milik Anda';$('ebookFreeBox').classList.add('hidden');$('ebookPaidBox').classList.add('hidden');setDownloadButtonState();return;}
  if(!book.isPaid){$('ebookFreeBox').classList.remove('hidden');$('ebookPaidBox').classList.add('hidden');return;}
  $('ebookFreeBox').classList.add('hidden');$('ebookPaidBox').classList.remove('hidden');
  $('ebookBankName').textContent=settings.payment.bankName||'-';$('ebookBankNumber').textContent=settings.payment.accountNumber||'-';$('ebookAccountName').textContent=`a.n. ${settings.payment.accountName||'-'}`;$('ebookAmountText').textContent=rupiah(book.price);
  $('ebookPaymentStatus').textContent=access?.paymentStatus==='pending'?'Menunggu verifikasi admin':access?.paymentStatus==='rejected'?'Bukti perlu diperiksa ulang':'Belum ada pembayaran';
  $('ebookPaymentForm').classList.toggle('hidden',access?.paymentStatus==='pending');
}

async function triggerStoredPdfDownload(){
  const file=await fetchEbookFile(ebookId);
  if(!file?.data)throw new Error('File ebook belum siap diunduh.');
  const parts=String(file.data).split(',');
  if(parts.length<2)throw new Error('File ebook tidak valid.');
  const bytes=Uint8Array.from(atob(parts[1]),c=>c.charCodeAt(0));
  const blob=new Blob([bytes],{type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=safeFileName(file.fileName||book.fileName||book.title||'ebook.pdf');
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

$('claimFreeEbookBtn').addEventListener('click',async()=>{try{access=await acquireFreeEbook(user.uid,ebookId);renderMeta();renderAccess();toast('Ebook gratis sudah masuk ke perpustakaan Anda');}catch(err){toast(err.message||'Gagal mengambil ebook','error');}});
$('downloadEbookBtn').addEventListener('click',async()=>{
  if(!active())return;
  const btn=$('downloadEbookBtn');
  try{
    if(book.fileMode==='gdrive'){
      await startGatewayDownload();
      toast('Download dimulai di perangkat Anda');
      return;
    }
    btn.disabled=true;btn.textContent='Menyiapkan PDF...';
    await triggerStoredPdfDownload();
    toast('Download ebook dimulai');
  }catch(err){
    toast(err.message||'Gagal mengunduh ebook','error');
  }finally{
    downloadPreparing=false;
    setDownloadButtonState();
  }
});
$('ebookPaymentForm').addEventListener('submit',async e=>{e.preventDefault();const file=$('ebookProofFile').files[0];if(!file)return toast('Pilih bukti transfer','error');if(file.size>10*1024*1024)return toast('Ukuran foto maksimal 10 MB','error');const wa=normalizeWa(settings.payment.whatsappAdmin||''),waWindow=wa?window.open('about:blank','_blank'):null;try{const proofData=await uploadProof(file);const p=await submitPurchasePayment({uid:user.uid,itemType:'ebook',itemId:ebookId,amount:book.price,senderName:$('ebookSenderName').value.trim(),senderBank:$('ebookSenderBank').value.trim(),proofData});access={status:'pending_payment',paymentStatus:'pending',paymentId:p.id};renderMeta();renderAccess();toast('Bukti pembayaran ebook berhasil dikirim');if(wa&&waWindow){const msg=encodeURIComponent(`Assalamu'alaikum. Saya ${profile.name} sudah mengirim bukti pembayaran ebook "${book.title}" sebesar ${rupiah(book.price)} melalui belajarislam.online.`);waWindow.location.href=`https://wa.me/${wa}?text=${msg}`;}}catch(err){try{waWindow?.close();}catch(_){}toast(err.message||'Gagal mengirim bukti pembayaran','error');}});
$('copyEbookAccountBtn').addEventListener('click',async()=>{await navigator.clipboard.writeText(settings.payment.accountNumber||'');toast('Nomor rekening disalin');});
$('copyEbookAmountBtn').addEventListener('click',async()=>{await navigator.clipboard.writeText(String(book.price||0));toast('Nominal disalin');});
$('ebookLogoutBtn').addEventListener('click',async()=>{await logoutUser();location.href='../index.html';});

onAuthStateChanged(auth,async u=>{
  if(!u){location.href='../index.html';return;}
  if(!ebookId){location.href='dashboard.html#ebooks';return;}
  user=u;
  [profile,book,settings]=await Promise.all([fetchProfile(u.uid),fetchEbook(ebookId),fetchSettings()]);
  if(!book){toast('Ebook tidak ditemukan','error');return;}
  const all=await fetchUserEbookAccess(u.uid);access=all[ebookId]||{};
  renderMeta();await renderCover();renderAccess();
  accessUnsub=subscribeUserEbookAccess(u.uid,next=>{
    const wasActive=active();
    access=next?.[ebookId]||{};
    renderMeta();renderAccess();
  });
});
