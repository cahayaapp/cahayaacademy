import { auth, db, storage } from './firebase-config.js';
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
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
  remove
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

export const state = {
  user: null,
  profile: null,
  classes: [],
  selectedClass: null,
  selectedVideo: null,
  forumPosts: [],
  unsubscribers: []
};

export const sampleData = {
  settings: {
    siteName: 'belajarislam.online',
    siteTagline: 'Belajar Islam kapan saja, di mana saja.',
    payment: {
      bankName: 'Bank Syariah Indonesia (BSI)',
      accountNumber: '71234567890',
      accountName: 'belajarislam.online',
      whatsappAdmin: '6281234567890'
    }
  },
  classes: {
    aqidah_dasar: {
      title: 'Pengantar Aqidah Islam',
      description: 'Belajar dasar-dasar aqidah Islam dengan bahasa yang mudah dipahami dan aplikatif.',
      category: 'Aqidah',
      teacherName: 'Ust. Abu Yahya',
      isPaid: false,
      price: 0,
      coverTheme: 'emerald',
      status: 'published',
      order: 1,
      level: 'Pemula'
    },
    fiqih_praktis: {
      title: 'Fiqih Ibadah Praktis',
      description: 'Panduan ibadah sehari-hari yang ringkas, jelas, dan mudah diamalkan.',
      category: 'Fiqih',
      teacherName: 'Ust. Ahmad Zainuddin',
      isPaid: false,
      price: 0,
      coverTheme: 'bluegold',
      status: 'published',
      order: 2,
      level: 'Pemula'
    },
    ulama_ahlussunnah: {
      title: "Ulama Besar yang Berakidah Ahlussunnah Wal Jama'ah",
      description: 'Kajian akidah yang menuntun peserta memahami manhaj Ahlussunnah secara runtut.',
      category: 'Aqidah',
      teacherName: 'Ustadz Multazam Zakaria',
      isPaid: true,
      price: 149000,
      coverTheme: 'darkteal',
      status: 'published',
      order: 3,
      level: 'Menengah'
    },
    tahsin_quran: {
      title: 'Tahsin Al-Qur’an Dasar',
      description: 'Perbaiki bacaan Al-Qur’an dari dasar dengan bimbingan yang terstruktur.',
      category: 'Al-Qur’an',
      teacherName: 'Ust. Hanan Attaki',
      isPaid: true,
      price: 99000,
      coverTheme: 'purple',
      status: 'published',
      order: 4,
      level: 'Pemula'
    }
  },
  videos: {
    aqidah_dasar: {
      v1: {
        title: 'Pendahuluan Tauhid',
        order: 1,
        duration: '24 menit',
        sourceType: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/y6v9w-XmJ6k?rel=0&modestbranding=1&playsinline=1',
        summary: 'Pengantar tentang makna tauhid dan urgensinya dalam kehidupan Muslim.'
      }
    },
    fiqih_praktis: {
      v1: {
        title: 'Fiqih Thaharah Dasar',
        order: 1,
        duration: '18 menit',
        sourceType: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/y6v9w-XmJ6k?rel=0&modestbranding=1&playsinline=1',
        summary: 'Mengenal dasar-dasar bersuci, wudhu, dan adab kebersihan.'
      }
    },
    ulama_ahlussunnah: {
      v1: {
        title: "Pengertian Ahlussunnah wal Jama'ah",
        order: 1,
        duration: '45 menit',
        sourceType: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/y6v9w-XmJ6k?rel=0&modestbranding=1&playsinline=1',
        summary: 'Memahami definisi Ahlussunnah wal Jama’ah serta landasan pokoknya.'
      },
      v2: {
        title: 'Dalil dan Landasan Mengikuti Ulama',
        order: 2,
        duration: '32 menit',
        sourceType: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/y6v9w-XmJ6k?rel=0&modestbranding=1&playsinline=1',
        summary: 'Pembahasan adab dalam mengikuti ulama serta batasan-batasannya.'
      }
    },
    tahsin_quran: {
      v1: {
        title: 'Makharijul Huruf Dasar',
        order: 1,
        duration: '27 menit',
        sourceType: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/y6v9w-XmJ6k?rel=0&modestbranding=1&playsinline=1',
        summary: 'Mempelajari titik keluarnya huruf-huruf hijaiyah secara benar.'
      }
    }
  }
};

export const els = {};

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }
export function rupiah(num = 0) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(num || 0)); }
export function formatDate(ts) {
  if (!ts) return '-';
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
export function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0,2).map(v => v[0]?.toUpperCase()).join('') || 'BI';
}
export function slugify(text='') {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function coverGradient(theme = 'emerald') {
  const map = {
    emerald: 'linear-gradient(135deg,#0f766e,#115e59 55%,#d4a017)',
    bluegold: 'linear-gradient(135deg,#0c4a6e,#1d4ed8 55%,#d4a017)',
    darkteal: 'linear-gradient(135deg,#022c22,#0f766e 55%,#d4a017)',
    purple: 'linear-gradient(135deg,#4c1d95,#0f766e 60%,#eab308)'
  };
  return map[theme] || map.emerald;
}

export function toast(message = 'Berhasil', type='default') {
  const el = qs('#toast');
  if (!el) return;
  el.textContent = message;
  el.style.background = type === 'error' ? '#7f1d1d' : '#052e2b';
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

export async function ensureSeedData() {
  const classesSnap = await get(ref(db, 'classes'));
  if (!classesSnap.exists()) await set(ref(db, 'classes'), sampleData.classes);
  const videosSnap = await get(ref(db, 'videos'));
  if (!videosSnap.exists()) await set(ref(db, 'videos'), sampleData.videos);
  const settingsSnap = await get(ref(db, 'settings'));
  if (!settingsSnap.exists()) await set(ref(db, 'settings'), sampleData.settings);
}

export async function registerUser({ name, email, password, whatsapp }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await set(ref(db, `users/${cred.user.uid}`), {
    uid: cred.user.uid,
    name,
    email,
    whatsapp,
    role: 'student',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  return cred.user;
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function fetchProfile(uid) {
  const snap = await get(ref(db, `users/${uid}`));
  return snap.val();
}

export async function saveProfile(uid, payload) {
  await update(ref(db, `users/${uid}`), { ...payload, updatedAt: Date.now() });
}

export async function fetchClasses() {
  const snap = await get(ref(db, 'classes'));
  const data = snap.val() || {};
  return Object.entries(data).map(([id, value]) => ({ id, ...value }))
    .filter(item => item.status !== 'archived')
    .sort((a,b) => (a.order || 999) - (b.order || 999));
}

export async function fetchClass(classId) {
  const snap = await get(ref(db, `classes/${classId}`));
  return snap.exists() ? { id: classId, ...snap.val() } : null;
}

export async function fetchVideos(classId) {
  const snap = await get(ref(db, `videos/${classId}`));
  const data = snap.val() || {};
  return Object.entries(data).map(([id, value]) => ({ id, ...value })).sort((a,b) => (a.order||999)-(b.order||999));
}

export async function createClass(payload) {
  const id = payload.slug || slugify(payload.title);
  await set(ref(db, `classes/${id}`), { ...payload, createdAt: Date.now(), updatedAt: Date.now(), status: 'published' });
  return id;
}

export async function saveVideo(classId, payload) {
  const id = payload.id || `v${Date.now()}`;
  await set(ref(db, `videos/${classId}/${id}`), { ...payload, updatedAt: Date.now() });
}

export async function submitForumPost(classId, videoId, payload) {
  const postRef = push(ref(db, `forumPosts/${classId}/${videoId}`));
  await set(postRef, { ...payload, createdAt: Date.now() });
}

export function subscribeForum(classId, videoId, cb) {
  const forumRef = ref(db, `forumPosts/${classId}/${videoId}`);
  const off = onValue(forumRef, snap => {
    const data = snap.val() || {};
    const items = Object.entries(data).map(([id, value]) => ({ id, ...value })).sort((a,b) => (a.createdAt||0) - (b.createdAt||0));
    cb(items);
  });
  return () => off();
}

export async function fetchEnrollment(uid, classId) {
  const snap = await get(ref(db, `enrollments/${uid}/${classId}`));
  return snap.val();
}

export async function ensureEnrollment(uid, classId, classData) {
  const current = await fetchEnrollment(uid, classId);
  if (current) return current;
  const payload = classData.isPaid ? { status: 'pending_payment', paymentStatus: 'none', classType: 'paid', createdAt: Date.now() } : { status: 'active', paymentStatus: 'free', classType: 'free', createdAt: Date.now() };
  await set(ref(db, `enrollments/${uid}/${classId}`), payload);
  return payload;
}

export async function uploadProof(file, uid, classId) {
  const proofRef = storageRef(storage, `payment-proofs/${uid}/${classId}/${Date.now()}-${file.name}`);
  await uploadBytes(proofRef, file);
  return await getDownloadURL(proofRef);
}

export async function submitPayment({ uid, classId, amount, senderName, senderBank, proofUrl }) {
  const paymentRef = push(ref(db, 'payments'));
  const paymentId = paymentRef.key;
  const payload = {
    id: paymentId,
    uid,
    classId,
    amount: Number(amount || 0),
    senderName,
    senderBank,
    proofUrl,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await set(paymentRef, payload);
  await update(ref(db, `enrollments/${uid}/${classId}`), { status: 'pending_payment', paymentStatus: 'pending', paymentId, updatedAt: Date.now() });
  await push(ref(db, 'notifications/admin'), {
    type: 'payment',
    title: 'Bukti pembayaran baru masuk',
    message: `${senderName} mengirim bukti pembayaran untuk kelas ${classId}`,
    paymentId,
    createdAt: Date.now(),
    read: false
  });
  return payload;
}

export async function fetchAllPayments() {
  const snap = await get(ref(db, 'payments'));
  const data = snap.val() || {};
  return Object.values(data).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
}

export async function approvePayment(paymentId) {
  const snap = await get(ref(db, `payments/${paymentId}`));
  const payment = snap.val();
  if (!payment) throw new Error('Data pembayaran tidak ditemukan');
  await update(ref(db, `payments/${paymentId}`), { status: 'approved', updatedAt: Date.now() });
  await update(ref(db, `enrollments/${payment.uid}/${payment.classId}`), { status: 'active', paymentStatus: 'approved', approvedAt: Date.now(), updatedAt: Date.now() });
  await push(ref(db, `notifications/${payment.uid}`), { type: 'payment-approved', title: 'Pembayaran disetujui', message: 'Kelas berbayar Anda sudah dapat diakses.', createdAt: Date.now(), read: false });
}

export async function rejectPayment(paymentId) {
  const snap = await get(ref(db, `payments/${paymentId}`));
  const payment = snap.val();
  if (!payment) throw new Error('Data pembayaran tidak ditemukan');
  await update(ref(db, `payments/${paymentId}`), { status: 'rejected', updatedAt: Date.now() });
  await update(ref(db, `enrollments/${payment.uid}/${payment.classId}`), { status: 'pending_payment', paymentStatus: 'rejected', updatedAt: Date.now() });
  await push(ref(db, `notifications/${payment.uid}`), { type: 'payment-rejected', title: 'Pembayaran perlu diperiksa ulang', message: 'Silakan cek kembali bukti transfer Anda.', createdAt: Date.now(), read: false });
}

export async function fetchUsers() {
  const snap = await get(ref(db, 'users'));
  const data = snap.val() || {};
  return Object.values(data).sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));
}

export async function setUserRole(uid, role) {
  await update(ref(db, `users/${uid}`), { role, updatedAt: Date.now() });
}

export function subscribeNotifications(path, cb) {
  const notifRef = ref(db, path);
  const off = onValue(notifRef, snap => {
    const data = snap.val() || {};
    const items = Object.entries(data).map(([id, value]) => ({ id, ...value })).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    cb(items);
  });
  return () => off();
}

export async function markNotifRead(basePath, id) {
  await update(ref(db, `${basePath}/${id}`), { read: true });
}

export async function fetchSettings() {
  const snap = await get(ref(db, 'settings'));
  return snap.val() || sampleData.settings;
}

export async function saveSettings(payload) {
  await update(ref(db, 'settings'), payload);
}

export async function sendLiveChatMessage(roomId, payload) {
  const msgRef = push(ref(db, `liveChats/${roomId}/messages`));
  await set(msgRef, { ...payload, createdAt: Date.now() });
}

export function subscribeLiveChat(roomId, cb) {
  const roomRef = ref(db, `liveChats/${roomId}/messages`);
  const off = onValue(roomRef, snap => {
    const data = snap.val() || {};
    const items = Object.entries(data).map(([id, value]) => ({ id, ...value })).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    cb(items);
  });
  return () => off();
}

export { auth, db, storage, onAuthStateChanged, ref, get, set, update, push, serverTimestamp, remove };
