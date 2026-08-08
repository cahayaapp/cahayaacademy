import {
  auth,
  db,
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  initializeApp,
  deleteApp,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  firebaseConfig
} from "./firebase.js";
import { appConfig } from "./firebase-config.js";
import {
  getValue,
  setValue,
  updateValues,
  updateValue,
  pushValue,
  removeValue,
  subscribe,
  getProfile,
  getPublicProfile,
  getClass,
  getMyClasses,
  getAllClasses,
  getMeetings,
  getModules,
  getAssignments,
  getClassMembers,
  getAllUsers
} from "./store.js";
import {
  qs,
  qsa,
  escapeHtml,
  safeUrl,
  slugify,
  uid,
  formatDate,
  formatDateTime,
  formatShortDate,
  formatTime,
  toInputDateTime,
  initials,
  objectToArray,
  sortByDate,
  youtubeId,
  googleDriveId,
  googleDrivePreviewUrl,
  meetingStatus,
  statusLabel,
  roleLabel,
  durationText,
  downloadCsv,
  debounce
} from "./utils.js";

const state = {
  user: null,
  profile: null,
  classes: [],
  activeClass: null,
  unsubscribers: [],
  player: null,
  playerReady: false,
  playing: false,
  watchSeconds: 0,
  watchSaveTimer: null,
  watchHeartbeatTimer: null,
  currentMeeting: null,
  currentClassId: null,
  notesSaveTimer: null,
  registrationInProgress: false,
  globalUnsubscribers: [],
  pendingPayments: 0,
  paymentSettings: null,
  chatUnread: 0
};

function normalizeRole(role = "") {
  const value = String(role || "").trim().toLowerCase();
  if (["student", "member", "peserta", "siswa", "santri"].includes(value)) return "student";
  if (["admin", "administrator"].includes(value)) return "admin";
  if (["teacher", "pengajar", "guru", "tutor"].includes(value)) return "teacher";
  return value || "student";
}

function isStudentRole(role = state.profile?.role) { return normalizeRole(role) === "student"; }
function isAdminRole(role = state.profile?.role) { return normalizeRole(role) === "admin"; }
function canUseSupportChat(role = state.profile?.role) { return ["student", "admin"].includes(normalizeRole(role)); }

const routeTitles = {
  dashboard: "Beranda",
  catalog: "Jelajahi Kelas",
  classes: "Kelas Saya",
  schedule: "Video Pembelajaran",
  assignments: "Tugas",
  users: "Pengguna",
  payments: "Pembayaran",
  chat: "Live Chat",
  reports: "Laporan Belajar",
  announcements: "Pengumuman",
  settings: "Pengaturan",
  class: "Detail Kelas",
  meeting: "Ruang Belajar"
};

function icon(name) {
  const map = {
    home: "⌂", classes: "▦", schedule: "◷", tasks: "✓", users: "👥",
    report: "▥", announce: "◉", settings: "⚙", live: "●", play: "▶",
    video: "▣", book: "▤", quiz: "?", discuss: "✦", plus: "+", search: "⌕",
    menu: "☰", bell: "♢", logout: "↪", edit: "✎", trash: "×", back: "←",
    calendar: "◫", clock: "◷", check: "✓", upload: "⇧", download: "⇩",
    chart: "▥", lock: "▣", mail: "@", chat: `<svg class="support-chat-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 11.6a8.1 8.1 0 0 1-11.9 7.1L4 20l1.3-4.1A8.1 8.1 0 1 1 20.2 11.6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 8.2c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.6.8c-.2.2-.1.4 0 .6.5.9 1.2 1.7 2.1 2.2.2.1.4.2.6 0l.9-1c.2-.2.4-.3.7-.1l1.8.8c.3.1.4.3.4.5 0 .4-.2 1.2-.8 1.7-.6.5-1.3.8-2.2.6-1.1-.2-2.8-.8-4.5-2.4-1.4-1.3-2.3-2.9-2.6-4-.2-.9.1-1.6.5-2.2.4-.5.8-.7 1.3-.7Z" fill="currentColor"/></svg>`, eye: "◉", arrow: "→"
  };
  return map[name] || "•";
}

function toast(message, type = "info", title = "IZZUDDIN ACADEMY") {
  const root = qs("#toastRoot");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="toast-icon">${type === "success" ? "✓" : type === "error" ? "!" : type === "warning" ? "⚠" : "i"}</div>
    <div><b>${escapeHtml(title)}</b><span>${escapeHtml(message)}</span></div>`;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

function friendlyError(error) {
  const code = error?.code || "";
  const map = {
    "auth/invalid-credential": "Email atau kata sandi tidak cocok.",
    "auth/user-disabled": "Akun ini dinonaktifkan.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.",
    "auth/invalid-email": "Format email tidak valid.",
    "auth/email-already-in-use": "Email tersebut sudah dipakai.",
    "auth/weak-password": "Kata sandi terlalu lemah. Gunakan minimal 8 karakter.",
    "auth/requires-recent-login": "Silakan keluar lalu masuk kembali sebelum mengganti kata sandi.",
    "PERMISSION_DENIED": "Akses ditolak oleh Database Rules.",
    "storage/unauthorized": "Akses penyimpanan ditolak.",
    "storage/object-not-found": "File tidak ditemukan di penyimpanan.",
    "storage/quota-exceeded": "Kuota penyimpanan Firebase telah terlampaui."
  };
  return map[code] || map[error?.message] || error?.message || "Terjadi kesalahan yang belum diketahui.";
}

function hideLoader() {
  const loader = qs("#appLoader");
  loader?.classList.add("is-hidden");
  setTimeout(() => loader?.remove(), 500);
}

function clearSubscriptions() {
  state.unsubscribers.forEach((fn) => { try { fn(); } catch (_) {} });
  state.unsubscribers = [];
}

function clearGlobalSubscriptions() {
  state.globalUnsubscribers.forEach((fn) => { try { fn(); } catch (_) {} });
  state.globalUnsubscribers = [];
}

function formatRupiah(value = 0) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function normalizeWhatsapp(value = "") {
  let digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (!digits.startsWith("62") && digits) digits = `62${digits}`;
  return digits;
}

async function copyText(value, successMessage = "Berhasil disalin.") {
  const text = String(value ?? "").trim();
  if (!text) return toast("Belum ada data yang dapat disalin.", "warning");
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      if (!document.execCommand("copy")) throw new Error("Clipboard tidak tersedia.");
      area.remove();
    }
    toast(successMessage, "success");
  } catch (_) {
    toast("Tidak dapat menyalin otomatis. Tekan dan tahan teks lalu pilih Salin.", "warning");
  }
}

async function compressPaymentProof(file, maxSide = 1400, quality = 0.72) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Bukti transfer harus berupa gambar JPG, PNG, atau WEBP.");
  }
  if (file.size > 6 * 1024 * 1024) throw new Error("Ukuran gambar maksimal 6 MB.");
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Format gambar tidak dapat diproses."));
    img.src = dataUrl;
  });
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  let output = canvas.toDataURL("image/jpeg", quality);
  if (output.length > 780000) output = canvas.toDataURL("image/jpeg", 0.55);
  if (output.length > 950000) throw new Error("Gambar masih terlalu besar. Potong bagian yang tidak diperlukan lalu unggah kembali.");
  return output;
}

async function getPaymentProof(request = {}) {
  if (request.proofData) return request.proofData;
  if (request.proofPath) return getValue(request.proofPath, "");
  if (request.studentUid && request.classId) return getValue(`paymentProofs/${request.studentUid}/${request.classId}`, "");
  return request.proofUrl || "";
}

function getVideoSource(meeting = {}) {
  const provider = meeting.videoProvider || (meeting.driveUrl ? "drive" : meeting.youtubeId ? "youtube" : "none");
  const url = meeting.videoUrl || meeting.youtubeUrl || meeting.driveUrl || "";
  return {
    provider,
    url,
    youtubeId: meeting.youtubeId || (provider === "youtube" ? youtubeId(url) : ""),
    driveUrl: provider === "drive" ? googleDrivePreviewUrl(url) : ""
  };
}

function videoAvailability(meeting = {}) {
  if (meeting.status === "draft" || meeting.published === false) return { key: "draft", label: "Draf" };
  const source = getVideoSource(meeting);
  if (!source.url && !source.youtubeId) return { key: "empty", label: "Belum Ada Video" };
  const start = meeting.startAt ? new Date(meeting.startAt).getTime() : 0;
  if (start && Date.now() < start) return { key: "upcoming", label: "Terjadwal" };
  return { key: "available", label: "Video Tersedia" };
}

function classAccessLabel(course = {}) {
  return course.accessType === "paid" ? formatRupiah(course.price || 0) : "Gratis";
}

async function loadPaymentSettings() {
  if (state.paymentSettings) return state.paymentSettings;
  state.paymentSettings = await getValue("system/settings/payment", {});
  return state.paymentSettings || {};
}

async function waitForProfile(uid, attempts = 8) {
  for (let i = 0; i < attempts; i += 1) {
    const profile = await getProfile(uid);
    if (profile) return profile;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  return null;
}

function cleanupMeetingPlayer() {
  if (state.currentMeeting && state.currentClassId && state.playerReady && state.player) {
    saveWatchProgress(state.currentClassId, state.currentMeeting.id).catch(() => {});
  }
  state.playing = false;
  clearInterval(state.watchHeartbeatTimer);
  clearInterval(state.watchSaveTimer);
  clearTimeout(state.notesSaveTimer);
  state.watchHeartbeatTimer = null;
  state.watchSaveTimer = null;
  state.notesSaveTimer = null;
  if (state.player?.destroy) {
    try { state.player.destroy(); } catch (_) {}
  }
  state.player = null;
  state.playerReady = false;
  state.currentMeeting = null;
  state.currentClassId = null;
  state.watchSeconds = 0;
}

function openModal({ title, subtitle = "", body = "", size = "", footer = "" }) {
  const root = qs("#modalRoot");
  root.innerHTML = `
    <section class="modal ${size ? `modal-${size}` : ""}" role="dialog" aria-modal="true">
      <header class="modal-head">
        <div><h3>${escapeHtml(title)}</h3>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}</div>
        <button class="modal-close" data-close-modal aria-label="Tutup">×</button>
      </header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}
    </section>`;
  root.classList.add("show");
  root.setAttribute("aria-hidden", "false");
  root.querySelector("[data-close-modal]")?.addEventListener("click", closeModal);
  root.onclick = modalBackdropClose;
  return root.querySelector(".modal");
}

function modalBackdropClose(event) {
  if (event.target === qs("#modalRoot")) closeModal();
}

function closeModal() {
  const root = qs("#modalRoot");
  root.classList.remove("show");
  root.setAttribute("aria-hidden", "true");
  root.onclick = null;
  root.innerHTML = "";
}

function renderAuth(defaultTab = "login") {
  qs("#appRoot").classList.add("hidden");
  const root = qs("#authRoot");
  root.classList.remove("hidden");
  root.innerHTML = `
    <main class="auth-page public-auth-page">
      <section class="auth-shell public-auth-shell">
        <div class="auth-hero">
          <div class="auth-brand">
            <img src="assets/logo-izzuddin.png" alt="Logo Izzuddin Academy">
            <div><strong>IZZUDDIN ACADEMY</strong><span>Digital Learning Platform</span></div>
          </div>
          <div class="auth-copy">
            <span class="eyebrow">Belajar dari Mana Saja</span>
            <h1>Temukan kelas. <span>Mulai bertumbuh.</span></h1>
            <p>Daftar secara mandiri, pilih kelas gratis atau berbayar, lalu ikuti video, materi, diskusi, kuis, dan tugas dalam satu aplikasi belajar modern.</p>
            <div class="auth-features">
              <div class="auth-feature"><b>Video Terintegrasi</b><span>Materi YouTube dan Google Drive tampil langsung di ruang belajar.</span></div>
              <div class="auth-feature"><b>Kelas Fleksibel</b><span>Pilih kelas gratis maupun kelas premium sesuai kebutuhan.</span></div>
              <div class="auth-feature"><b>Progres Terukur</b><span>Pantau penyelesaian video, kuis, tugas, dan capaian belajar.</span></div>
            </div>
          </div>
        </div>
        <div class="auth-panel">
          <div class="auth-box">
            <div class="mobile-logo"><img src="assets/logo-izzuddin.png" alt="Logo Izzuddin Academy"><div><b>IZZUDDIN ACADEMY</b><span>Digital Learning Platform</span></div></div>
            <div class="auth-tabs" role="tablist">
              <button class="auth-tab ${defaultTab === "login" ? "active" : ""}" data-auth-tab="login">Masuk</button>
              <button class="auth-tab ${defaultTab === "register" ? "active" : ""}" data-auth-tab="register">Daftar</button>
            </div>

            <section class="auth-tab-panel ${defaultTab === "login" ? "active" : ""}" data-auth-panel="login">
              <div class="auth-kicker">Ruang Belajar Anda</div>
              <h2>Selamat datang</h2>
              <p>Masuk untuk membuka kelas, materi, dan progres belajar.</p>
              <div id="loginError" class="form-error"></div>
              <form id="loginForm" class="stack">
                <div class="form-group"><label class="form-label">Email</label><div class="input-icon-wrap"><span class="input-icon">@</span><input id="loginEmail" class="form-control" type="email" autocomplete="email" required placeholder="nama@email.com"></div></div>
                <div class="form-group"><label class="form-label">Kata sandi</label><div class="input-icon-wrap"><span class="input-icon">▣</span><input id="loginPassword" class="form-control" type="password" autocomplete="current-password" required placeholder="••••••••"><button type="button" class="input-action" id="togglePassword" aria-label="Tampilkan kata sandi">${icon("eye")}</button></div></div>
                <button class="btn btn-primary btn-lg btn-block" id="loginButton" type="submit">Masuk ke Izzuddin Academy ${icon("arrow")}</button>
              </form>
              <div class="auth-help-row"><button class="link-btn" id="forgotPassword">Lupa kata sandi?</button></div>
            </section>

            <section class="auth-tab-panel ${defaultTab === "register" ? "active" : ""}" data-auth-panel="register">
              <div class="auth-kicker">Pendaftaran Pelajar</div>
              <h2>Buat akun baru</h2>
              <p>Daftar gratis untuk melihat seluruh katalog kelas Izzuddin Academy.</p>
              <div id="registerError" class="form-error"></div>
              <form id="registerForm" class="stack">
                <div class="form-group"><label class="form-label">Nama lengkap</label><input id="registerName" class="form-control" required autocomplete="name" placeholder="Nama lengkap"></div>
                <div class="form-grid auth-register-grid">
                  <div class="form-group"><label class="form-label">Email</label><input id="registerEmail" class="form-control" type="email" required autocomplete="email" placeholder="nama@email.com"></div>
                  <div class="form-group"><label class="form-label">Nomor WhatsApp</label><input id="registerPhone" class="form-control" type="tel" required autocomplete="tel" placeholder="08xxxxxxxxxx"></div>
                  <div class="form-group"><label class="form-label">Kata sandi</label><input id="registerPassword" class="form-control" type="password" minlength="8" required autocomplete="new-password" placeholder="Minimal 8 karakter"></div>
                  <div class="form-group"><label class="form-label">Ulangi kata sandi</label><input id="registerPasswordConfirm" class="form-control" type="password" minlength="8" required autocomplete="new-password" placeholder="Ulangi kata sandi"></div>
                </div>
                <label class="check-row"><input id="registerAgree" type="checkbox" required><span>Saya menyetujui penggunaan data untuk keperluan administrasi pembelajaran.</span></label>
                <button class="btn btn-primary btn-lg btn-block" id="registerButton" type="submit">Daftar dan Lihat Kelas ${icon("arrow")}</button>
              </form>
            </section>
            <div class="auth-footer">© 2026 IZZUDDIN ACADEMY</div>
          </div>
        </div>
      </section>
    </main>`;

  qsa("[data-auth-tab]").forEach((button) => button.addEventListener("click", () => {
    qsa("[data-auth-tab]").forEach((item) => item.classList.toggle("active", item === button));
    qsa("[data-auth-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.authPanel === button.dataset.authTab));
  }));
  qs("#togglePassword")?.addEventListener("click", () => {
    const input = qs("#loginPassword");
    input.type = input.type === "password" ? "text" : "password";
  });
  qs("#loginForm")?.addEventListener("submit", handleLogin);
  qs("#registerForm")?.addEventListener("submit", handleRegistration);
  qs("#forgotPassword")?.addEventListener("click", handleForgotPassword);
}

async function handleLogin(event) {
  event.preventDefault();
  const email = qs("#loginEmail").value.trim().toLowerCase();
  const password = qs("#loginPassword").value;
  const button = qs("#loginButton");
  const errorBox = qs("#loginError");
  errorBox.classList.remove("show");
  button.disabled = true;
  button.textContent = "Memeriksa akun...";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    errorBox.textContent = friendlyError(error);
    errorBox.classList.add("show");
    button.disabled = false;
    button.textContent = `Masuk ke Izzuddin Academy ${icon("arrow")}`;
  }
}

async function handleForgotPassword() {
  const email = qs("#loginEmail")?.value.trim().toLowerCase();
  if (!email) {
    toast("Isi email terlebih dahulu, lalu tekan Lupa kata sandi.", "warning");
    qs("#loginEmail")?.focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    toast("Tautan pengaturan ulang kata sandi telah dikirim ke email.", "success");
  } catch (error) {
    toast(friendlyError(error), "error");
  }
}


async function handleRegistration(event) {
  event.preventDefault();
  const name = qs("#registerName").value.trim();
  const email = qs("#registerEmail").value.trim().toLowerCase();
  const phone = qs("#registerPhone").value.trim();
  const password = qs("#registerPassword").value;
  const confirmation = qs("#registerPasswordConfirm").value;
  const button = qs("#registerButton");
  const errorBox = qs("#registerError");
  errorBox.classList.remove("show");
  if (!name || !email || !phone) return toast("Lengkapi nama, email, dan nomor WhatsApp.", "warning");
  if (password.length < 8) return toast("Kata sandi minimal 8 karakter.", "warning");
  if (password !== confirmation) return toast("Ulangan kata sandi belum sama.", "warning");
  state.registrationInProgress = true;
  button.disabled = true;
  button.textContent = "Membuat akun...";
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const now = Date.now();
    await updateValues({
      [`users/${credential.user.uid}`]: { name, email, phone, role: "student", status: "active", registrationSource: "self", createdAt: now, updatedAt: now },
      [`publicProfiles/${credential.user.uid}`]: { name, role: "student", avatar: "", updatedAt: now }
    });
    state.registrationInProgress = false;
    toast("Pendaftaran berhasil. Selamat datang di Izzuddin Academy.", "success");
    location.hash = "#/catalog";
  } catch (error) {
    state.registrationInProgress = false;
    errorBox.textContent = friendlyError(error);
    errorBox.classList.add("show");
    button.disabled = false;
    button.textContent = `Daftar dan Lihat Kelas ${icon("arrow")}`;
  }
}

function navigationGroups(role) {
  const r = normalizeRole(role);
  if (r === "admin") return [
    { label: "Ruang Belajar", items: [
      { id: "dashboard", label: "Beranda", icon: "home" },
      { id: "classes", label: "Kelas", icon: "classes" },
      { id: "schedule", label: "Video", icon: "video" },
      { id: "assignments", label: "Tugas", icon: "tasks" }
    ]},
    { label: "Komunikasi", items: [
      { id: "chat", label: "Live Chat Peserta", icon: "chat" }
    ]},
    { label: "Manajemen", items: [
      { id: "payments", label: "Pembayaran", icon: "upload" },
      { id: "users", label: "Pengguna", icon: "users" },
      { id: "reports", label: "Laporan Belajar", icon: "report" },
      { id: "announcements", label: "Pengumuman", icon: "announce" },
      { id: "settings", label: "Pengaturan", icon: "settings" }
    ]}
  ];
  if (r === "teacher") return [
    { label: "Ruang Belajar", items: [
      { id: "dashboard", label: "Beranda", icon: "home" },
      { id: "classes", label: "Kelas Saya", icon: "classes" },
      { id: "schedule", label: "Video", icon: "video" },
      { id: "assignments", label: "Tugas", icon: "tasks" }
    ]},
    { label: "Manajemen", items: [
      { id: "reports", label: "Laporan Belajar", icon: "report" },
      { id: "announcements", label: "Pengumuman", icon: "announce" },
      { id: "settings", label: "Pengaturan", icon: "settings" }
    ]}
  ];
  return [
    { label: "Ruang Belajar", items: [
      { id: "dashboard", label: "Beranda", icon: "home" },
      { id: "catalog", label: "Jelajahi Kelas", icon: "search" },
      { id: "classes", label: "Kelas Saya", icon: "classes" },
      { id: "schedule", label: "Video", icon: "video" },
      { id: "assignments", label: "Tugas", icon: "tasks" }
    ]},
    { label: "Bantuan", items: [
      { id: "chat", label: "Live Chat Admin", icon: "chat" }
    ]},
    { label: "Akun", items: [
      { id: "reports", label: "Progres Saya", icon: "report" },
      { id: "announcements", label: "Pengumuman", icon: "announce" },
      { id: "settings", label: "Pengaturan", icon: "settings" }
    ]}
  ];
}

function roleNavigation(role) {
  return navigationGroups(role).flatMap((group) => group.items);
}

function mobileNavigation(role) {
  const r = normalizeRole(role);
  const all = roleNavigation(r);
  const preferred = r === "student"
    ? ["dashboard", "catalog", "classes", "assignments"]
    : r === "admin"
      ? ["dashboard", "classes", "payments", "announcements"]
      : ["dashboard", "classes", "schedule", "assignments", "announcements"];
  return preferred.map((id) => all.find((item) => item.id === id)).filter(Boolean);
}

function navButton(item) {
  const count = item.id === "payments"
    ? `<span class="nav-count hidden" data-payment-count>0</span>`
    : item.id === "chat"
      ? `<span class="nav-count hidden" data-chat-count>0</span>`
      : "";
  return `<button class="nav-item" data-route="${item.id}"><span class="nav-icon">${icon(item.icon)}</span><span class="nav-label">${escapeHtml(item.label)}</span>${count}</button>`;
}

function renderShell() {
  qs("#authRoot").classList.add("hidden");
  const root = qs("#appRoot");
  root.classList.remove("hidden");
  const role = normalizeRole(state.profile.role);
  const groups = navigationGroups(role);
  const mobileNav = mobileNavigation(role);
  const chatEnabled = canUseSupportChat(role);
  root.innerHTML = `
    <div class="app-shell" data-app-role="${role}">
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <aside class="sidebar">
        <div class="sidebar-brand"><img src="assets/logo-izzuddin.png" alt="Logo Izzuddin Academy"><div><strong>IZZUDDIN ACADEMY</strong><span>Digital Learning Platform</span></div></div>
        <div class="sidebar-year"><b>Tahun Ajaran ${escapeHtml(appConfig.academicYear)}</b><span>Learning Management System</span></div>
        ${chatEnabled ? `<button class="desktop-chat-shortcut" data-route="chat"><span class="desktop-chat-shortcut-icon">${icon("chat")}</span><span><b>${role === "admin" ? "Live Chat Peserta" : "Live Chat Admin"}</b><small>${role === "admin" ? "Balas pesan peserta" : "Hubungi tim Izzuddin Academy"}</small></span><em class="hidden" data-chat-count>0</em></button>` : ""}
        <nav class="sidebar-nav">
          ${groups.map((group) => `<div class="nav-group${group.items.every((item) => item.id === "chat") ? " nav-group-chat-only" : ""}"><div class="nav-section-label">${escapeHtml(group.label)}</div>${group.items.map(navButton).join("")}</div>`).join("")}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user"><div class="avatar">${initials(state.profile.name)}</div><div><b>${escapeHtml(state.profile.name)}</b><span>${escapeHtml(roleLabel(role))}</span></div></div>
          <button id="logoutButton" class="btn btn-ghost sidebar-logout">${icon("logout")} Keluar</button>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar">
          <div class="topbar-left">
            <button class="icon-btn mobile-menu" id="mobileMenu" aria-label="Buka menu">${icon("menu")}</button>
            <div class="page-title"><small>Izzuddin Learning Space</small><h1 id="topPageTitle">Beranda</h1></div>
          </div>
          <div class="topbar-right">
            <div class="topbar-search"><span>${icon("search")}</span><input id="globalSearch" placeholder="Cari kelas, video, atau tugas..."></div>
            ${chatEnabled ? `<button class="topbar-chat-pill" data-route="chat" title="Live Chat" aria-label="Buka Live Chat"><span>${icon("chat")}</span><b>Live Chat</b><em class="hidden" data-chat-count>0</em></button>` : ""}
            <button class="icon-btn notification-button" id="quickAnnouncement" title="Notifikasi" aria-label="Notifikasi">${icon("bell")}<span id="notificationDot" class="notification-dot hidden">0</span></button>
            <div class="topbar-profile"><div class="avatar">${initials(state.profile.name)}</div><div class="profile-copy"><b>${escapeHtml(state.profile.name)}</b><span>${escapeHtml(roleLabel(role))}</span></div></div>
          </div>
        </header>
        <div id="pageContent" class="page-content"></div>
      </main>
      <nav class="mobile-bottom-nav" aria-label="Navigasi utama" style="--mobile-nav-count:${mobileNav.length}">
        ${mobileNav.map((item) => `<button class="bottom-nav-item" data-route="${item.id}"><span>${icon(item.icon)}</span><b>${escapeHtml(item.label.replace(" Saya", "").replace(" Admin", "").replace(" Peserta", ""))}</b></button>`).join("")}
      </nav>
      ${chatEnabled ? `<button class="chat-fab" data-route="chat" aria-label="Buka Live Chat"><span>${icon("chat")}</span><b>Chat</b><em class="hidden" data-chat-count>0</em></button>` : ""}
    </div>`;

  qsa("[data-route]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.route)));
  qs("#logoutButton")?.addEventListener("click", async () => {
    cleanupMeetingPlayer();
    clearSubscriptions();
    await signOut(auth);
  });
  qs("#mobileMenu")?.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
  qs("#sidebarOverlay")?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  qs("#quickAnnouncement")?.addEventListener("click", () => navigate(isAdminRole() ? "payments" : "announcements"));
  clearGlobalSubscriptions();
  initPaymentNotificationWatcher();
  initChatNotificationWatcher();
  qs("#globalSearch")?.addEventListener("input", debounce((event) => globalSearch(event.target.value), 350));
}

function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean);
  return { name: parts[0] || "dashboard", params: parts.slice(1) };
}

function navigate(name, ...params) {
  location.hash = `#/${[name, ...params].join("/")}`;
  document.body.classList.remove("sidebar-open");
}

function setActiveNav(name) {
  qsa(".nav-item, .bottom-nav-item").forEach((el) => el.classList.toggle("active", el.dataset.route === name));
  document.body.classList.toggle("chat-route-active", name === "chat");
  qs("#topPageTitle").textContent = routeTitles[name] || "Izzuddin Academy";
}

async function route() {
  if (!state.user || !state.profile) return;
  cleanupMeetingPlayer();
  clearSubscriptions();
  const { name, params } = currentRoute();
  setActiveNav(name);
  const page = qs("#pageContent");
  page.innerHTML = `<div class="empty-state"><div class="empty-icon">◌</div><h3>Menyiapkan halaman...</h3></div>`;
  try {
    if (name === "dashboard") await renderDashboard();
    else if (name === "catalog" && isStudentRole()) await renderCatalog();
    else if (name === "classes") await renderClasses();
    else if (name === "schedule") await renderSchedule();
    else if (name === "assignments") await renderAssignments();
    else if (name === "users" && isAdminRole()) await renderUsers();
    else if (name === "payments" && isAdminRole()) await renderPayments();
    else if (name === "chat" && canUseSupportChat()) await renderChat(params[0] || "");
    else if (name === "reports") await renderReports();
    else if (name === "announcements") await renderAnnouncements();
    else if (name === "settings") await renderSettings();
    else if (name === "class" && params[0]) await renderClassDetail(params[0]);
    else if (name === "meeting" && params[0] && params[1]) await renderMeetingRoom(params[0], params[1]);
    else navigate(isStudentRole() ? "catalog" : "dashboard");
  } catch (error) {
    console.error(error);
    page.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">!</div><h3>Halaman tidak dapat dimuat</h3><p>${escapeHtml(friendlyError(error))}</p><button class="btn btn-primary" onclick="location.reload()">Muat Ulang</button></div></div>`;
  }
}

async function loadClassBundle() {
  state.classes = await getMyClasses(state.user.uid, state.profile.role);
  const bundles = await Promise.all(state.classes.map(async (course) => {
    const [meetings, assignments] = await Promise.all([getMeetings(course.id), getAssignments(course.id)]);
    return { course, meetings, assignments };
  }));
  return bundles;
}

function meetingBadge(status) {
  return `<span class="badge badge-${status} badge-dot">${escapeHtml(statusLabel(status))}</span>`;
}

function emptyState(title, description, action = "") {
  return `<div class="empty-state"><div class="empty-icon">✦</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${action}</div>`;
}

async function renderDashboard() {
  const bundles = await loadClassBundle();
  const allMeetings = bundles.flatMap(({ course, meetings }) => meetings.map((meeting) => ({ ...meeting, classId: course.id, classTitle: course.title })));
  const allAssignments = bundles.flatMap(({ course, assignments }) => assignments.map((assignment) => ({ ...assignment, classId: course.id, classTitle: course.title })));
  const availableVideos = allMeetings.filter((item) => videoAvailability(item).key === "available").sort((a,b) => new Date(b.startAt || 0) - new Date(a.startAt || 0));
  const scheduledVideos = allMeetings.filter((item) => videoAvailability(item).key === "upcoming").sort((a,b) => new Date(a.startAt || 0) - new Date(b.startAt || 0));
  const pendingTasks = allAssignments.filter((item) => !item.dueAt || new Date(item.dueAt).getTime() >= Date.now());
  const announcements = sortByDate(objectToArray(await getValue("announcements", {})), "createdAt")
    .filter((item) => isAdminRole() || !item.target || item.target === "all" || item.target === state.profile.role)
    .slice(0, 4);
  let studentProgress = 0;
  if (isStudentRole()) {
    let total = 0, count = 0;
    for (const meeting of allMeetings) {
      const item = await getValue(`watchProgress/${meeting.classId}/${meeting.id}/${state.user.uid}`);
      if (item) { total += Number(item.percent || 0); count += 1; }
    }
    studentProgress = count ? Math.round(total / count) : 0;
  }
  const heroPrimary = scheduledVideos[0] || availableVideos[0];
  const greeting = new Date().getHours() < 11 ? "Selamat pagi" : new Date().getHours() < 15 ? "Selamat siang" : new Date().getHours() < 19 ? "Selamat sore" : "Selamat malam";
  qs("#pageContent").innerHTML = `
    <section class="hero-card card"><div class="hero-content"><span class="eyebrow">${escapeHtml(greeting)}, ${escapeHtml(state.profile.name.split(" ")[0])}</span><h2>${isStudentRole() ? "Temukan kelas yang tepat dan lanjutkan progres belajar Anda." : "Kelola pembelajaran yang rapi, terukur, dan bermakna."}</h2><p>${heroPrimary ? `${videoAvailability(heroPrimary).label}: ${escapeHtml(heroPrimary.title)} — ${escapeHtml(heroPrimary.classTitle)}.` : "Belum ada video pembelajaran pada kelas Anda."}</p><div class="hero-actions">${heroPrimary ? `<button class="btn btn-primary" data-open-meeting="${heroPrimary.classId}|${heroPrimary.id}">Buka Video ${icon("arrow")}</button>` : ""}<button class="btn btn-secondary" data-route-action="${isStudentRole() ? "catalog" : "classes"}">${isStudentRole() ? "Jelajahi Kelas" : "Lihat Semua Kelas"}</button></div></div><div class="hero-side"><div class="hero-mini"><span>Kelas diikuti</span><b>${state.classes.length}</b></div><div class="hero-mini"><span>${isStudentRole() ? "Rata-rata progres" : "Video tersedia"}</span><b>${isStudentRole() ? `${studentProgress}%` : availableVideos.length}</b></div></div></section>
    <section class="stats-grid"><article class="stat-card"><div class="stat-icon">${icon("classes")}</div><div class="stat-value">${state.classes.length}</div><div class="stat-label">Kelas dalam ruang belajar</div></article><article class="stat-card"><div class="stat-icon">${icon("video")}</div><div class="stat-value">${availableVideos.length}</div><div class="stat-label">Video tersedia</div></article><article class="stat-card"><div class="stat-icon">${icon("calendar")}</div><div class="stat-value">${scheduledVideos.length}</div><div class="stat-label">Video terjadwal</div></article><article class="stat-card"><div class="stat-icon">${icon("tasks")}</div><div class="stat-value">${pendingTasks.length}</div><div class="stat-label">Tugas aktif</div></article></section>
    <div class="grid grid-sidebar" style="margin-top:18px"><section class="card"><div class="card-head"><div><h3>Video Pembelajaran</h3><p>Video terbaru dan yang telah dijadwalkan.</p></div><button class="link-btn" data-route-action="schedule">Lihat semua</button></div><div class="card-body"><div class="list">${[...scheduledVideos, ...availableVideos].slice(0,6).map((meeting) => `<div class="list-item"><div class="list-icon">${icon("video")}</div><div class="list-copy"><b>${escapeHtml(meeting.title)}</b><span>${escapeHtml(meeting.classTitle)} · ${meeting.startAt ? formatDateTime(meeting.startAt) : "Dapat diputar kapan saja"}</span></div><div class="list-actions"><span class="badge badge-${videoAvailability(meeting).key}">${videoAvailability(meeting).label}</span><button class="btn btn-primary btn-sm" data-open-meeting="${meeting.classId}|${meeting.id}">Buka</button></div></div>`).join("") || emptyState("Belum ada video", "Video pembelajaran akan tampil di sini.")}</div></div></section><aside class="stack"><section class="card"><div class="card-head"><div><h3>Pengumuman</h3><p>Informasi terbaru untuk seluruh pengguna.</p></div></div><div class="card-body"><div class="list">${announcements.map((item) => `<div class="list-item"><div class="list-icon">${icon("announce")}</div><div class="list-copy"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.body || "").slice(0,90)}${String(item.body || "").length > 90 ? "…" : ""}</span></div></div>`).join("") || emptyState("Belum ada pengumuman", "Informasi penting akan tampil di sini.")}</div></div></section><section class="card card-pad"><div class="section-title" style="margin-top:0"><div><h3>Akses Cepat</h3><p>Menu yang sering digunakan.</p></div></div><div class="grid grid-2" style="gap:10px"><button class="btn btn-secondary" data-route-action="${isStudentRole() ? "catalog" : "classes"}">${icon("classes")} Kelas</button><button class="btn btn-secondary" data-route-action="assignments">${icon("tasks")} Tugas</button><button class="btn btn-secondary" data-route-action="schedule">${icon("video")} Video</button><button class="btn btn-secondary" data-route-action="settings">${icon("settings")} Profil</button></div></section></aside></div>`;
  bindCommonPageActions();
}

function bindCommonPageActions() {
  qsa("[data-route-action]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.routeAction)));
  qsa("[data-open-meeting]").forEach((el) => el.addEventListener("click", () => {
    const [classId, meetingId] = el.dataset.openMeeting.split("|");
    navigate("meeting", classId, meetingId);
  }));
  qsa("[data-open-class]").forEach((el) => el.addEventListener("click", () => navigate("class", el.dataset.openClass)));
}

async function globalSearch(term) {
  const value = String(term || "").trim().toLowerCase();
  if (value.length < 2) return;
  const bundles = await loadClassBundle();
  const matches = [];
  bundles.forEach(({ course, meetings, assignments }) => {
    if (`${course.title} ${course.description || ""}`.toLowerCase().includes(value)) matches.push({ type: "Kelas", title: course.title, detail: course.description || "", action: () => navigate("class", course.id) });
    meetings.forEach((meeting) => { if (`${meeting.title} ${meeting.description || ""}`.toLowerCase().includes(value)) matches.push({ type: "Video", title: meeting.title, detail: course.title, action: () => navigate("meeting", course.id, meeting.id) }); });
    assignments.forEach((assignment) => { if (`${assignment.title} ${assignment.description || ""}`.toLowerCase().includes(value)) matches.push({ type: "Tugas", title: assignment.title, detail: course.title, action: () => navigate("assignments") }); });
  });
  const modal = openModal({ title: `Hasil pencarian “${term}”`, subtitle: `${matches.length} hasil ditemukan`, body: `<div class="list">${matches.slice(0,20).map((m,i) => `<button class="list-item" style="width:100%;text-align:left" data-search-result="${i}"><div class="list-icon">${icon("search")}</div><div class="list-copy"><b>${escapeHtml(m.title)}</b><span>${escapeHtml(m.type)} · ${escapeHtml(m.detail)}</span></div></button>`).join("") || emptyState("Tidak ditemukan", "Coba gunakan kata kunci lain.")}</div>` });
  modal.querySelectorAll("[data-search-result]").forEach((el) => el.addEventListener("click", () => { closeModal(); matches[Number(el.dataset.searchResult)].action(); }));
}


function flattenPaymentRequests(data = {}) {
  const rows = [];
  Object.entries(data || {}).forEach(([studentUid, classes]) => {
    Object.entries(classes || {}).forEach(([classId, request]) => rows.push({ studentUid, classId, ...(request || {}) }));
  });
  return rows.sort((a,b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0));
}

function initPaymentNotificationWatcher() {
  if (state.profile?.role !== "admin") return;
  const unsubscribe = subscribe("paymentRequests", (data) => {
    const pending = flattenPaymentRequests(data).filter((item) => item.status === "pending").length;
    const previous = state.pendingPayments;
    state.pendingPayments = pending;
    const dot = qs("#notificationDot");
    if (dot) {
      dot.textContent = pending > 99 ? "99+" : String(pending);
      dot.classList.toggle("hidden", pending === 0);
    }
    qsa('[data-payment-count]').forEach((el) => { el.textContent = pending; el.classList.toggle("hidden", pending === 0); });
    if (pending > previous && previous > 0) toast("Ada bukti pembayaran baru yang perlu diperiksa.", "info", "Pembayaran Baru");
  });
  state.globalUnsubscribers.push(unsubscribe);
}


function chatMessages(chat = {}) {
  return objectToArray(chat?.messages || {}).sort((a,b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

function chatLastMessage(chat = {}) {
  const messages = chatMessages(chat);
  return messages[messages.length - 1] || null;
}

function chatUnreadCount(chat = {}, viewerRole = "student") {
  const readAt = Number(chat?.reads?.[viewerRole] || 0);
  const otherRole = viewerRole === "admin" ? "student" : "admin";
  return chatMessages(chat).filter((message) => message.senderRole === otherRole && Number(message.createdAt || 0) > readAt).length;
}

function initChatNotificationWatcher() {
  if (!state.user || !state.profile || !canUseSupportChat()) return;
  const path = isAdminRole() ? "supportChats" : `supportChats/${state.user.uid}`;
  const unsubscribe = subscribe(path, (data) => {
    let unread = 0;
    if (isAdminRole()) {
      Object.values(data || {}).forEach((chat) => { unread += chatUnreadCount(chat || {}, "admin"); });
    } else {
      unread = chatUnreadCount(data || {}, "student");
    }
    state.chatUnread = unread;
    qsa("[data-chat-count]").forEach((el) => {
      el.textContent = unread > 99 ? "99+" : String(unread);
      el.classList.toggle("hidden", unread === 0);
    });
  });
  state.globalUnsubscribers.push(unsubscribe);
}

function chatTime(value) {
  if (!value) return "";
  const date = new Date(Number(value));
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : formatShortDate(Number(value));
}

function renderChatMessages(messages = [], studentUid = "") {
  if (!messages.length) return `<div class="chat-empty"><div>${icon("chat")}</div><b>Mulai percakapan</b><span>Tulis pesan di bawah. Pesan akan muncul secara realtime.</span></div>`;
  return messages.map((message) => {
    const mine = message.senderUid === state.user.uid;
    return `<div class="chat-message-row ${mine ? "mine" : "theirs"}"><div class="chat-bubble"><div class="chat-bubble-head"><b>${escapeHtml(message.senderName || (mine ? state.profile.name : "Izzuddin Academy"))}</b><span>${escapeHtml(chatTime(message.createdAt))}</span></div><p>${escapeHtml(message.body || "").replace(/\n/g,"<br>")}</p></div></div>`;
  }).join("");
}

async function markChatRead(studentUid) {
  if (!studentUid || !state.profile) return;
  const role = isAdminRole() ? "admin" : "student";
  try { await setValue(`supportChats/${studentUid}/reads/${role}`, Date.now()); } catch (_) {}
}

async function sendChatMessage(studentUid, input, button) {
  const body = input?.value.trim();
  if (!body || !studentUid) return;
  if (body.length > 3000) return toast("Pesan maksimal 3.000 karakter.", "warning");
  const original = button?.textContent || "Kirim";
  if (button) { button.disabled = true; button.textContent = "Mengirim..."; }
  try {
    await pushValue(`supportChats/${studentUid}/messages`, {
      senderUid: state.user.uid,
      senderRole: state.profile.role,
      senderName: state.profile.name,
      body,
      createdAt: Date.now()
    });
    input.value = "";
    await markChatRead(studentUid);
  } catch (error) {
    toast(friendlyError(error), "error");
  } finally {
    if (button) { button.disabled = false; button.textContent = original; }
    input?.focus();
  }
}

function chatConversationShell(student, messages = [], adminMode = false) {
  const title = adminMode ? (student?.name || "Peserta") : "Admin Izzuddin Academy";
  const subtitle = adminMode ? `${student?.email || ""}${student?.phone ? ` · ${student.phone}` : ""}` : "Tim Izzuddin Academy";
  return `<section class="chat-conversation-card">
    <header class="chat-conversation-head">${adminMode ? `<button class="icon-btn chat-mobile-back" id="chatBack">←</button>` : ""}<div class="avatar">${initials(title)}</div><div><b>${escapeHtml(title)}</b><span>${escapeHtml(subtitle)}</span></div>${adminMode && student?.phone ? `<a class="btn btn-ghost btn-sm chat-wa" href="https://wa.me/${normalizeWhatsapp(student.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</header>
    <div class="chat-messages" id="chatMessages">${renderChatMessages(messages, student?.uid || state.user.uid)}</div>
    <form class="chat-composer" id="chatComposer"><textarea id="chatInput" class="form-control" rows="1" maxlength="3000" placeholder="Tulis pesan..."></textarea><button class="btn btn-primary" id="chatSend" type="submit">Kirim</button></form>
  </section>`;
}

function scrollChatToBottom() {
  requestAnimationFrame(() => {
    const box = qs("#chatMessages");
    if (box) box.scrollTop = box.scrollHeight;
  });
}

async function renderChat(selectedUid = "") {
  if (isStudentRole()) {
    qs("#pageContent").innerHTML = `<div class="page-head"><div><h2>Live Chat</h2><p>Hubungi admin Izzuddin Academy langsung dari ruang belajar Anda.</p></div></div><div id="studentChatHost">${chatConversationShell(null, [], false)}</div>`;
    const uid = state.user.uid;
    const bindComposer = () => {
      const form = qs("#chatComposer");
      if (!form || form.dataset.bound) return;
      form.dataset.bound = "1";
      form.addEventListener("submit", (event) => { event.preventDefault(); sendChatMessage(uid, qs("#chatInput"), qs("#chatSend")); });
    };
    bindComposer();
    const unsubscribe = subscribe(`supportChats/${uid}`, async (chat) => {
      const messages = chatMessages(chat || {});
      const box = qs("#chatMessages");
      if (box) box.innerHTML = renderChatMessages(messages, uid);
      bindComposer();
      scrollChatToBottom();
      const newestAdmin = messages.filter((m) => m.senderRole === "admin").at(-1);
      if (newestAdmin && Number(newestAdmin.createdAt || 0) > Number(chat?.reads?.student || 0)) await markChatRead(uid);
    });
    state.unsubscribers.push(unsubscribe);
    scrollChatToBottom();
    return;
  }

  let usersData = {};
  let chatsData = {};
  qs("#pageContent").innerHTML = `<div class="page-head"><div><h2>Live Chat</h2><p>Percakapan realtime dengan peserta Izzuddin Academy.</p></div></div><div id="adminChatHost" class="chat-layout"></div>`;

  const refresh = () => {
    const students = objectToArray(usersData || {}).map((item) => ({ ...item, role: normalizeRole(item.role), uid: item.id })).filter((u) => normalizeRole(u.role) === "student" && u.status !== "inactive");
    const rows = students.map((student) => {
      const chat = chatsData?.[student.uid] || {};
      const last = chatLastMessage(chat);
      const unread = chatUnreadCount(chat, "admin");
      return { student, chat, last, unread, lastAt: Number(last?.createdAt || 0) };
    }).sort((a,b) => (b.unread > 0) - (a.unread > 0) || b.lastAt - a.lastAt || String(a.student.name || "").localeCompare(String(b.student.name || ""), "id"));
    const selected = rows.find((row) => row.student.uid === selectedUid) || (selectedUid ? null : rows.find((row) => row.unread > 0 || row.lastAt > 0)) || null;
    const host = qs("#adminChatHost");
    if (!host) return;
    host.innerHTML = `<aside class="chat-list-card ${selectedUid ? "mobile-hidden" : ""}"><div class="chat-list-search"><input class="form-control" id="chatSearch" placeholder="Cari peserta..."></div><div class="chat-list" id="chatList">${renderAdminChatRows(rows, selected?.student.uid || "")}</div></aside><div class="chat-conversation-host ${selectedUid ? "mobile-active" : ""}">${selected ? chatConversationShell(selected.student, chatMessages(selected.chat), true) : `<section class="chat-conversation-card"><div class="chat-empty"><div>✉</div><b>Pilih peserta</b><span>Pilih percakapan di sebelah kiri untuk mulai membalas.</span></div></section>`}</div>`;
    bindAdminChatList(rows);
    if (selected) {
      bindAdminChatComposer(selected.student.uid);
      const newestStudent = chatMessages(selected.chat).filter((m) => m.senderRole === "student").at(-1);
      if (newestStudent && Number(newestStudent.createdAt || 0) > Number(selected.chat?.reads?.admin || 0)) markChatRead(selected.student.uid);
      scrollChatToBottom();
    }
  };

  function renderAdminChatRows(rows, activeUid) { return rows.map(({ student, last, unread }) => `<button class="chat-list-item ${student.uid === activeUid ? "active" : ""}" data-chat-user="${student.uid}" data-chat-name="${escapeHtml((student.name || "").toLowerCase())}"><div class="avatar">${initials(student.name)}</div><div class="chat-list-copy"><div><b>${escapeHtml(student.name || "Peserta")}</b><span>${escapeHtml(chatTime(last?.createdAt))}</span></div><p>${escapeHtml(last?.body ? last.body.slice(0,70) : "Belum ada pesan")}</p></div>${unread ? `<em>${unread > 99 ? "99+" : unread}</em>` : ""}</button>`).join("") || `<div class="chat-empty small"><b>Belum ada peserta</b><span>Peserta yang terdaftar akan muncul di sini.</span></div>`; }

  function bindAdminChatList(rows) {
    qsa("[data-chat-user]").forEach((button) => button.addEventListener("click", () => navigate("chat", button.dataset.chatUser)));
    qs("#chatSearch")?.addEventListener("input", (event) => {
      const term = event.target.value.trim().toLowerCase();
      qsa("[data-chat-user]").forEach((item) => item.classList.toggle("hidden", term && !item.dataset.chatName.includes(term)));
    });
  }

  function bindAdminChatComposer(uid) {
    qs("#chatBack")?.addEventListener("click", () => navigate("chat"));
    const form = qs("#chatComposer");
    if (form) form.addEventListener("submit", (event) => { event.preventDefault(); sendChatMessage(uid, qs("#chatInput"), qs("#chatSend")); });
  }

  const unsubUsers = subscribe("users", (data) => { usersData = data || {}; refresh(); });
  const unsubChats = subscribe("supportChats", (data) => { chatsData = data || {}; refresh(); });
  state.unsubscribers.push(unsubUsers, unsubChats);
}

function catalogCard(course, enrolled = false, request = null) {
  const paid = course.accessType === "paid";
  const status = request?.status || "";
  let button = "";
  if (enrolled || status === "approved") button = `<button class="btn btn-primary btn-sm" data-open-class="${course.id}">Buka Kelas</button>`;
  else if (!paid) button = `<button class="btn btn-primary btn-sm" data-enroll-free="${course.id}">Ikuti Gratis</button>`;
  else if (status === "pending") button = `<button class="btn btn-secondary btn-sm" disabled>Menunggu Verifikasi</button>`;
  else button = `<button class="btn btn-primary btn-sm" data-buy-class="${course.id}">${status === "rejected" ? "Kirim Ulang Bukti" : "Daftar Kelas"}</button>`;
  return `<article class="class-card catalog-card">
    <div class="class-cover ${escapeHtml(course.accent || "blue")}"><div class="class-cover-top"><span class="class-category">${escapeHtml(course.category || "Kelas")}</span><span class="price-badge ${paid ? "paid" : "free"}">${paid ? formatRupiah(course.price || 0) : "Gratis"}</span></div><h3>${escapeHtml(course.title)}</h3></div>
    <div class="class-body"><p>${escapeHtml(course.description || "Ruang belajar Izzuddin Academy.")}</p><div class="class-meta"><span>${escapeHtml(course.teacherName || "Pengajar Izzuddin")}</span><span>${course.accessType === "paid" ? "Kelas Berbayar" : "Kelas Gratis"}</span></div>${status === "rejected" && request?.adminNote ? `<div class="payment-rejected-note">Catatan admin: ${escapeHtml(request.adminNote)}</div>` : ""}<div class="catalog-actions">${button}</div></div>
  </article>`;
}

async function renderCatalog() {
  const [classes, memberships, requests] = await Promise.all([
    getAllClasses(),
    getValue(`userClasses/${state.user.uid}`, {}),
    getValue(`paymentRequests/${state.user.uid}`, {})
  ]);
  qs("#pageContent").innerHTML = `
    <section class="catalog-hero"><div><span class="eyebrow">Katalog Izzuddin Academy</span><h2>Pilih kelas yang membantu Anda bertumbuh.</h2><p>Mulai dari kelas gratis atau daftar kelas premium melalui transfer dan persetujuan admin.</p></div><div class="catalog-hero-stat"><b>${classes.length}</b><span>Kelas tersedia</span></div></section>
    <div class="page-head"><div><h2>Jelajahi Kelas</h2><p>Setelah terdaftar, kelas dapat diakses dari menu Kelas Saya.</p></div></div>
    <div class="filter-row"><input class="form-control" id="catalogSearch" placeholder="Cari kelas atau pengajar..."><select class="form-control" id="catalogAccess"><option value="">Semua kelas</option><option value="free">Gratis</option><option value="paid">Berbayar</option></select></div>
    <section id="catalogGrid" class="class-grid">${classes.map((course) => catalogCard(course, Boolean(memberships?.[course.id]), requests?.[course.id])).join("") || emptyState("Belum ada kelas", "Katalog kelas akan segera tersedia.")}</section>`;
  const apply = () => {
    const term = qs("#catalogSearch").value.trim().toLowerCase();
    const access = qs("#catalogAccess").value;
    const filtered = classes.filter((course) => (!term || `${course.title} ${course.category || ""} ${course.teacherName || ""}`.toLowerCase().includes(term)) && (!access || (course.accessType || "free") === access));
    qs("#catalogGrid").innerHTML = filtered.map((course) => catalogCard(course, Boolean(memberships?.[course.id]), requests?.[course.id])).join("") || emptyState("Kelas tidak ditemukan", "Ubah kata kunci atau filter kelas.");
    bindCatalogActions(filtered, memberships, requests);
  };
  qs("#catalogSearch")?.addEventListener("input", apply);
  qs("#catalogAccess")?.addEventListener("change", apply);
  bindCatalogActions(classes, memberships, requests);
}

function bindCatalogActions(classes, memberships, requests) {
  bindCommonPageActions();
  qsa("[data-enroll-free]").forEach((button) => button.addEventListener("click", async () => {
    const classId = button.dataset.enrollFree;
    const course = classes.find((item) => item.id === classId);
    if (!course) return;
    button.disabled = true;
    button.textContent = "Mendaftarkan...";
    try {
      const now = Date.now();
      await updateValues({
        [`userClasses/${state.user.uid}/${classId}`]: true,
        [`classMembers/${classId}/${state.user.uid}`]: { role: "student", joinedAt: now, enrollmentType: "free" }
      });
      toast("Kelas gratis berhasil ditambahkan ke Kelas Saya.", "success");
      navigate("class", classId);
    } catch (error) {
      button.disabled = false;
      button.textContent = "Ikuti Gratis";
      toast(friendlyError(error), "error");
    }
  }));
  qsa("[data-buy-class]").forEach((button) => button.addEventListener("click", () => {
    const classId = button.dataset.buyClass;
    const course = classes.find((item) => item.id === classId);
    if (course) openPaymentForm(course, requests?.[classId] || null);
  }));
}

async function openPaymentForm(course, existing = null) {
  const settings = await loadPaymentSettings();
  const body = `<div class="payment-summary"><div><span>Kelas yang dipilih</span><b>${escapeHtml(course.title)}</b></div><div class="payment-amount-copy"><strong>${formatRupiah(course.price || 0)}</strong><button type="button" class="copy-chip" data-copy-value="${Number(course.price || 0)}" data-copy-message="Nominal pembayaran berhasil disalin.">Salin nominal</button></div></div>
    <div class="bank-card"><span>Transfer pembayaran ke</span><h3>${escapeHtml(settings.bankName || "Rekening pembayaran belum diatur")}</h3><div class="bank-account-copy"><b>${escapeHtml(settings.accountNumber || "—")}</b><button type="button" class="copy-chip light" data-copy-value="${escapeHtml(settings.accountNumber || "")}" data-copy-message="Nomor rekening berhasil disalin.">Salin no. rek</button></div><p>a.n. ${escapeHtml(settings.accountHolder || "Izzuddin Academy")}</p></div>
    ${settings.instructions ? `<div class="notice notice-info">${escapeHtml(settings.instructions)}</div>` : ""}
    <form class="form-grid" id="paymentForm"><div class="form-group full"><label class="form-label">Bukti transfer <span class="required">*</span></label><input id="paymentProof" class="form-control" type="file" accept="image/jpeg,image/png,image/webp" required><div class="form-help">Format JPG, PNG, atau WEBP. Gambar dikompres otomatis agar tetap ringan.</div></div><div class="form-group full"><label class="form-label">Catatan untuk admin</label><textarea id="paymentNote" class="form-control" placeholder="Contoh: Transfer atas nama ...">${escapeHtml(existing?.note || "")}</textarea></div></form>`;
  const modal = openModal({ title: "Daftar Kelas Berbayar", subtitle: "Transfer, unggah bukti, lalu tunggu persetujuan admin.", body, size: "sm", footer: `<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="submitPayment">Kirim Bukti Transfer</button>` });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelectorAll("[data-copy-value]").forEach((button) => button.addEventListener("click", () => copyText(button.dataset.copyValue, button.dataset.copyMessage)));
  modal.querySelector("#submitPayment")?.addEventListener("click", async () => {
    const file = modal.querySelector("#paymentProof").files?.[0];
    if (!file) return toast("Pilih bukti transfer terlebih dahulu.", "warning");
    const button = modal.querySelector("#submitPayment");
    const waNumber = normalizeWhatsapp(settings.adminWhatsapp || "");
    const waWindow = waNumber ? window.open("about:blank", "_blank") : null;
    button.disabled = true;
    button.textContent = "Menyiapkan bukti...";
    try {
      const proofData = await compressPaymentProof(file);
      const proofPath = `paymentProofs/${state.user.uid}/${course.id}`;
      const now = Date.now();
      button.textContent = "Mengirim bukti...";
      await setValue(proofPath, proofData);
      const payload = {
        classId: course.id,
        classTitle: course.title,
        price: Number(course.price || 0),
        studentUid: state.user.uid,
        studentName: state.profile.name,
        studentEmail: state.profile.email || state.user.email || "",
        studentPhone: state.profile.phone || "",
        proofType: "image/jpeg",
        note: modal.querySelector("#paymentNote").value.trim(),
        status: "pending",
        submittedAt: existing?.submittedAt || now,
        updatedAt: now
      };
      await setValue(`paymentRequests/${state.user.uid}/${course.id}`, payload);
      const message = `Assalamu'alaikum Admin Izzuddin Academy.%0A%0ASaya ${encodeURIComponent(state.profile.name)} telah mengunggah bukti pembayaran kelas ${encodeURIComponent(course.title)} sebesar ${encodeURIComponent(formatRupiah(course.price || 0))}.%0AMohon verifikasinya. Terima kasih.`;
      if (waWindow && waNumber) waWindow.location.href = `https://wa.me/${waNumber}?text=${message}`;
      closeModal();
      toast("Bukti transfer berhasil dikirim. Admin akan segera memverifikasi.", "success");
      renderCatalog();
    } catch (error) {
      try { waWindow?.close(); } catch (_) {}
      button.disabled = false;
      button.textContent = "Kirim Bukti Transfer";
      toast(friendlyError(error), "error");
    }
  });
}

async function renderPayments() {
  let requestData = {};
  let userData = {};
  let activeStatus = "";
  qs("#pageContent").innerHTML = `<div class="page-head"><div><h2>Verifikasi Pembayaran</h2><p>Periksa bukti transfer. Persetujuan langsung membuka akses kelas peserta.</p></div><div class="page-actions"><span class="badge badge-upcoming" id="pendingPaymentBadge">0 menunggu</span></div></div><div class="pill-row" id="paymentFilters"><button class="pill active" data-payment-status="">Semua</button><button class="pill" data-payment-status="pending">Menunggu</button><button class="pill" data-payment-status="approved">Disetujui</button><button class="pill" data-payment-status="rejected">Ditolak</button></div><section id="paymentList" class="stack" style="margin-top:16px"></section>`;

  const refresh = () => {
    const requests = flattenPaymentRequests(requestData).map((item) => {
      const current = userData?.[item.studentUid] || {};
      return { ...item, studentName: current.name || item.studentName, studentEmail: current.email || item.studentEmail, studentPhone: current.phone ?? item.studentPhone };
    });
    const pending = requests.filter((item) => item.status === "pending").length;
    const badge = qs("#pendingPaymentBadge");
    if (badge) badge.textContent = `${pending} menunggu`;
    const list = qs("#paymentList");
    if (!list) return;
    const filtered = activeStatus ? requests.filter((item) => item.status === activeStatus) : requests;
    list.innerHTML = renderPaymentRows(filtered);
    bindPaymentActions(requests);
  };

  qsa("[data-payment-status]").forEach((button) => button.addEventListener("click", () => {
    qsa("[data-payment-status]").forEach((item) => item.classList.toggle("active", item === button));
    activeStatus = button.dataset.paymentStatus;
    refresh();
  }));

  const unsubRequests = subscribe("paymentRequests", (data) => { requestData = data || {}; refresh(); });
  const unsubUsers = subscribe("users", (data) => { userData = data || {}; refresh(); });
  state.unsubscribers.push(unsubRequests, unsubUsers);
}

function renderPaymentRows(requests) {
  return requests.map((item) => `<article class="payment-request-card"><div class="payment-proof-thumb"><span>▧</span><b>Bukti</b></div><div class="payment-request-copy"><div class="payment-request-title"><div><h3>${escapeHtml(item.studentName || "Peserta")}</h3><p>${escapeHtml(item.classTitle || "Kelas")} · ${formatRupiah(item.price || 0)}</p></div><span class="badge ${item.status === "approved" ? "badge-replay" : item.status === "rejected" ? "badge-live" : "badge-upcoming"}">${item.status === "approved" ? "Disetujui" : item.status === "rejected" ? "Ditolak" : "Menunggu"}</span></div><div class="payment-meta"><span>${escapeHtml(item.studentEmail || "")}</span><span>${escapeHtml(item.studentPhone || "")}</span><span>${formatDateTime(item.submittedAt)}</span></div>${item.note ? `<p class="payment-note">${escapeHtml(item.note)}</p>` : ""}${item.adminNote ? `<p class="payment-admin-note">Catatan admin: ${escapeHtml(item.adminNote)}</p>` : ""}<div class="payment-actions"><button class="btn btn-secondary btn-sm" data-view-proof="${item.studentUid}|${item.classId}">Lihat Bukti</button>${item.studentPhone ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/${normalizeWhatsapp(item.studentPhone)}">WhatsApp Peserta</a>` : ""}${item.status === "pending" ? `<button class="btn btn-danger btn-sm" data-reject-payment="${item.studentUid}|${item.classId}">Tolak</button><button class="btn btn-success btn-sm" data-approve-payment="${item.studentUid}|${item.classId}">Setujui</button>` : ""}</div></div></article>`).join("") || `<div class="card">${emptyState("Belum ada pembayaran", "Bukti transfer peserta akan tampil di sini.")}</div>`;
}

function bindPaymentActions(requests) {
  qsa("[data-view-proof]").forEach((button) => button.addEventListener("click", async () => {
    const [studentUid, classId] = button.dataset.viewProof.split("|");
    const item = requests.find((row) => row.studentUid === studentUid && row.classId === classId);
    if (!item) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Membuka...";
    try {
      const proof = await getPaymentProof(item);
      if (!proof) throw new Error("Bukti transfer tidak ditemukan.");
      const content = `<img class="proof-image" src="${safeUrl(proof)}" alt="Bukti pembayaran">`;
      openModal({ title: "Bukti Pembayaran", subtitle: `${item.studentName} · ${item.classTitle}`, body: content, size: "lg", footer: `<button class="btn btn-primary" data-close-footer>Tutup</button>` }).querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
    } catch (error) {
      toast(friendlyError(error), "error");
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }));
  qsa("[data-approve-payment]").forEach((button) => button.addEventListener("click", async () => {
    const [studentUid, classId] = button.dataset.approvePayment.split("|");
    const item = requests.find((row) => row.studentUid === studentUid && row.classId === classId);
    if (!item || !confirm(`Setujui pembayaran ${item.studentName} untuk kelas ${item.classTitle}?`)) return;
    button.disabled = true;
    try {
      const now = Date.now();
      await updateValues({
        [`paymentRequests/${studentUid}/${classId}/status`]: "approved",
        [`paymentRequests/${studentUid}/${classId}/approvedAt`]: now,
        [`paymentRequests/${studentUid}/${classId}/approvedBy`]: state.user.uid,
        [`paymentRequests/${studentUid}/${classId}/updatedAt`]: now,
        [`userClasses/${studentUid}/${classId}`]: true,
        [`classMembers/${classId}/${studentUid}`]: { role: "student", joinedAt: now, enrollmentType: "paid" },
        [`userNotifications/${studentUid}/payment-${classId}`]: { title: "Pembayaran disetujui", body: `Kelas ${item.classTitle} sudah dapat diakses.`, route: `class/${classId}`, read: false, createdAt: now }
      });
      toast("Pembayaran disetujui dan kelas telah dibuka.", "success");
    } catch (error) { button.disabled = false; toast(friendlyError(error), "error"); }
  }));
  qsa("[data-reject-payment]").forEach((button) => button.addEventListener("click", async () => {
    const [studentUid, classId] = button.dataset.rejectPayment.split("|");
    const item = requests.find((row) => row.studentUid === studentUid && row.classId === classId);
    if (!item) return;
    const reason = prompt("Tuliskan alasan penolakan atau perbaikan yang diperlukan:", "Bukti pembayaran belum dapat diverifikasi.");
    if (reason === null) return;
    await updateValues({
      [`paymentRequests/${studentUid}/${classId}/status`]: "rejected",
      [`paymentRequests/${studentUid}/${classId}/adminNote`]: reason.trim(),
      [`paymentRequests/${studentUid}/${classId}/updatedAt`]: Date.now()
    });
    toast("Permintaan pembayaran ditandai perlu diperbaiki.", "success");
  }));
}

function classCard(course) {
  return `
    <article class="class-card">
      <div class="class-cover ${escapeHtml(course.accent || "blue")}"><div class="class-cover-top"><span class="class-category">${escapeHtml(course.category || "Kelas")}</span><span class="price-badge ${(course.accessType || "free") === "paid" ? "paid" : "free"}">${classAccessLabel(course)}</span></div><h3>${escapeHtml(course.title)}</h3></div>
      <div class="class-body"><p>${escapeHtml(course.description || "Ruang belajar Izzuddin Academy.")}</p><div class="class-meta"><span>${escapeHtml(course.teacherName || "Belum ditentukan")}</span><span>${course.status === "draft" ? "Draf" : "Aktif"}</span></div><div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary btn-sm" style="flex:1" data-open-class="${course.id}">Buka Kelas</button>${isAdminRole() ? `<button class="icon-btn" data-edit-class="${course.id}" title="Edit">${icon("edit")}</button>` : ""}</div></div>
    </article>`;
}

async function renderClasses() {
  state.classes = await getMyClasses(state.user.uid, state.profile.role);
  qs("#pageContent").innerHTML = `
    <div class="page-head">
      <div><h2>Kelas Saya</h2><p>Kelas yang telah Anda ikuti beserta video, materi, tugas, dan progres belajar.</p></div>
      <div class="page-actions">
        ${isAdminRole() ? `<button class="btn btn-primary" id="createClass">${icon("plus")} Buat Kelas</button>` : isStudentRole() ? `<button class="btn btn-primary" data-route-action="catalog">${icon("search")} Jelajahi Kelas</button>` : ""}
      </div>
    </div>
    <div class="filter-row">
      <input class="form-control" id="classSearch" placeholder="Cari nama kelas...">
      <select class="form-control" id="classStatusFilter"><option value="">Semua status</option><option value="active">Aktif</option><option value="draft">Draf</option></select>
    </div>
    <section id="classGrid" class="class-grid">
      ${state.classes.map(classCard).join("") || emptyState("Belum ada kelas", isAdminRole() ? "Buat kelas pertama untuk memulai pembelajaran." : "Kelas yang sudah Anda ikuti akan tampil di sini.", isAdminRole() ? `<button class="btn btn-primary" id="emptyCreateClass">Buat Kelas Pertama</button>` : "")}
    </section>`;

  const filterClasses = () => {
    const term = qs("#classSearch").value.trim().toLowerCase();
    const status = qs("#classStatusFilter").value;
    const filtered = state.classes.filter((course) => (!term || `${course.title} ${course.category || ""} ${course.teacherName || ""}`.toLowerCase().includes(term)) && (!status || (course.status || "active") === status));
    qs("#classGrid").innerHTML = filtered.map(classCard).join("") || emptyState("Kelas tidak ditemukan", "Ubah kata kunci atau filter yang digunakan.");
    bindClassActions();
  };
  qs("#classSearch")?.addEventListener("input", filterClasses);
  qs("#classStatusFilter")?.addEventListener("change", filterClasses);
  qs("#createClass")?.addEventListener("click", () => openClassForm());
  qs("#emptyCreateClass")?.addEventListener("click", () => openClassForm());
  bindClassActions();
}

function bindClassActions() {
  bindCommonPageActions();
  qsa("[data-edit-class]").forEach((el) => el.addEventListener("click", async () => {
    const course = state.classes.find((item) => item.id === el.dataset.editClass);
    if (course) openClassForm(course);
  }));
}

async function openClassForm(course = null) {
  const teachers = (await getAllUsers()).filter((user) => normalizeRole(user.role) === "teacher" && user.status !== "inactive");
  const body = `<form id="classForm" class="form-grid">
    <div class="form-group full"><label class="form-label">Nama kelas <span class="required">*</span></label><input id="classTitle" class="form-control" required value="${escapeHtml(course?.title || "")}" placeholder="Contoh: Aqidah Tasawuf Dasar"></div>
    <div class="form-group"><label class="form-label">Kategori</label><input id="classCategory" class="form-control" value="${escapeHtml(course?.category || "")}" placeholder="Aqidah, Tahfiz, Manajemen..."></div>
    <div class="form-group"><label class="form-label">Pengajar utama</label><select id="classTeacher" class="form-control"><option value="">Pilih pengajar</option>${teachers.map((t) => `<option value="${t.uid}" ${course?.teacherUid === t.uid ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">Jenis akses</label><select id="classAccessType" class="form-control"><option value="free" ${(course?.accessType || "free") === "free" ? "selected" : ""}>Gratis</option><option value="paid" ${course?.accessType === "paid" ? "selected" : ""}>Berbayar</option></select></div>
    <div class="form-group" id="classPriceGroup"><label class="form-label">Harga kelas</label><input id="classPrice" class="form-control" type="number" min="0" step="1000" value="${Number(course?.price || 0)}" placeholder="Contoh: 150000"><div class="form-help">Isi tanpa titik atau koma.</div></div>
    <div class="form-group"><label class="form-label">Warna kelas</label><select id="classAccent" class="form-control">${["blue","teal","green","purple","orange"].map((color) => `<option value="${color}" ${(course?.accent || "blue") === color ? "selected" : ""}>${color[0].toUpperCase()+color.slice(1)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">Status</label><select id="classStatus" class="form-control"><option value="active" ${(course?.status || "active") === "active" ? "selected" : ""}>Aktif</option><option value="draft" ${course?.status === "draft" ? "selected" : ""}>Draf</option></select></div>
    <div class="form-group full"><label class="form-label">Deskripsi kelas</label><textarea id="classDescription" class="form-control" placeholder="Gambaran singkat tentang kelas dan hasil belajar yang diharapkan.">${escapeHtml(course?.description || "")}</textarea></div>
  </form>`;
  const modal = openModal({ title: course ? "Edit Kelas" : "Buat Kelas Baru", subtitle: "Tentukan identitas, akses gratis/berbayar, dan pengajar kelas.", body, footer: `${course ? '<button class="btn btn-danger" id="deleteClass">Hapus Kelas</button>' : ''}<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="saveClass">Simpan Kelas</button>` });
  const togglePrice = () => modal.querySelector("#classPriceGroup")?.classList.toggle("hidden", modal.querySelector("#classAccessType").value !== "paid");
  modal.querySelector("#classAccessType")?.addEventListener("change", togglePrice); togglePrice();
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#deleteClass")?.addEventListener("click", async () => {
    if (!course || !confirm(`Hapus kelas “${course.title}” beserta seluruh data belajarnya?`)) return;
    const users = await getAllUsers();
    const updates = { [`classes/${course.id}`]: null, [`modules/${course.id}`]: null, [`meetings/${course.id}`]: null, [`assignments/${course.id}`]: null, [`submissions/${course.id}`]: null, [`classMembers/${course.id}`]: null, [`attendance/${course.id}`]: null, [`watchProgress/${course.id}`]: null, [`notes/${course.id}`]: null, [`discussions/${course.id}`]: null, [`quizzes/${course.id}`]: null, [`quizResults/${course.id}`]: null };
    if (course.teacherUid) updates[`teacherClasses/${course.teacherUid}/${course.id}`] = null;
    users.forEach((item) => { updates[`userClasses/${item.uid}/${course.id}`] = null; updates[`paymentRequests/${item.uid}/${course.id}`] = null; updates[`paymentProofs/${item.uid}/${course.id}`] = null; });
    await updateValues(updates); closeModal(); toast("Kelas berhasil dihapus.", "success"); renderClasses();
  });
  modal.querySelector("#saveClass")?.addEventListener("click", async () => {
    const title = modal.querySelector("#classTitle").value.trim(); if (!title) return toast("Nama kelas wajib diisi.", "warning");
    const teacherUid = modal.querySelector("#classTeacher").value; const teacher = teachers.find((item) => item.uid === teacherUid);
    const accessType = modal.querySelector("#classAccessType").value;
    const price = accessType === "paid" ? Number(modal.querySelector("#classPrice").value || 0) : 0;
    if (accessType === "paid" && price <= 0) return toast("Harga kelas berbayar harus lebih dari nol.", "warning");
    const classId = course?.id || uid("kelas"); const now = Date.now();
    const payload = { title, category: modal.querySelector("#classCategory").value.trim(), description: modal.querySelector("#classDescription").value.trim(), teacherUid, teacherName: teacher?.name || "", accessType, price, accent: modal.querySelector("#classAccent").value, status: modal.querySelector("#classStatus").value, createdAt: course?.createdAt || now, createdBy: course?.createdBy || state.user.uid, updatedAt: now };
    const updates = { [`classes/${classId}`]: payload };
    if (course?.teacherUid && course.teacherUid !== teacherUid) updates[`teacherClasses/${course.teacherUid}/${classId}`] = null;
    if (teacherUid) updates[`teacherClasses/${teacherUid}/${classId}`] = true;
    await updateValues(updates); closeModal(); toast("Kelas berhasil disimpan.", "success"); renderClasses();
  });
}

async function renderSchedule() {
  const bundles = await loadClassBundle();
  const meetings = bundles.flatMap(({ course, meetings }) => meetings.map((m) => ({ ...m, classId: course.id, classTitle: course.title })))
    .sort((a,b) => new Date(b.startAt || 0) - new Date(a.startAt || 0));
  qs("#pageContent").innerHTML = `
    <div class="page-head"><div><h2>Video Pembelajaran</h2><p>Seluruh video dari kelas yang Anda ikuti tersusun dalam satu halaman.</p></div></div>
    <div class="pill-row" id="scheduleFilters"><button class="pill active" data-status="">Semua</button><button class="pill" data-status="available">Tersedia</button><button class="pill" data-status="upcoming">Terjadwal</button></div>
    <div id="scheduleList" class="stack" style="margin-top:16px">${renderMeetingList(meetings)}</div>`;
  qsa("#scheduleFilters [data-status]").forEach((button) => button.addEventListener("click", () => {
    qsa("#scheduleFilters .pill").forEach((el) => el.classList.remove("active")); button.classList.add("active");
    const status = button.dataset.status;
    qs("#scheduleList").innerHTML = renderMeetingList(status ? meetings.filter((m) => videoAvailability(m).key === status) : meetings);
    bindCommonPageActions();
  }));
  bindCommonPageActions();
}

function renderMeetingList(meetings) {
  if (!meetings.length) return `<div class="card">${emptyState("Belum ada video", "Video pembelajaran akan tampil di sini.")}</div>`;
  return meetings.map((meeting) => {
    const date = meeting.startAt ? new Date(meeting.startAt) : null;
    const availability = videoAvailability(meeting);
    const source = getVideoSource(meeting);
    return `<article class="meeting-card"><div class="meeting-date"><b>${date ? String(date.getDate()).padStart(2,"0") : "▶"}</b><span>${date ? formatDate(meeting.startAt,{month:"short",year:undefined}) : "Video"}</span></div><div class="meeting-copy"><h4>${escapeHtml(meeting.title)}</h4><p>${escapeHtml(meeting.description || "Video pembelajaran Izzuddin Academy.")}</p><div class="meeting-meta"><span>${escapeHtml(meeting.classTitle || "")}</span><span>${meeting.startAt ? formatDateTime(meeting.startAt) : "Dapat diputar kapan saja"}</span><span>${source.provider === "drive" ? "Google Drive" : source.provider === "youtube" ? "YouTube" : "Video belum dipasang"}</span></div></div><div class="list-actions"><span class="badge badge-${availability.key}">${availability.label}</span><button class="btn btn-primary btn-sm" data-open-meeting="${meeting.classId}|${meeting.id}">Buka Video</button></div></article>`;
  }).join("");
}

async function renderAssignments() {
  const bundles = await loadClassBundle();
  const tasks = bundles.flatMap(({ course, assignments }) => assignments.map((a) => ({ ...a, classId: course.id, classTitle: course.title })))
    .sort((a,b) => new Date(a.dueAt || 8640000000000000) - new Date(b.dueAt || 8640000000000000));
  let submissions = {};
  if (isStudentRole()) {
    for (const task of tasks) {
      submissions[task.id] = await getValue(`submissions/${task.classId}/${task.id}/${state.user.uid}`);
    }
  }
  qs("#pageContent").innerHTML = `
    <div class="page-head"><div><h2>Tugas</h2><p>Kelola seluruh penugasan, tenggat, kiriman peserta, nilai, dan umpan balik.</p></div></div>
    <section class="card">
      <div class="card-body">
        <div class="stack">
          ${tasks.map((task) => {
            const submission = submissions[task.id];
            const overdue = task.dueAt && new Date(task.dueAt).getTime() < Date.now() && !submission;
            return `<div class="list-item">
              <div class="list-icon">${icon("tasks")}</div>
              <div class="list-copy"><b>${escapeHtml(task.title)}</b><span>${escapeHtml(task.classTitle)} · Tenggat ${task.dueAt ? formatDateTime(task.dueAt) : "tidak dibatasi"} · ${task.points || 100} poin</span></div>
              <div class="list-actions">
                ${isStudentRole() ? `<span class="badge ${submission ? "badge-replay" : overdue ? "badge-live" : "badge-upcoming"}">${submission ? (submission.score != null ? `Nilai ${submission.score}` : "Sudah dikirim") : overdue ? "Terlambat" : "Belum dikerjakan"}</span><button class="btn btn-primary btn-sm" data-submit-task="${task.classId}|${task.id}">${submission ? "Lihat" : "Kerjakan"}</button>` : `<button class="btn btn-secondary btn-sm" data-review-task="${task.classId}|${task.id}">Lihat Kiriman</button>`}
              </div>
            </div>`;
          }).join("") || emptyState("Belum ada tugas", "Tugas yang dibuat di kelas akan tampil di halaman ini.")}
        </div>
      </div>
    </section>`;
  qsa("[data-submit-task]").forEach((el) => el.addEventListener("click", () => {
    const [classId, taskId] = el.dataset.submitTask.split("|");
    openSubmissionForm(classId, taskId, tasks.find((t) => t.id === taskId));
  }));
  qsa("[data-review-task]").forEach((el) => el.addEventListener("click", () => {
    const [classId, taskId] = el.dataset.reviewTask.split("|");
    openSubmissionsReview(classId, taskId, tasks.find((t) => t.id === taskId));
  }));
}

async function openSubmissionForm(classId, taskId, task) {
  const existing = await getValue(`submissions/${classId}/${taskId}/${state.user.uid}`);
  const body = `<div class="notice notice-info" style="margin-bottom:16px"><b>${escapeHtml(task.title)}</b><br>${escapeHtml(task.description || "Tuliskan jawaban atau lampirkan tautan hasil pekerjaan.")}</div>
    <form id="submissionForm" class="form-grid">
      <div class="form-group full"><label class="form-label">Jawaban</label><textarea id="submissionText" class="form-control" placeholder="Tuliskan jawaban atau penjelasan hasil pekerjaan...">${escapeHtml(existing?.text || "")}</textarea></div>
      <div class="form-group full"><label class="form-label">Tautan lampiran</label><input id="submissionLink" class="form-control" type="url" value="${escapeHtml(existing?.link || "")}" placeholder="https://drive.google.com/..."><div class="form-help">Gunakan Google Drive, Docs, YouTube, atau tautan lain yang dapat dibuka pengajar.</div></div>
      ${existing?.score != null ? `<div class="form-group full"><div class="notice notice-success">Nilai: <b>${existing.score}</b>${existing.feedback ? `<br>Umpan balik: ${escapeHtml(existing.feedback)}` : ""}</div></div>` : ""}
    </form>`;
  const modal = openModal({ title: existing ? "Kiriman Tugas" : "Kerjakan Tugas", subtitle: task.classTitle || "", body, footer: `<button class="btn btn-ghost" data-close-footer>Tutup</button><button class="btn btn-primary" id="saveSubmission">${existing ? "Perbarui Kiriman" : "Kirim Tugas"}</button>` });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#saveSubmission")?.addEventListener("click", async () => {
    const text = modal.querySelector("#submissionText").value.trim();
    const link = modal.querySelector("#submissionLink").value.trim();
    if (!text && !link) { toast("Isi jawaban atau tautan lampiran.", "warning"); return; }
    try {
      await setValue(`submissions/${classId}/${taskId}/${state.user.uid}`, {
        text,
        link,
        status: existing?.score != null ? "graded" : existing ? "updated" : "submitted",
        submittedAt: existing?.submittedAt || Date.now(),
        updatedAt: Date.now(),
        studentName: state.profile.name,
        score: existing?.score ?? null,
        feedback: existing?.feedback || "",
        gradedAt: existing?.gradedAt ?? null,
        gradedBy: existing?.gradedBy ?? null
      });
      closeModal(); toast("Tugas berhasil dikirim.", "success"); renderAssignments();
    } catch (error) { toast(friendlyError(error), "error"); }
  });
}

async function openSubmissionsReview(classId, taskId, task) {
  const submissions = objectToArray(await getValue(`submissions/${classId}/${taskId}`, {}));
  const body = `<div class="table-wrap"><table><thead><tr><th>Peserta</th><th>Waktu</th><th>Jawaban</th><th>Nilai</th><th>Aksi</th></tr></thead><tbody>${submissions.map((s) => `<tr><td>${escapeHtml(s.studentName || s.id)}</td><td>${formatDateTime(s.submittedAt)}</td><td>${escapeHtml((s.text || "").slice(0,70))}${s.link ? ` <a href="${safeUrl(s.link)}" target="_blank" rel="noopener">Buka tautan</a>` : ""}</td><td>${s.score ?? "-"}</td><td><button class="btn btn-primary btn-sm" data-grade="${s.id}">Nilai</button></td></tr>`).join("") || `<tr><td colspan="5" class="text-center muted">Belum ada kiriman.</td></tr>`}</tbody></table></div>`;
  const modal = openModal({ title: `Kiriman: ${task.title}`, subtitle: `${submissions.length} peserta telah mengirim`, body, size: "lg", footer: `<button class="btn btn-ghost" data-close-footer>Tutup</button>` });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelectorAll("[data-grade]").forEach((el) => el.addEventListener("click", () => openGradeForm(classId, taskId, el.dataset.grade, submissions.find((s) => s.id === el.dataset.grade), task)));
}

function openGradeForm(classId, taskId, studentUid, submission, task) {
  const body = `<div class="stack"><div class="notice notice-info">${escapeHtml(submission.text || "Tidak ada jawaban tertulis.")}${submission.link ? `<br><a href="${safeUrl(submission.link)}" target="_blank" rel="noopener">Buka lampiran</a>` : ""}</div><div class="form-group"><label class="form-label">Nilai (maks. ${task.points || 100})</label><input id="gradeScore" class="form-control" type="number" min="0" max="${task.points || 100}" value="${submission.score ?? ""}"></div><div class="form-group"><label class="form-label">Umpan balik</label><textarea id="gradeFeedback" class="form-control">${escapeHtml(submission.feedback || "")}</textarea></div></div>`;
  const modal = openModal({ title: `Nilai ${submission.studentName || "Peserta"}`, body, size: "sm", footer: `<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="saveGrade">Simpan Nilai</button>` });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#saveGrade")?.addEventListener("click", async () => {
    const score = Number(modal.querySelector("#gradeScore").value);
    if (Number.isNaN(score) || score < 0 || score > Number(task.points || 100)) { toast("Nilai tidak valid.", "warning"); return; }
    await updateValue(`submissions/${classId}/${taskId}/${studentUid}`, { score, feedback: modal.querySelector("#gradeFeedback").value.trim(), status: "graded", gradedAt: Date.now(), gradedBy: state.user.uid });
    closeModal(); toast("Nilai berhasil disimpan.", "success");
  });
}

async function renderUsers() {
  let users = [];
  qs("#pageContent").innerHTML = `
    <div class="page-head">
      <div><h2>Pengguna</h2><p>Data profil peserta diperbarui realtime saat mereka menyimpan perubahan akun.</p></div>
      <div class="page-actions"><button class="btn btn-primary" id="createUser">${icon("plus")} Buat Akun</button></div>
    </div>
    <div class="filter-row"><input class="form-control" id="userSearch" placeholder="Cari nama, email, atau WhatsApp..."><select class="form-control" id="userRole"><option value="">Semua peran</option><option value="admin">Administrator</option><option value="teacher">Pengajar</option><option value="student">Peserta</option></select></div>
    <div class="table-wrap"><table><thead><tr><th>Pengguna</th><th>WhatsApp</th><th>Peran</th><th>Status</th><th>Diperbarui</th><th>Aksi</th></tr></thead><tbody id="userTableBody"><tr><td colspan="6" class="text-center muted">Memuat pengguna...</td></tr></tbody></table></div>`;

  const apply = () => {
    const search = qs("#userSearch");
    const roleSelect = qs("#userRole");
    const body = qs("#userTableBody");
    if (!search || !roleSelect || !body) return;
    const term = search.value.trim().toLowerCase();
    const role = roleSelect.value;
    const filtered = users.filter((u) => (!term || `${u.name || ""} ${u.email || ""} ${u.phone || ""}`.toLowerCase().includes(term)) && (!role || u.role === role));
    body.innerHTML = renderUserRows(filtered);
    bindUserRowActions(filtered);
  };
  qs("#userSearch")?.addEventListener("input", apply);
  qs("#userRole")?.addEventListener("change", apply);
  qs("#createUser")?.addEventListener("click", () => openUserForm());
  const unsubscribe = subscribe("users", (data) => {
    users = objectToArray(data || {}).map((item) => ({ ...item, role: normalizeRole(item.role), uid: item.id })).sort((a,b) => String(a.name || "").localeCompare(String(b.name || ""), "id"));
    apply();
  });
  state.unsubscribers.push(unsubscribe);
}

function renderUserRows(users) {
  return users.map((user) => `<tr>
    <td><div class="table-user"><div class="avatar">${initials(user.name)}</div><div><b>${escapeHtml(user.name)}</b><span>${escapeHtml(user.email || "")}</span></div></div></td>
    <td>${user.phone ? `<a class="table-phone" href="https://wa.me/${normalizeWhatsapp(user.phone)}" target="_blank" rel="noopener">${escapeHtml(user.phone)}</a>` : `<span class="muted">—</span>`}</td>
    <td><span class="badge badge-${user.role}">${escapeHtml(roleLabel(user.role))}</span></td>
    <td><span class="badge ${user.status === "inactive" ? "badge-live" : "badge-replay"}">${user.status === "inactive" ? "Nonaktif" : "Aktif"}</span></td>
    <td>${formatShortDate(user.updatedAt || user.createdAt)}</td>
    <td><div class="table-actions"><button class="btn btn-secondary btn-sm" data-user-access="${user.uid}">Akses Kelas</button><button class="icon-btn" data-edit-user="${user.uid}">${icon("edit")}</button></div></td>
  </tr>`).join("") || `<tr><td colspan="6" class="text-center muted">Tidak ada pengguna.</td></tr>`;
}

function bindUserRowActions(users) {
  qsa("[data-edit-user]").forEach((el) => el.addEventListener("click", () => openUserForm(users.find((u) => u.uid === el.dataset.editUser))));
  qsa("[data-user-access]").forEach((el) => el.addEventListener("click", () => openUserClassAccess(users.find((u) => u.uid === el.dataset.userAccess))));
}

async function createAuthUser(email, password) {
  const secondary = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondary);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return credential.user;
  } finally {
    try { await signOut(secondaryAuth); } catch (_) {}
    await deleteApp(secondary);
  }
}

function openUserForm(user = null) {
  const body = `<form id="userForm" class="form-grid">
    <div class="form-group full"><label class="form-label">Nama lengkap <span class="required">*</span></label><input id="userName" class="form-control" required value="${escapeHtml(user?.name || "")}"></div>
    <div class="form-group"><label class="form-label">Email <span class="required">*</span></label><input id="userEmail" class="form-control" type="email" required value="${escapeHtml(user?.email || "")}" ${user ? "disabled" : ""}></div>
    <div class="form-group"><label class="form-label">Nomor WhatsApp</label><input id="userPhone" class="form-control" type="tel" value="${escapeHtml(user?.phone || "")}" placeholder="08xxxxxxxxxx"></div>
    <div class="form-group"><label class="form-label">Peran</label><select id="userRoleSelect" class="form-control"><option value="student" ${user?.role === "student" ? "selected" : ""}>Peserta</option><option value="teacher" ${user?.role === "teacher" ? "selected" : ""}>Pengajar</option><option value="admin" ${user?.role === "admin" ? "selected" : ""}>Administrator</option></select></div>
    ${user ? "" : `<div class="form-group"><label class="form-label">Kata sandi awal <span class="required">*</span></label><input id="userPassword" class="form-control" type="password" minlength="8" required placeholder="Minimal 8 karakter"></div>`}
    <div class="form-group"><label class="form-label">Status</label><select id="userStatus" class="form-control"><option value="active" ${(user?.status || "active") === "active" ? "selected" : ""}>Aktif</option><option value="inactive" ${user?.status === "inactive" ? "selected" : ""}>Nonaktif</option></select></div>
  </form>`;
  const modal = openModal({ title: user ? "Edit Pengguna" : "Buat Akun Baru", subtitle: user ? "Perbarui profil dan hak akses pengguna." : "Akun Firebase Authentication akan dibuat otomatis.", body, footer: `<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="saveUser">Simpan</button>` });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#saveUser")?.addEventListener("click", async () => {
    const name = modal.querySelector("#userName").value.trim();
    const email = modal.querySelector("#userEmail").value.trim().toLowerCase();
    const phone = modal.querySelector("#userPhone").value.trim();
    const role = modal.querySelector("#userRoleSelect").value;
    const status = modal.querySelector("#userStatus").value;
    if (!name || !email) { toast("Nama dan email wajib diisi.", "warning"); return; }
    const button = modal.querySelector("#saveUser");
    button.disabled = true; button.textContent = "Menyimpan...";
    try {
      let userUid = user?.uid;
      if (!user) {
        const password = modal.querySelector("#userPassword").value;
        if (password.length < 8) throw new Error("Kata sandi minimal 8 karakter.");
        userUid = (await createAuthUser(email, password)).uid;
      }
      const now = Date.now();
      const updates = {
        [`users/${userUid}/name`]: name,
        [`users/${userUid}/email`]: email,
        [`users/${userUid}/phone`]: phone,
        [`users/${userUid}/role`]: role,
        [`users/${userUid}/status`]: status,
        [`users/${userUid}/updatedAt`]: now,
        [`publicProfiles/${userUid}/name`]: name,
        [`publicProfiles/${userUid}/role`]: role,
        [`publicProfiles/${userUid}/avatar`]: user?.avatar || "",
        [`publicProfiles/${userUid}/updatedAt`]: now
      };
      if (!user) {
        updates[`users/${userUid}/createdAt`] = now;
        updates[`users/${userUid}/createdBy`] = state.user.uid;
        updates[`users/${userUid}/registrationSource`] = "admin";
      }
      await updateValues(updates);
      closeModal(); toast("Akun berhasil disimpan.", "success");
    } catch (error) {
      toast(friendlyError(error), "error");
      button.disabled = false; button.textContent = "Simpan";
    }
  });
}

async function openUserClassAccess(user) {
  if (!user) return;
  const classes = await getMyClasses(state.user.uid, "admin");
  const path = user.role === "teacher" ? `teacherClasses/${user.uid}` : `userClasses/${user.uid}`;
  const current = await getValue(path, {});
  const currentMembers = {};
  if (user.role === "student") {
    await Promise.all(classes.map(async (course) => {
      const member = await getValue(`classMembers/${course.id}/${user.uid}`);
      if (member) currentMembers[course.id] = { [user.uid]: member };
    }));
  }
  const body = `<div class="notice notice-info" style="margin-bottom:14px">Atur kelas yang dapat diakses oleh <b>${escapeHtml(user.name)}</b>.</div><div class="stack">${classes.map((course) => `<label class="list-item"><input type="checkbox" data-class-check="${course.id}" ${current?.[course.id] ? "checked" : ""}><div class="list-copy"><b>${escapeHtml(course.title)}</b><span>${escapeHtml(course.category || "Kelas")}</span></div></label>`).join("") || emptyState("Belum ada kelas", "Buat kelas terlebih dahulu.")}</div>`;
  const modal = openModal({ title: "Akses Kelas", subtitle: roleLabel(user.role), body, footer: `<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="saveUserClasses">Simpan Akses</button>` });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#saveUserClasses")?.addEventListener("click", async () => {
    const updates = {};
    classes.forEach((course) => {
      const checked = modal.querySelector(`[data-class-check="${course.id}"]`)?.checked;
      if (user.role === "teacher") {
        updates[`teacherClasses/${user.uid}/${course.id}`] = checked ? true : null;
        if (checked) {
          if (course.teacherUid && course.teacherUid !== user.uid) {
            updates[`teacherClasses/${course.teacherUid}/${course.id}`] = null;
          }
          updates[`classes/${course.id}/teacherUid`] = user.uid;
          updates[`classes/${course.id}/teacherName`] = user.name;
        } else if (course.teacherUid === user.uid) {
          updates[`classes/${course.id}/teacherUid`] = "";
          updates[`classes/${course.id}/teacherName`] = "";
        }
      } else {
        updates[`userClasses/${user.uid}/${course.id}`] = checked ? true : null;
        updates[`classMembers/${course.id}/${user.uid}`] = checked ? { role: "student", joinedAt: currentMembers?.[course.id]?.[user.uid]?.joinedAt || Date.now() } : null;
      }
    });
    try { await updateValues(updates); closeModal(); toast("Akses kelas berhasil diperbarui.", "success"); } catch (error) { toast(friendlyError(error), "error"); }
  });
}

function canManageClass(course) {
  return isAdminRole() || (normalizeRole(state.profile.role) === "teacher" && course.teacherUid === state.user.uid);
}

async function renderClassDetail(classId) {
  const courseData = await getClass(classId);
  if (!courseData) throw new Error("Kelas tidak ditemukan atau Anda tidak memiliki akses.");
  const course = { id: classId, ...courseData };
  if (isStudentRole() && !(await getValue(`userClasses/${state.user.uid}/${classId}`, false))) { toast("Daftar atau selesaikan pembayaran untuk membuka kelas ini.", "warning"); navigate("catalog"); return; }
  state.activeClass = course;
  const [modules, meetings, assignments] = await Promise.all([getModules(classId), getMeetings(classId), getAssignments(classId)]);
  let members = [];
  if (canManageClass(course)) {
    try { members = await getClassMembers(classId); } catch (_) { members = []; }
  }
  const manageable = canManageClass(course);

  const moduleBlocks = modules.map((module, index) => {
    const moduleMeetings = meetings.filter((m) => m.moduleId === module.id);
    return `<section class="module-card">
      <div class="module-head"><div class="module-number">${String(index + 1).padStart(2,"0")}</div><div style="flex:1"><b>${escapeHtml(module.title)}</b><span>${escapeHtml(module.description || "Bagian pembelajaran")}</span></div>${manageable ? `<button class="icon-btn" data-edit-module="${module.id}">${icon("edit")}</button>` : ""}</div>
      <div class="module-items">${moduleMeetings.map((meeting) => `<div class="lesson-row"><div class="lesson-icon">${icon("video")}</div><div class="lesson-copy"><b>${escapeHtml(meeting.title)}</b><span>${meeting.startAt ? formatDateTime(meeting.startAt) : "Dapat diputar kapan saja"} · ${videoAvailability(meeting).label}</span></div><button class="btn btn-primary btn-sm" data-open-meeting="${classId}|${meeting.id}">Buka</button>${manageable ? `<button class="icon-btn" data-edit-meeting="${meeting.id}">${icon("edit")}</button>` : ""}</div>`).join("") || `<div class="lesson-row"><div class="lesson-copy"><span>Belum ada pertemuan pada modul ini.</span></div></div>`}</div>
    </section>`;
  }).join("");
  const ungrouped = meetings.filter((m) => !m.moduleId || !modules.some((mod) => mod.id === m.moduleId));

  qs("#pageContent").innerHTML = `
    <div class="page-actions" style="margin-bottom:14px"><button class="btn btn-ghost btn-sm" id="backToClasses">${icon("back")} Kembali</button></div>
    <section class="class-hero ${escapeHtml(course.accent || "blue")}">
      <div class="class-hero-content"><span class="eyebrow" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14)">${escapeHtml(course.category || "Kelas")}</span><h2>${escapeHtml(course.title)}</h2><p>${escapeHtml(course.description || "Ruang pembelajaran IZZUDDIN ACADEMY.")}</p><div class="class-hero-meta"><span>Pengajar: ${escapeHtml(course.teacherName || "Belum ditentukan")}</span><span>${modules.length} modul</span><span>${meetings.length} video</span><span>${members.length || 0} peserta</span></div></div>
    </section>

    <div class="page-head" style="margin-top:24px;margin-bottom:15px">
      <div><h2 style="font-size:1.35rem">Isi Kelas</h2><p>Modul, video, materi, dan tugas tersusun dalam satu alur belajar.</p></div>
      ${manageable ? `<div class="page-actions"><button class="btn btn-secondary" id="addModule">${icon("plus")} Modul</button><button class="btn btn-primary" id="addMeeting">${icon("plus")} Video</button><button class="btn btn-secondary" id="addAssignment">${icon("plus")} Tugas</button>${isAdminRole() ? `<button class="btn btn-ghost" id="manageMembers">${icon("users")} Peserta</button>` : ""}</div>` : ""}
    </div>

    <div class="grid grid-sidebar">
      <div class="stack">
        ${moduleBlocks || `<div class="card">${emptyState("Belum ada modul", manageable ? "Tambahkan modul agar materi tersusun lebih rapi." : "Materi kelas akan segera ditambahkan.")}</div>`}
        ${ungrouped.length ? `<section class="module-card"><div class="module-head"><div class="module-number">•</div><div><b>Video Lainnya</b><span>Video yang belum dikelompokkan.</span></div></div><div class="module-items">${ungrouped.map((meeting) => `<div class="lesson-row"><div class="lesson-icon">${icon("video")}</div><div class="lesson-copy"><b>${escapeHtml(meeting.title)}</b><span>${meeting.startAt ? formatDateTime(meeting.startAt) : "Dapat diputar kapan saja"} · ${videoAvailability(meeting).label}</span></div><button class="btn btn-primary btn-sm" data-open-meeting="${classId}|${meeting.id}">Buka</button>${manageable ? `<button class="icon-btn" data-edit-meeting="${meeting.id}">${icon("edit")}</button>` : ""}</div>`).join("")}</div></section>` : ""}
      </div>
      <aside class="stack">
        <section class="card"><div class="card-head"><div><h3>Tugas Kelas</h3><p>${assignments.length} penugasan</p></div></div><div class="card-body"><div class="list">${assignments.map((task) => `<div class="list-item"><div class="list-icon">${icon("tasks")}</div><div class="list-copy"><b>${escapeHtml(task.title)}</b><span>Tenggat ${task.dueAt ? formatDateTime(task.dueAt) : "bebas"} · ${task.points || 100} poin</span></div>${manageable ? `<button class="icon-btn" data-edit-assignment="${task.id}">${icon("edit")}</button>` : ""}</div>`).join("") || emptyState("Belum ada tugas", "Tugas kelas akan tampil di sini.")}</div></div></section>
        <section class="card"><div class="card-head"><div><h3>Informasi Kelas</h3><p>Ringkasan akses dan status.</p></div></div><div class="card-body stack"><div class="notice notice-info"><b>Status:</b> ${course.status === "draft" ? "Draf" : "Aktif"}<br><b>Akses:</b> ${classAccessLabel(course)}<br><b>Pengajar:</b> ${escapeHtml(course.teacherName || "Belum ditentukan")}</div>${isStudentRole() ? `<button class="btn btn-secondary" id="viewMyProgress">${icon("chart")} Lihat Progres Saya</button>` : manageable ? `<button class="btn btn-secondary" id="viewClassReport">${icon("report")} Buka Laporan Kelas</button>` : ""}</div></section>
      </aside>
    </div>`;

  qs("#backToClasses")?.addEventListener("click", () => navigate("classes"));
  qs("#addModule")?.addEventListener("click", () => openModuleForm(classId, modules));
  qs("#addMeeting")?.addEventListener("click", () => openMeetingForm(classId, modules));
  qs("#addAssignment")?.addEventListener("click", () => openAssignmentForm(classId));
  qs("#manageMembers")?.addEventListener("click", () => openClassMembers(classId, course));
  qs("#viewClassReport")?.addEventListener("click", () => navigate("reports"));
  qs("#viewMyProgress")?.addEventListener("click", () => navigate("reports"));
  qsa("[data-edit-module]").forEach((el) => el.addEventListener("click", () => openModuleForm(classId, modules, modules.find((m) => m.id === el.dataset.editModule))));
  qsa("[data-edit-meeting]").forEach((el) => el.addEventListener("click", () => openMeetingForm(classId, modules, meetings.find((m) => m.id === el.dataset.editMeeting))));
  qsa("[data-edit-assignment]").forEach((el) => el.addEventListener("click", () => openAssignmentForm(classId, assignments.find((a) => a.id === el.dataset.editAssignment))));
  bindCommonPageActions();
}

function openModuleForm(classId, modules, module = null) {
  const body = `<form class="form-grid"><div class="form-group full"><label class="form-label">Judul modul <span class="required">*</span></label><input id="moduleTitle" class="form-control" value="${escapeHtml(module?.title || "")}" required placeholder="Contoh: Memahami Penyakit Hati"></div><div class="form-group"><label class="form-label">Urutan</label><input id="moduleOrder" class="form-control" type="number" min="1" value="${module?.order || modules.length + 1}"></div><div class="form-group"><label class="form-label">Status</label><select id="modulePublished" class="form-control"><option value="true" ${module?.published !== false ? "selected" : ""}>Terbit</option><option value="false" ${module?.published === false ? "selected" : ""}>Draf</option></select></div><div class="form-group full"><label class="form-label">Deskripsi</label><textarea id="moduleDescription" class="form-control">${escapeHtml(module?.description || "")}</textarea></div></form>`;
  const footer = `${module ? `<button class="btn btn-danger" id="deleteModule">Hapus</button>` : ""}<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="saveModule">Simpan Modul</button>`;
  const modal = openModal({ title: module ? "Edit Modul" : "Tambah Modul", body, footer });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#saveModule")?.addEventListener("click", async () => {
    const title = modal.querySelector("#moduleTitle").value.trim(); if (!title) return toast("Judul modul wajib diisi.", "warning");
    const id = module?.id || uid("modul");
    await setValue(`modules/${classId}/${id}`, { title, description: modal.querySelector("#moduleDescription").value.trim(), order: Number(modal.querySelector("#moduleOrder").value || 1), published: modal.querySelector("#modulePublished").value === "true", createdAt: module?.createdAt || Date.now(), updatedAt: Date.now(), createdBy: module?.createdBy || state.user.uid });
    closeModal(); toast("Modul berhasil disimpan.", "success"); renderClassDetail(classId);
  });
  modal.querySelector("#deleteModule")?.addEventListener("click", async () => { if (confirm("Hapus modul ini? Pertemuan di dalamnya tidak ikut terhapus.")) { await removeValue(`modules/${classId}/${module.id}`); closeModal(); renderClassDetail(classId); } });
}

function detectMaterialProvider(url = "", preferred = "") {
  if (preferred === "youtube" || preferred === "drive") return preferred;
  if (youtubeId(url)) return "youtube";
  if (googleDriveId(url)) return "drive";
  return "link";
}

function materialsToText(materials) {
  if (!materials) return "";
  const list = Array.isArray(materials) ? materials : objectToArray(materials || {});
  return list.map((m) => `${m.title || "Materi"}|${detectMaterialProvider(m.url, m.provider)}|${m.url || ""}`).join("\n");
}

function parseMaterials(text) {
  return String(text || "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split("|");
    if (parts.length >= 3) {
      const title = parts.shift().trim() || "Materi";
      const provider = parts.shift().trim().toLowerCase();
      const url = parts.join("|").trim();
      return { title, provider: detectMaterialProvider(url, provider), url };
    }
    const [title, ...urlParts] = line.split("|");
    const url = urlParts.join("|").trim();
    return { title: title.trim() || "Materi", provider: detectMaterialProvider(url), url };
  }).filter((item) => item.url && item.provider !== "link");
}

function renderMaterialItem(item, index) {
  const provider = detectMaterialProvider(item.url, item.provider);
  return `<button class="material-link material-button" data-material-index="${index}" type="button"><div class="list-icon">${provider === "youtube" ? icon("video") : icon("book")}</div><div><b>${escapeHtml(item.title || "Materi")}</b><span>${provider === "youtube" ? "Video YouTube" : "Materi Google Drive"} · dibuka di dalam LMS</span></div><span class="material-arrow">${icon("arrow")}</span></button>`;
}

function openMaterialPreview(item) {
  const provider = detectMaterialProvider(item.url, item.provider);
  let body = "";
  if (provider === "youtube") {
    const id = youtubeId(item.url);
    body = id ? `<div class="private-preview-ratio private-preview-clean"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&controls=0&rel=0&playsinline=1&iv_load_policy=3&disablekb=1&fs=0" title="${escapeHtml(item.title || "Video")}" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : `<div class="notice notice-warning">Link YouTube tidak dikenali.</div>`;
  } else {
    const preview = googleDrivePreviewUrl(item.url);
    body = preview ? `<div class="private-preview-drive"><iframe src="${preview}" title="${escapeHtml(item.title || "Materi")}" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" allow="fullscreen" referrerpolicy="no-referrer"></iframe></div>` : `<div class="notice notice-warning">Link Google Drive tidak dikenali.</div>`;
  }
  const modal = openModal({ title: item.title || "Materi", subtitle: provider === "youtube" ? "Video YouTube" : "Google Drive", body, size: "lg", footer: `<button class="btn btn-primary" data-close-footer>Tutup</button>` });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
}

function openMeetingForm(classId, modules, meeting = null) {
  const source = getVideoSource(meeting || {});
  const body = `<form class="form-grid">
    <div class="form-group full"><label class="form-label">Judul video <span class="required">*</span></label><input id="meetingTitle" class="form-control" value="${escapeHtml(meeting?.title || "")}" required placeholder="Contoh: Rasul Sang Guru — Pertemuan 3"></div>
    <div class="form-group"><label class="form-label">Modul</label><select id="meetingModule" class="form-control"><option value="">Tanpa modul</option>${modules.map((m) => `<option value="${m.id}" ${meeting?.moduleId === m.id ? "selected" : ""}>${escapeHtml(m.title)}</option>`).join("")}</select></div>
    <div class="form-group"><label class="form-label">Status</label><select id="meetingPublished" class="form-control"><option value="true" ${meeting?.published !== false && meeting?.status !== "draft" ? "selected" : ""}>Terbit</option><option value="false" ${meeting?.published === false || meeting?.status === "draft" ? "selected" : ""}>Draf</option></select></div>
    <div class="form-group"><label class="form-label">Jadwal mulai</label><input id="meetingStart" class="form-control" type="datetime-local" value="${toInputDateTime(meeting?.startAt)}"><div class="form-help">Opsional. Kosongkan bila video dapat diputar kapan saja.</div></div>
    <div class="form-group"><label class="form-label">Jadwal selesai</label><input id="meetingEnd" class="form-control" type="datetime-local" value="${toInputDateTime(meeting?.endAt)}"></div>
    <div class="form-group"><label class="form-label">Sumber video</label><select id="meetingVideoProvider" class="form-control"><option value="youtube" ${source.provider === "youtube" ? "selected" : ""}>YouTube</option><option value="drive" ${source.provider === "drive" ? "selected" : ""}>Google Drive</option><option value="none" ${source.provider === "none" ? "selected" : ""}>Tanpa video</option></select></div>
    <div class="form-group"><label class="form-label">Link video</label><input id="meetingVideoUrl" class="form-control" type="url" value="${escapeHtml(source.url || "")}" placeholder="Tempel link YouTube atau Google Drive"></div>
    <div class="form-group full"><div class="notice notice-info"><b>Pengaturan privasi yang disarankan</b><br>YouTube: gunakan <b>Tidak Publik/Unlisted</b> dan aktifkan embedding. Google Drive: gunakan akses Viewer dan nonaktifkan opsi download, print, dan copy. LMS tidak menampilkan link sumber secara langsung.</div></div>
    <div class="form-group full"><label class="form-label">Deskripsi</label><textarea id="meetingDescription" class="form-control">${escapeHtml(meeting?.description || "")}</textarea></div>
    <div class="form-group full"><label class="form-label">Materi pendamping dari YouTube/Google Drive</label><textarea id="meetingMaterials" class="form-control" placeholder="Ringkasan PDF|drive|https://drive.google.com/...\nVideo tambahan|youtube|https://youtube.com/watch?v=..."></textarea><div class="form-help">Satu materi per baris: Judul|drive|URL atau Judul|youtube|URL. Materi dibuka di dalam LMS.</div></div>
  </form>`;
  const footer = `${meeting ? `<button class="btn btn-danger" id="deleteMeeting">Hapus</button>` : ""}<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="saveMeeting">Simpan</button>`;
  const modal = openModal({ title: meeting ? "Edit Video Pembelajaran" : "Tambah Video Pembelajaran", subtitle: "Gunakan sumber YouTube atau Google Drive.", body, footer });
  modal.querySelector("#meetingMaterials").value = materialsToText(meeting?.materials);
  const syncProvider = () => {
    const provider = modal.querySelector("#meetingVideoProvider").value;
    const input = modal.querySelector("#meetingVideoUrl");
    input.disabled = provider === "none";
    input.placeholder = provider === "youtube" ? "https://youtube.com/watch?v=..." : provider === "drive" ? "https://drive.google.com/file/d/.../view" : "Tanpa video";
  };
  modal.querySelector("#meetingVideoProvider")?.addEventListener("change", syncProvider); syncProvider();
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#saveMeeting")?.addEventListener("click", async () => {
    const title = modal.querySelector("#meetingTitle").value.trim(); if (!title) return toast("Judul wajib diisi.", "warning");
    const provider = modal.querySelector("#meetingVideoProvider").value;
    const videoUrl = modal.querySelector("#meetingVideoUrl").value.trim();
    let ytId = "", driveId = "";
    if (provider === "youtube") { ytId = youtubeId(videoUrl); if (!ytId) return toast("Link YouTube tidak dikenali.", "warning"); }
    if (provider === "drive") { driveId = googleDriveId(videoUrl); if (!driveId) return toast("Link Google Drive tidak dikenali.", "warning"); }
    const published = modal.querySelector("#meetingPublished").value === "true";
    const id = meeting?.id || uid("pertemuan");
    const payload = {
      title,
      moduleId: modal.querySelector("#meetingModule").value,
      status: published ? "auto" : "draft",
      published,
      startAt: modal.querySelector("#meetingStart").value ? new Date(modal.querySelector("#meetingStart").value).toISOString() : "",
      endAt: modal.querySelector("#meetingEnd").value ? new Date(modal.querySelector("#meetingEnd").value).toISOString() : "",
      videoProvider: provider,
      videoUrl: provider === "none" ? "" : videoUrl,
      youtubeUrl: provider === "youtube" ? videoUrl : "",
      youtubeId: provider === "youtube" ? ytId : "",
      driveUrl: provider === "drive" ? videoUrl : "",
      driveId: provider === "drive" ? driveId : "",
      description: modal.querySelector("#meetingDescription").value.trim(),
      materials: parseMaterials(modal.querySelector("#meetingMaterials").value),
      createdAt: meeting?.createdAt || Date.now(), updatedAt: Date.now(), createdBy: meeting?.createdBy || state.user.uid
    };
    await setValue(`meetings/${classId}/${id}`, payload); closeModal(); toast("Video pembelajaran berhasil disimpan.", "success"); renderClassDetail(classId);
  });
  modal.querySelector("#deleteMeeting")?.addEventListener("click", async () => { if (confirm("Hapus video beserta data terkait?")) { const id = meeting.id; await updateValues({ [`meetings/${classId}/${id}`]: null, [`attendance/${classId}/${id}`]: null, [`watchProgress/${classId}/${id}`]: null, [`notes/${classId}/${id}`]: null, [`discussions/${classId}/${id}`]: null, [`quizzes/${classId}/${id}`]: null, [`quizResults/${classId}/${id}`]: null }); closeModal(); renderClassDetail(classId); } });
}

function openAssignmentForm(classId, assignment = null) {
  const body = `<form class="form-grid"><div class="form-group full"><label class="form-label">Judul tugas <span class="required">*</span></label><input id="assignmentTitle" class="form-control" value="${escapeHtml(assignment?.title || "")}"></div><div class="form-group"><label class="form-label">Tenggat</label><input id="assignmentDue" class="form-control" type="datetime-local" value="${toInputDateTime(assignment?.dueAt)}"></div><div class="form-group"><label class="form-label">Poin maksimal</label><input id="assignmentPoints" class="form-control" type="number" min="1" value="${assignment?.points || 100}"></div><div class="form-group full"><label class="form-label">Instruksi</label><textarea id="assignmentDescription" class="form-control">${escapeHtml(assignment?.description || "")}</textarea></div></form>`;
  const footer = `${assignment ? `<button class="btn btn-danger" id="deleteAssignment">Hapus</button>` : ""}<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="saveAssignment">Simpan Tugas</button>`;
  const modal = openModal({ title: assignment ? "Edit Tugas" : "Tambah Tugas", body, footer });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#saveAssignment")?.addEventListener("click", async () => {
    const title = modal.querySelector("#assignmentTitle").value.trim(); if (!title) return toast("Judul tugas wajib diisi.", "warning");
    const id = assignment?.id || uid("tugas");
    await setValue(`assignments/${classId}/${id}`, { title, description: modal.querySelector("#assignmentDescription").value.trim(), dueAt: modal.querySelector("#assignmentDue").value ? new Date(modal.querySelector("#assignmentDue").value).toISOString() : "", points: Number(modal.querySelector("#assignmentPoints").value || 100), published: true, createdAt: assignment?.createdAt || Date.now(), updatedAt: Date.now(), createdBy: assignment?.createdBy || state.user.uid }); closeModal(); toast("Tugas berhasil disimpan.", "success"); renderClassDetail(classId);
  });
  modal.querySelector("#deleteAssignment")?.addEventListener("click", async () => { if (confirm("Hapus tugas dan semua kiriman peserta?")) { await updateValues({ [`assignments/${classId}/${assignment.id}`]: null, [`submissions/${classId}/${assignment.id}`]: null }); closeModal(); renderClassDetail(classId); } });
}

async function openClassMembers(classId, course) {
  const users = (await getAllUsers()).filter((u) => normalizeRole(u.role) === "student" && u.status !== "inactive");
  const current = await getValue(`classMembers/${classId}`, {});
  const body = `<div class="filter-row"><input id="memberSearch" class="form-control" placeholder="Cari peserta..."></div><div id="memberList" class="stack">${renderMemberChecks(users, current)}</div>`;
  const modal = openModal({ title: `Peserta: ${course.title}`, subtitle: `${Object.keys(current || {}).length} peserta terdaftar`, body, size: "lg", footer: `<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="saveMembers">Simpan Peserta</button>` });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#memberSearch")?.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    modal.querySelectorAll("[data-member-row]").forEach((row) => {
      row.classList.toggle("hidden", term && !row.dataset.memberName.includes(term));
    });
  });
  modal.querySelector("#saveMembers")?.addEventListener("click", async () => {
    const updates = {};
    users.forEach((user) => { const checked = modal.querySelector(`[data-member="${user.uid}"]`)?.checked || false; updates[`classMembers/${classId}/${user.uid}`] = checked ? { role: "student", joinedAt: current?.[user.uid]?.joinedAt || Date.now() } : null; updates[`userClasses/${user.uid}/${classId}`] = checked ? true : null; });
    await updateValues(updates); closeModal(); toast("Daftar peserta berhasil diperbarui.", "success"); renderClassDetail(classId);
  });
}

function renderMemberChecks(users, current) {
  return users.map((user) => `<label class="list-item" data-member-row data-member-name="${escapeHtml(`${user.name} ${user.email}`.toLowerCase())}"><input type="checkbox" data-member="${user.uid}" ${current?.[user.uid] ? "checked" : ""}><div class="avatar">${initials(user.name)}</div><div class="list-copy"><b>${escapeHtml(user.name)}</b><span>${escapeHtml(user.email)}</span></div></label>`).join("") || emptyState("Peserta tidak ditemukan", "Belum ada akun peserta yang aktif.");
}

let youtubeApiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

async function renderMeetingRoom(classId, meetingId) {
  const [courseData, meeting, quiz, myProgress, myNotes] = await Promise.all([
    getClass(classId),
    getValue(`meetings/${classId}/${meetingId}`),
    getValue(`quizzes/${classId}/${meetingId}`, {}),
    getValue(`watchProgress/${classId}/${meetingId}/${state.user.uid}`),
    getValue(`notes/${classId}/${meetingId}/${state.user.uid}`, "")
  ]);
  if (!courseData || !meeting) throw new Error("Video tidak ditemukan atau akses tidak tersedia.");
  if (isStudentRole() && !(await getValue(`userClasses/${state.user.uid}/${classId}`, false))) { toast("Anda belum memiliki akses ke kelas ini.", "warning"); navigate("catalog"); return; }
  const course = { id: classId, ...courseData };
  const manageable = canManageClass(course);
  const source = getVideoSource(meeting);
  const availability = videoAvailability(meeting);
  state.currentMeeting = { id: meetingId, ...meeting };
  state.currentClassId = classId;
  state.watchSeconds = Number(myProgress?.durationSeconds || 0);
  const materials = Array.isArray(meeting.materials) ? meeting.materials : objectToArray(meeting.materials || {});
  const quizQuestions = objectToArray(quiz?.questions || quiz || {});
  const quizResult = await getValue(`quizResults/${classId}/${meetingId}/${state.user.uid}`);

  const youtubePlayer = source.provider === "youtube" && source.youtubeId ? `
    <div id="youtube-player" class="clean-video-stage"></div>
    <button class="clean-video-cover" id="cleanVideoStart" type="button" aria-label="Putar video pembelajaran" style="--video-thumb:url('https://i.ytimg.com/vi/${encodeURIComponent(source.youtubeId)}/hqdefault.jpg')"><span class="clean-video-brand"><img src="assets/logo-izzuddin.png" alt=""><b>IZZUDDIN ACADEMY</b></span><span class="clean-play-orb">${icon("play")}</span><span class="clean-video-label">Putar Video Pembelajaran</span></button>
    <button class="clean-video-paused hidden" id="cleanVideoPaused" type="button" aria-label="Lanjutkan video"><span class="clean-play-orb">${icon("play")}</span><b>Lanjutkan Video</b></button>
    <div class="clean-video-loading hidden" id="cleanVideoLoading"><span class="clean-spinner"></span><b>Menyiapkan video...</b></div>
    <div class="clean-video-finished hidden" id="cleanVideoFinished"><img src="assets/logo-izzuddin.png" alt=""><b>Video selesai</b><span>Progres belajar telah tersimpan.</span><button class="btn btn-primary btn-sm" id="cleanVideoReplay" type="button">${icon("play")} Putar Ulang</button></div>
    <div class="clean-video-error hidden" id="cleanVideoError"><b>Video belum dapat diputar</b><span>Pastikan video mengizinkan embedding dan tidak disetel Private.</span><button class="btn btn-secondary btn-sm" id="cleanVideoRetry" type="button">Coba Lagi</button></div>` : "";
  const drivePlayer = source.provider === "drive" && source.driveUrl ? `<div class="drive-video-stage"><iframe src="${source.driveUrl}" title="${escapeHtml(meeting.title)}" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe><span class="drive-private-label">Google Drive · diputar di Izzuddin Academy</span></div>` : "";
  const emptyPlayer = source.provider === "none" || (!youtubePlayer && !drivePlayer) ? `<div class="video-placeholder"><div><b>Video belum tersedia</b><span>Pengajar belum memasang sumber video pada materi ini.</span></div></div>` : "";

  qs("#pageContent").innerHTML = `
    <div class="page-actions room-top-actions" style="margin-bottom:14px"><button class="btn btn-ghost btn-sm" id="backToClass">${icon("back")} Kembali ke Kelas</button>${manageable ? `<button class="btn btn-secondary btn-sm" id="editCurrentMeeting">${icon("edit")} Edit Video</button><button class="btn btn-secondary btn-sm" id="manageQuiz">${icon("quiz")} Kelola Kuis</button>` : ""}</div>
    <div class="room-layout"><div class="stack room-main-column"><section class="video-shell"><div class="video-ratio clean-video-frame" id="cleanVideoFrame">${youtubePlayer}${drivePlayer}${emptyPlayer}</div>
      ${source.provider === "youtube" && source.youtubeId ? `<div class="clean-player-bar"><button class="clean-toggle" id="cleanVideoToggle" type="button" disabled aria-label="Putar atau jeda video"><span>${icon("play")}</span><b>Putar</b></button><span>Pemutar bersih Izzuddin Academy</span></div>` : source.provider === "drive" && source.driveUrl ? `<div class="clean-player-bar drive-player-bar"><span>Gunakan tombol putar pada video. Tautan sumber tidak ditampilkan.</span><button class="clean-toggle" id="markDriveComplete" type="button"><span>${icon("check")}</span><b>Tandai Selesai</b></button></div>` : ""}
      <div class="room-info"><div class="room-title-row"><div><h2>${escapeHtml(meeting.title)}</h2><p>${escapeHtml(course.title)} · ${meeting.startAt ? formatDateTime(meeting.startAt) : "Dapat dipelajari kapan saja"} · ${escapeHtml(course.teacherName || "Pengajar Izzuddin")}</p></div><span class="badge badge-${availability.key}">${availability.label}</span></div>${meeting.description ? `<p>${escapeHtml(meeting.description)}</p>` : ""}</div></section>
      <section class="card card-pad"><div class="tabs" id="roomTabs"><button class="tab-btn active" data-tab="materials">Materi</button><button class="tab-btn" data-tab="notes">Catatan Saya</button><button class="tab-btn" data-tab="discussion">Diskusi</button><button class="tab-btn" data-tab="quiz">Kuis</button></div><div style="margin-top:16px"><div class="tab-panel active" data-panel="materials"><div class="stack">${materials.map(renderMaterialItem).join("") || emptyState("Belum ada materi pendamping", "Pengajar dapat menambahkan bahan dari YouTube atau Google Drive.")}</div></div><div class="tab-panel" data-panel="notes"><textarea id="personalNotes" class="form-control note-area" placeholder="Tuliskan pemahaman, poin penting, dan refleksi pribadi...">${escapeHtml(typeof myNotes === "string" ? myNotes : myNotes?.body || "")}</textarea><div class="form-help" id="notesStatus" style="margin-top:8px">Catatan disimpan otomatis.</div></div><div class="tab-panel" data-panel="discussion"><div id="discussionList" class="discussion-list"></div><form id="commentForm" class="comment-form"><textarea id="commentBody" class="form-control" rows="3" placeholder="Ajukan pertanyaan atau bagikan pemahaman..." required></textarea><button class="btn btn-primary" type="submit">Kirim Diskusi</button></form></div><div class="tab-panel" data-panel="quiz">${renderQuiz(quizQuestions, quizResult, manageable)}</div></div></section></div>
      <aside class="stack room-side-column"><section class="watch-card"><h4>Progres Menonton</h4><div class="watch-metrics"><div class="watch-metric"><span>Durasi aktif</span><b id="watchDuration">${durationText(state.watchSeconds)}</b></div><div class="watch-metric"><span>Progres video</span><b id="watchPercent">${Number(myProgress?.percent || 0)}%</b></div></div><div class="class-progress"><div class="progress-label"><span>Status pembelajaran</span><span id="completionLabel">${Number(myProgress?.percent || 0) >= appConfig.completionPercent ? "Tuntas" : "Berlangsung"}</span></div><div class="progress-track"><div id="watchBar" class="progress-bar" style="width:${Number(myProgress?.percent || 0)}%"></div></div></div></section><section class="card"><div class="card-head"><div><h3>Informasi Video</h3><p>Jadwal dan sumber pembelajaran.</p></div></div><div class="card-body stack"><div class="notice notice-info"><b>${availability.label}</b><br>${meeting.startAt ? formatDateTime(meeting.startAt) : "Dapat diputar kapan saja"}<br>Sumber: ${source.provider === "drive" ? "Google Drive" : source.provider === "youtube" ? "YouTube" : "Belum ditentukan"}</div><div class="privacy-note"><b>Akses melalui LMS</b><span>Gunakan video hanya untuk kegiatan belajar dan jangan menyebarkan tautan atau materi kepada pihak lain.</span></div></div></section>${quizResult ? `<section class="card card-pad"><div class="section-title" style="margin:0"><div><h3>Hasil Kuis</h3><p>Nilai formatif materi ini.</p></div></div><div style="font:800 2rem 'Plus Jakarta Sans';margin-top:15px">${quizResult.score ?? 0}/${quizResult.total ?? 0}</div></section>` : ""}</aside></div>`;

  qs("#backToClass")?.addEventListener("click", () => navigate("class", classId));
  qs("#editCurrentMeeting")?.addEventListener("click", async () => openMeetingForm(classId, await getModules(classId), { id: meetingId, ...meeting }));
  qs("#manageQuiz")?.addEventListener("click", () => openQuizBuilder(classId, meetingId, quizQuestions));
  qsa("#roomTabs [data-tab]").forEach((button) => button.addEventListener("click", () => { qsa("#roomTabs .tab-btn").forEach((el) => el.classList.remove("active")); button.classList.add("active"); qsa("[data-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === button.dataset.tab)); }));
  qsa("[data-material-index]").forEach((button) => button.addEventListener("click", () => openMaterialPreview(materials[Number(button.dataset.materialIndex)])));
  qs("#personalNotes")?.addEventListener("input", debounce(async (event) => { qs("#notesStatus").textContent = "Menyimpan catatan..."; try { await setValue(`notes/${classId}/${meetingId}/${state.user.uid}`, { body: event.target.value, updatedAt: Date.now() }); qs("#notesStatus").textContent = "Catatan tersimpan otomatis."; } catch (_) { qs("#notesStatus").textContent = "Catatan belum tersimpan."; } }, 800));
  qs("#markDriveComplete")?.addEventListener("click", async () => {
    const now = Date.now();
    await setValue(`watchProgress/${classId}/${meetingId}/${state.user.uid}`, { classId, meetingId, uid: state.user.uid, displayName: state.profile.name, durationSeconds: state.watchSeconds, lastPosition: 0, videoDuration: 0, percent: 100, lastSeenAt: now, completedAt: now, status: "completed", provider: "drive" });
    await updateValue(`attendance/${classId}/${meetingId}/${state.user.uid}`, { lastSeenAt: now, status: "completed", percent: 100 });
    qs("#watchPercent").textContent = "100%"; qs("#watchBar").style.width = "100%"; qs("#completionLabel").textContent = "Tuntas"; toast("Video ditandai selesai.", "success");
  });
  setupDiscussion(classId, meetingId);
  setupQuizSubmission(classId, meetingId, quizQuestions, quizResult);
  await markAttendance(classId, meetingId, "video");
  if (source.provider === "youtube" && source.youtubeId) await setupYouTubePlayer(classId, meetingId, source.youtubeId);
}

function renderQuiz(questions, result, manageable) {
  if (!questions.length) return emptyState("Belum ada kuis", manageable ? "Tambahkan pertanyaan formatif untuk mengecek pemahaman peserta." : "Pengajar belum menambahkan kuis pada pertemuan ini.");
  if (result) return `<div class="notice notice-success">Kuis telah dikerjakan. Nilai Anda <b>${result.score}/${result.total}</b>.</div><div class="stack" style="margin-top:14px">${questions.map((q,i) => `<div class="quiz-question"><h4>${i+1}. ${escapeHtml(q.text)}</h4><div class="muted" style="font-size:.65rem">Jawaban Anda: ${escapeHtml(q.options?.[result.answers?.[q.id]] || "-")}</div></div>`).join("")}</div>`;
  return `<form id="quizForm" class="stack">${questions.map((q,i) => `<div class="quiz-question"><h4>${i+1}. ${escapeHtml(q.text)} <span class="muted">(${q.points || 1} poin)</span></h4><div class="quiz-options">${(q.options || []).map((option,index) => `<label class="quiz-option"><input type="radio" name="question-${q.id}" value="${index}" required><span>${escapeHtml(option)}</span></label>`).join("")}</div></div>`).join("")}<button class="btn btn-primary" type="submit">Kirim Jawaban Kuis</button></form>`;
}

function setupQuizSubmission(classId, meetingId, questions, result) {
  if (result || !questions.length) return;
  qs("#quizForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const answers = {}; let score = 0; let total = 0;
    for (const question of questions) {
      const selected = event.currentTarget.querySelector(`input[name="question-${question.id}"]:checked`);
      if (!selected) return toast("Jawab seluruh pertanyaan terlebih dahulu.", "warning");
      const index = Number(selected.value); answers[question.id] = index;
      total += Number(question.points || 1); if (index === Number(question.correctIndex)) score += Number(question.points || 1);
    }
    try { await setValue(`quizResults/${classId}/${meetingId}/${state.user.uid}`, { answers, score, total, submittedAt: Date.now(), studentName: state.profile.name }); toast("Jawaban kuis berhasil dikirim.", "success"); renderMeetingRoom(classId, meetingId); } catch (error) { toast(friendlyError(error), "error"); }
  });
}

function openQuizBuilder(classId, meetingId, questions) {
  const working = questions.length ? questions.map((q) => ({ ...q, options: [...(q.options || [])] })) : [{ id: uid("q"), text: "", options: ["","","",""], correctIndex: 0, points: 1 }];
  const body = `<div id="quizBuilder"></div><button class="btn btn-secondary" id="addQuizQuestion" style="margin-top:14px">${icon("plus")} Tambah Pertanyaan</button><div class="notice notice-warning" style="margin-top:15px">Kuis ini bersifat formatif. Untuk ujian berisiko tinggi, gunakan penilaian server/Cloud Functions agar kunci jawaban tidak tersedia di sisi peserta.</div>`;
  const modal = openModal({ title: "Kelola Kuis Formatif", subtitle: "Tambahkan pertanyaan pilihan ganda dan tentukan jawaban benar.", body, size: "lg", footer: `<button class="btn btn-danger" id="deleteQuiz">Hapus Kuis</button><button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="saveQuiz">Simpan Kuis</button>` });
  const renderBuilder = () => {
    modal.querySelector("#quizBuilder").innerHTML = working.map((q, qi) => `<div class="quiz-question" data-q-index="${qi}" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:10px"><h4>Pertanyaan ${qi+1}</h4><button class="icon-btn" data-remove-question="${qi}">×</button></div><div class="form-group"><input class="form-control" data-q-text="${qi}" value="${escapeHtml(q.text)}" placeholder="Tuliskan pertanyaan..."></div><div class="grid grid-2" style="margin-top:10px">${q.options.map((opt,oi) => `<div class="form-group"><label class="form-label">Pilihan ${String.fromCharCode(65+oi)} ${Number(q.correctIndex) === oi ? "· Jawaban benar" : ""}</label><div style="display:flex;gap:7px"><input class="form-control" data-q-option="${qi}|${oi}" value="${escapeHtml(opt)}"><button class="icon-btn" type="button" data-correct="${qi}|${oi}">${Number(q.correctIndex) === oi ? "✓" : "○"}</button></div></div>`).join("")}</div><div class="form-group" style="margin-top:10px"><label class="form-label">Poin</label><input class="form-control" style="max-width:120px" type="number" min="1" data-q-points="${qi}" value="${q.points || 1}"></div></div>`).join("");
    modal.querySelectorAll("[data-remove-question]").forEach((el) => el.addEventListener("click", () => { if (working.length > 1) { working.splice(Number(el.dataset.removeQuestion),1); renderBuilder(); } }));
    modal.querySelectorAll("[data-correct]").forEach((el) => el.addEventListener("click", () => { const [qi,oi] = el.dataset.correct.split("|").map(Number); syncBuilder(); working[qi].correctIndex = oi; renderBuilder(); }));
  };
  const syncBuilder = () => {
    modal.querySelectorAll("[data-q-text]").forEach((el) => { working[Number(el.dataset.qText)].text = el.value; });
    modal.querySelectorAll("[data-q-option]").forEach((el) => { const [qi,oi] = el.dataset.qOption.split("|").map(Number); working[qi].options[oi] = el.value; });
    modal.querySelectorAll("[data-q-points]").forEach((el) => { working[Number(el.dataset.qPoints)].points = Number(el.value || 1); });
  };
  renderBuilder();
  modal.querySelector("#addQuizQuestion")?.addEventListener("click", () => { syncBuilder(); working.push({ id: uid("q"), text: "", options: ["","","",""], correctIndex: 0, points: 1 }); renderBuilder(); });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#saveQuiz")?.addEventListener("click", async () => { syncBuilder(); if (working.some((q) => !q.text.trim() || q.options.some((o) => !o.trim()))) return toast("Lengkapi seluruh pertanyaan dan pilihan jawaban.", "warning"); const payload = {}; working.forEach((q) => { payload[q.id] = { text: q.text.trim(), options: q.options.map((o) => o.trim()), correctIndex: Number(q.correctIndex), points: Number(q.points || 1) }; }); await setValue(`quizzes/${classId}/${meetingId}/questions`, payload); closeModal(); toast("Kuis berhasil disimpan.", "success"); renderMeetingRoom(classId, meetingId); });
  modal.querySelector("#deleteQuiz")?.addEventListener("click", async () => { if (confirm("Hapus kuis dan seluruh hasil peserta?")) { await updateValues({ [`quizzes/${classId}/${meetingId}`]: null, [`quizResults/${classId}/${meetingId}`]: null }); closeModal(); renderMeetingRoom(classId, meetingId); } });
}

function setupDiscussion(classId, meetingId) {
  const unsubscribe = subscribe(`discussions/${classId}/${meetingId}`, (data) => {
    const comments = objectToArray(data || {}).sort((a,b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    const list = qs("#discussionList");
    if (!list) return;
    list.innerHTML = comments.map((comment) => `<div class="comment"><div class="avatar">${initials(comment.name)}</div><div class="comment-copy"><b>${escapeHtml(comment.name || "Pengguna")}</b><time>${formatDateTime(comment.createdAt)}</time><p>${escapeHtml(comment.body || "")}</p></div></div>`).join("") || emptyState("Belum ada diskusi", "Jadilah peserta pertama yang mengajukan pertanyaan.");
    list.scrollTop = list.scrollHeight;
  });
  state.unsubscribers.push(unsubscribe);
  qs("#commentForm")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const body = qs("#commentBody").value.trim(); if (!body) return;
    try { await pushValue(`discussions/${classId}/${meetingId}`, { uid: state.user.uid, name: state.profile.name, role: state.profile.role, body, createdAt: Date.now() }); qs("#commentBody").value = ""; } catch (error) { toast(friendlyError(error), "error"); }
  });
}

async function markAttendance(classId, meetingId, mode = "video") {
  const path = `attendance/${classId}/${meetingId}/${state.user.uid}`;
  const existing = await getValue(path);
  const now = Date.now();
  await setValue(path, { classId, meetingId, uid: state.user.uid, displayName: state.profile.name, role: state.profile.role, joinedAt: existing?.joinedAt || now, lastSeenAt: now, mode: "video", status: existing?.status || "opened" });
}

async function setupYouTubePlayer(classId, meetingId, videoId) {
  const startButton = qs("#cleanVideoStart");
  const pausedCover = qs("#cleanVideoPaused");
  const loading = qs("#cleanVideoLoading");
  const finished = qs("#cleanVideoFinished");
  const errorBox = qs("#cleanVideoError");
  const toggle = qs("#cleanVideoToggle");
  const replay = qs("#cleanVideoReplay");
  const retry = qs("#cleanVideoRetry");
  let creating = false;
  const updateToggle = (isPlaying) => { if (!toggle) return; toggle.disabled = !state.playerReady; toggle.innerHTML = `<span>${isPlaying ? "❚❚" : icon("play")}</span><b>${isPlaying ? "Jeda" : "Putar"}</b>`; };
  const resetStage = () => {
    try { state.player?.destroy?.(); } catch (_) {}
    state.player = null; state.playerReady = false; state.playing = false;
    const frame = qs("#cleanVideoFrame"); let stage = qs("#youtube-player");
    if (!stage && frame) { stage = document.createElement("div"); stage.id = "youtube-player"; stage.className = "clean-video-stage"; frame.prepend(stage); }
    else if (stage && stage.tagName === "IFRAME") { const replacement = document.createElement("div"); replacement.id = "youtube-player"; replacement.className = "clean-video-stage"; stage.replaceWith(replacement); }
    else if (stage) { stage.innerHTML = ""; stage.className = "clean-video-stage"; }
    updateToggle(false);
  };
  const showError = () => { resetStage(); loading?.classList.add("hidden"); pausedCover?.classList.add("hidden"); startButton?.classList.add("is-hidden"); finished?.classList.add("hidden"); errorBox?.classList.remove("hidden"); };
  const showFinished = async () => { loading?.classList.add("hidden"); pausedCover?.classList.add("hidden"); errorBox?.classList.add("hidden"); finished?.classList.remove("hidden"); await saveWatchProgress(classId, meetingId, true); resetStage(); finished?.classList.remove("hidden"); };
  const beginPlayback = async ({ restart = false } = {}) => {
    if (creating) return; creating = true;
    startButton?.classList.add("is-hidden"); pausedCover?.classList.add("hidden"); finished?.classList.add("hidden"); errorBox?.classList.add("hidden"); loading?.classList.remove("hidden"); resetStage();
    try {
      const [YT, progress] = await Promise.all([loadYouTubeApi(), getValue(`watchProgress/${classId}/${meetingId}/${state.user.uid}`)]);
      const playerVars = { autoplay: 1, controls: 0, rel: 0, playsinline: 1, enablejsapi: 1, disablekb: 1, fs: 0, iv_load_policy: 3, cc_load_policy: 0, modestbranding: 1 };
      if (location.protocol === "https:" || location.protocol === "http:") playerVars.origin = location.origin;
      const resumeAt = restart ? 0 : Number(progress?.lastPosition || 0); if (resumeAt > 10) playerVars.start = Math.floor(resumeAt);
      state.player = new YT.Player("youtube-player", { host: "https://www.youtube-nocookie.com", videoId, playerVars, events: {
        onReady: (event) => { state.playerReady = true; loading?.classList.add("hidden"); updateToggle(false); startWatchTimers(classId, meetingId); try { event.target.playVideo(); } catch (_) {} },
        onStateChange: (event) => {
          state.playing = event.data === YT.PlayerState.PLAYING; updateToggle(state.playing);
          if (event.data === YT.PlayerState.PLAYING) pausedCover?.classList.add("hidden");
          if (event.data === YT.PlayerState.PAUSED) pausedCover?.classList.remove("hidden");
          if (event.data === YT.PlayerState.ENDED) showFinished();
        },
        onError: showError
      }});
    } catch (error) { console.warn("Gagal memuat pemutar YouTube", error); showError(); } finally { creating = false; }
  };
  startButton?.addEventListener("click", () => beginPlayback());
  replay?.addEventListener("click", () => beginPlayback({ restart: true }));
  retry?.addEventListener("click", () => beginPlayback());
  pausedCover?.addEventListener("click", () => { try { state.player?.playVideo?.(); } catch (_) {} });
  toggle?.addEventListener("click", () => { if (!state.playerReady || !state.player) return; try { if (state.playing) state.player.pauseVideo(); else state.player.playVideo(); } catch (_) {} });
}

function startWatchTimers(classId, meetingId) {
  clearInterval(state.watchHeartbeatTimer); clearInterval(state.watchSaveTimer);
  state.watchHeartbeatTimer = setInterval(() => {
    if (!state.playing || document.hidden) return;
    state.watchSeconds += appConfig.watchHeartbeatSeconds;
    const durationEl = qs("#watchDuration"); if (durationEl) durationEl.textContent = durationText(state.watchSeconds);
  }, appConfig.watchHeartbeatSeconds * 1000);
  state.watchSaveTimer = setInterval(() => saveWatchProgress(classId, meetingId), appConfig.watchSaveSeconds * 1000);
  window.addEventListener("beforeunload", () => saveWatchProgress(classId, meetingId), { once: true });
}

async function saveWatchProgress(classId, meetingId, ended = false) {
  if (!state.playerReady || !state.player) return;
  try {
    const position = Number(state.player.getCurrentTime?.() || 0);
    const duration = Number(state.player.getDuration?.() || 0);
    const currentPercent = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;
    const old = await getValue(`watchProgress/${classId}/${meetingId}/${state.user.uid}`, {});
    const percentValue = Math.max(Number(old?.percent || 0), ended ? 100 : currentPercent);
    const payload = { classId, meetingId, uid: state.user.uid, displayName: state.profile.name, durationSeconds: Math.max(Number(old?.durationSeconds || 0), state.watchSeconds), lastPosition: position, videoDuration: duration, percent: percentValue, lastSeenAt: Date.now(), completedAt: percentValue >= appConfig.completionPercent ? (old?.completedAt || Date.now()) : null, status: percentValue >= appConfig.completionPercent ? "completed" : "in_progress" };
    await setValue(`watchProgress/${classId}/${meetingId}/${state.user.uid}`, payload);
    await updateValue(`attendance/${classId}/${meetingId}/${state.user.uid}`, { lastSeenAt: Date.now(), status: percentValue >= appConfig.completionPercent ? "completed" : "watching", percent: percentValue });
    const percentEl = qs("#watchPercent"); const bar = qs("#watchBar"); const label = qs("#completionLabel");
    if (percentEl) percentEl.textContent = `${percentValue}%`; if (bar) bar.style.width = `${percentValue}%`; if (label) label.textContent = percentValue >= appConfig.completionPercent ? "Tuntas" : "Berlangsung";
  } catch (error) { console.warn("Gagal menyimpan progres", error); }
}

async function renderReports() {
  state.classes = await getMyClasses(state.user.uid, state.profile.role);
  if (isStudentRole()) return renderStudentReport();
  const selectedId = state.classes[0]?.id || "";
  qs("#pageContent").innerHTML = `
    <div class="page-head"><div><h2>Laporan Belajar</h2><p>Pantau kehadiran, durasi menonton, penyelesaian video, kuis, dan tugas peserta.</p></div><div class="page-actions"><button class="btn btn-secondary" id="exportReport">${icon("download")} Unduh CSV</button></div></div>
    <div class="filter-row"><select id="reportClass" class="form-control"><option value="">Pilih kelas</option>${state.classes.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("")}</select></div>
    <div id="reportContent" class="card">${emptyState("Pilih kelas", "Pilih kelas untuk menampilkan laporan peserta.")}</div>`;
  const select = qs("#reportClass"); if (selectedId) { select.value = selectedId; await loadClassReport(selectedId); }
  select?.addEventListener("change", () => loadClassReport(select.value));
  qs("#exportReport")?.addEventListener("click", () => exportCurrentReport(select.value));
}

async function loadClassReport(classId) {
  if (!classId) return;
  const [course, members, meetings, assignments] = await Promise.all([getClass(classId), getClassMembers(classId), getMeetings(classId), getAssignments(classId)]);
  const rows = [];
  for (const member of members) {
    let attendanceCount = 0, watchedSeconds = 0, percentTotal = 0, percentCount = 0, completed = 0, quizScore = 0, quizTotal = 0, tasksSubmitted = 0, tasksScore = 0, tasksMax = 0;
    for (const meeting of meetings) {
      const [attendance, progress, result] = await Promise.all([getValue(`attendance/${classId}/${meeting.id}/${member.uid}`), getValue(`watchProgress/${classId}/${meeting.id}/${member.uid}`), getValue(`quizResults/${classId}/${meeting.id}/${member.uid}`)]);
      if (attendance) attendanceCount++;
      if (progress) { watchedSeconds += Number(progress.durationSeconds || 0); percentTotal += Number(progress.percent || 0); percentCount++; if (Number(progress.percent || 0) >= appConfig.completionPercent) completed++; }
      if (result) { quizScore += Number(result.score || 0); quizTotal += Number(result.total || 0); }
    }
    for (const task of assignments) {
      const submission = await getValue(`submissions/${classId}/${task.id}/${member.uid}`);
      if (submission) { tasksSubmitted++; if (submission.score != null) { tasksScore += Number(submission.score || 0); tasksMax += Number(task.points || 100); } }
    }
    rows.push({ uid: member.uid, name: member.name, attendanceCount, meetingCount: meetings.length, watchedSeconds, averagePercent: percentCount ? Math.round(percentTotal/percentCount) : 0, completed, quizScore, quizTotal, tasksSubmitted, taskCount: assignments.length, tasksScore, tasksMax });
  }
  state.currentReportRows = rows;
  state.currentReportClass = course;
  qs("#reportContent").innerHTML = `
    <div class="card-head"><div><h3>${escapeHtml(course?.title || "Laporan Kelas")}</h3><p>${members.length} peserta · ${meetings.length} pertemuan · ${assignments.length} tugas</p></div></div>
    <div class="card-body"><div class="stats-grid" style="margin-top:0;margin-bottom:17px"><article class="stat-card"><div class="stat-icon">${icon("users")}</div><div class="stat-value">${members.length}</div><div class="stat-label">Peserta terdaftar</div></article><article class="stat-card"><div class="stat-icon">${icon("video")}</div><div class="stat-value">${meetings.length}</div><div class="stat-label">Total pertemuan</div></article><article class="stat-card"><div class="stat-icon">${icon("check")}</div><div class="stat-value">${rows.length ? Math.round(rows.reduce((s,r)=>s+r.averagePercent,0)/rows.length) : 0}%</div><div class="stat-label">Rata-rata progres</div></article><article class="stat-card"><div class="stat-icon">${icon("tasks")}</div><div class="stat-value">${assignments.length}</div><div class="stat-label">Tugas kelas</div></article></div>
    <div class="table-wrap"><table><thead><tr><th>Peserta</th><th>Kehadiran</th><th>Durasi</th><th>Progres</th><th>Tuntas</th><th>Kuis</th><th>Tugas</th></tr></thead><tbody>${rows.map((r) => `<tr><td><div class="table-user"><div class="avatar">${initials(r.name)}</div><div><b>${escapeHtml(r.name)}</b><span>${escapeHtml(r.uid)}</span></div></div></td><td>${r.attendanceCount}/${r.meetingCount}</td><td>${durationText(r.watchedSeconds)}</td><td><div class="kpi-bar"><div class="progress-track"><div class="progress-bar" style="width:${r.averagePercent}%"></div></div><b>${r.averagePercent}%</b></div></td><td>${r.completed}/${r.meetingCount}</td><td>${r.quizTotal ? `${r.quizScore}/${r.quizTotal}` : "-"}</td><td>${r.tasksSubmitted}/${r.taskCount}${r.tasksMax ? ` · ${r.tasksScore}/${r.tasksMax}` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="text-center muted">Belum ada peserta.</td></tr>`}</tbody></table></div></div>`;
}

function exportCurrentReport(classId) {
  if (!classId || !state.currentReportRows?.length) return toast("Belum ada data laporan untuk diunduh.", "warning");
  const rows = state.currentReportRows.map((r) => ({ Nama: r.name, Kehadiran: `${r.attendanceCount}/${r.meetingCount}`, "Durasi Menonton": durationText(r.watchedSeconds), "Rata-rata Progres": `${r.averagePercent}%`, "Pertemuan Tuntas": `${r.completed}/${r.meetingCount}`, Kuis: r.quizTotal ? `${r.quizScore}/${r.quizTotal}` : "-", Tugas: `${r.tasksSubmitted}/${r.taskCount}`, "Nilai Tugas": r.tasksMax ? `${r.tasksScore}/${r.tasksMax}` : "-" }));
  downloadCsv(`laporan-${slugify(state.currentReportClass?.title || classId)}.csv`, rows);
}

async function renderStudentReport() {
  const bundles = await loadClassBundle();
  const sections = [];
  for (const { course, meetings, assignments } of bundles) {
    let total = 0, count = 0, completed = 0, duration = 0, taskSubmitted = 0;
    for (const meeting of meetings) {
      const progress = await getValue(`watchProgress/${course.id}/${meeting.id}/${state.user.uid}`);
      if (progress) { total += Number(progress.percent || 0); count++; duration += Number(progress.durationSeconds || 0); if (Number(progress.percent || 0) >= appConfig.completionPercent) completed++; }
    }
    for (const task of assignments) if (await getValue(`submissions/${course.id}/${task.id}/${state.user.uid}`)) taskSubmitted++;
    sections.push({ course, meetings: meetings.length, assignments: assignments.length, average: count ? Math.round(total/count) : 0, completed, duration, taskSubmitted });
  }
  qs("#pageContent").innerHTML = `<div class="page-head"><div><h2>Progres Belajar Saya</h2><p>Ringkasan perjalanan belajar, penyelesaian video, waktu aktif, dan tugas pada setiap kelas.</p></div></div><div class="class-grid">${sections.map((s) => `<article class="class-card"><div class="class-cover ${escapeHtml(s.course.accent || "blue")}"><span class="class-category">${escapeHtml(s.course.category || "Kelas")}</span><h3>${escapeHtml(s.course.title)}</h3></div><div class="class-body"><div class="class-progress"><div class="progress-label"><span>Rata-rata progres</span><span>${s.average}%</span></div><div class="progress-track"><div class="progress-bar" style="width:${s.average}%"></div></div></div><div class="class-meta"><span>${s.completed}/${s.meetings} pertemuan tuntas</span><span>${durationText(s.duration)}</span></div><div class="class-meta"><span>${s.taskSubmitted}/${s.assignments} tugas</span><button class="btn btn-primary btn-sm" data-open-class="${s.course.id}">Buka Kelas</button></div></div></article>`).join("") || emptyState("Belum ada progres", "Mulai menonton pertemuan untuk membangun progres belajar.")}</div>`;
  bindCommonPageActions();
}

async function renderAnnouncements() {
  const announcements = sortByDate(objectToArray(await getValue("announcements", {})), "createdAt")
    .filter((item) => isAdminRole() || !item.target || item.target === "all" || item.target === state.profile.role);
  const canEdit = isAdminRole();
  qs("#pageContent").innerHTML = `
    <div class="page-head"><div><h2>Pengumuman</h2><p>Informasi penting, agenda, dan pembaruan pembelajaran untuk seluruh pengguna LMS.</p></div>${canEdit ? `<div class="page-actions"><button class="btn btn-primary" id="createAnnouncement">${icon("plus")} Buat Pengumuman</button></div>` : ""}</div>
    <div class="stack">${announcements.map((item) => `<article class="card card-pad"><div style="display:flex;align-items:flex-start;gap:14px"><div class="list-icon">${icon("announce")}</div><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:12px"><div><span class="badge ${item.priority === "important" ? "badge-live" : "badge-replay"}">${item.priority === "important" ? "Penting" : "Informasi"}</span><h3 style="margin:11px 0 7px;font:800 .92rem 'Plus Jakarta Sans'">${escapeHtml(item.title)}</h3></div>${canEdit ? `<button class="icon-btn" data-edit-announcement="${item.id}">${icon("edit")}</button>` : ""}</div><p style="margin:0;color:var(--muted);font-size:.7rem;line-height:1.7;white-space:pre-wrap">${escapeHtml(item.body || "")}</p><div style="margin-top:13px;color:var(--soft);font-size:.58rem">${formatDateTime(item.createdAt)} · ${escapeHtml(item.authorName || "Administrator")}</div></div></div></article>`).join("") || `<div class="card">${emptyState("Belum ada pengumuman", "Informasi terbaru akan tampil di halaman ini.")}</div>`}</div>`;
  qs("#createAnnouncement")?.addEventListener("click", () => openAnnouncementForm());
  qsa("[data-edit-announcement]").forEach((el) => el.addEventListener("click", () => openAnnouncementForm(announcements.find((a) => a.id === el.dataset.editAnnouncement))));
}

function openAnnouncementForm(item = null) {
  const body = `<form class="form-grid"><div class="form-group full"><label class="form-label">Judul <span class="required">*</span></label><input id="announcementTitle" class="form-control" value="${escapeHtml(item?.title || "")}"></div><div class="form-group"><label class="form-label">Prioritas</label><select id="announcementPriority" class="form-control"><option value="normal" ${(item?.priority || "normal") === "normal" ? "selected" : ""}>Informasi</option><option value="important" ${item?.priority === "important" ? "selected" : ""}>Penting</option></select></div><div class="form-group"><label class="form-label">Target</label><select id="announcementTarget" class="form-control"><option value="all" ${(item?.target || "all") === "all" ? "selected" : ""}>Semua pengguna</option><option value="student" ${item?.target === "student" ? "selected" : ""}>Peserta</option><option value="teacher" ${item?.target === "teacher" ? "selected" : ""}>Pengajar</option></select></div><div class="form-group full"><label class="form-label">Isi pengumuman</label><textarea id="announcementBody" class="form-control">${escapeHtml(item?.body || "")}</textarea></div></form>`;
  const footer = `${item ? `<button class="btn btn-danger" id="deleteAnnouncement">Hapus</button>` : ""}<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="saveAnnouncement">Simpan Pengumuman</button>`;
  const modal = openModal({ title: item ? "Edit Pengumuman" : "Buat Pengumuman", body, footer });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#saveAnnouncement")?.addEventListener("click", async () => { const title = modal.querySelector("#announcementTitle").value.trim(); const bodyText = modal.querySelector("#announcementBody").value.trim(); if (!title || !bodyText) return toast("Judul dan isi pengumuman wajib diisi.", "warning"); const id = item?.id || uid("info"); await setValue(`announcements/${id}`, { title, body: bodyText, priority: modal.querySelector("#announcementPriority").value, target: modal.querySelector("#announcementTarget").value, authorUid: state.user.uid, authorName: state.profile.name, createdAt: item?.createdAt || Date.now(), updatedAt: Date.now() }); closeModal(); toast("Pengumuman berhasil disimpan.", "success"); renderAnnouncements(); });
  modal.querySelector("#deleteAnnouncement")?.addEventListener("click", async () => { if (confirm("Hapus pengumuman ini?")) { await removeValue(`announcements/${item.id}`); closeModal(); renderAnnouncements(); } });
}

async function renderSettings() {
  const payment = isAdminRole() ? await loadPaymentSettings() : {};
  qs("#pageContent").innerHTML = `
    <div class="page-head"><div><h2>Pengaturan</h2><p>Perbarui profil, keamanan akun, dan pengaturan pembayaran LMS.</p></div></div>
    <div class="grid grid-sidebar">
      <div class="stack">
        <section class="card"><div class="card-head"><div><h3>Profil Pengguna</h3><p>Informasi yang digunakan pada kelas dan administrasi.</p></div></div><div class="card-body"><form id="profileForm" class="form-grid"><div class="form-group full"><label class="form-label">Nama lengkap</label><input id="profileName" class="form-control" value="${escapeHtml(state.profile.name || "")}"></div><div class="form-group"><label class="form-label">Email</label><input class="form-control" value="${escapeHtml(state.profile.email || state.user.email || "")}" disabled></div><div class="form-group"><label class="form-label">Nomor WhatsApp</label><input id="profilePhone" class="form-control" value="${escapeHtml(state.profile.phone || "")}" placeholder="08xxxxxxxxxx"></div><div class="form-group"><label class="form-label">Peran</label><input class="form-control" value="${escapeHtml(roleLabel(state.profile.role))}" disabled></div><div class="form-group full"><button class="btn btn-primary" type="submit">Simpan Profil</button></div></form></div></section>
        ${isAdminRole() ? `<section class="card"><div class="card-head"><div><h3>Pengaturan Pembayaran</h3><p>Rekening transfer dan WhatsApp admin untuk kelas berbayar.</p></div></div><div class="card-body"><form id="paymentSettingsForm" class="form-grid"><div class="form-group"><label class="form-label">Nama bank</label><input id="paymentBankName" class="form-control" value="${escapeHtml(payment.bankName || "")}" placeholder="BSI / BCA / Mandiri"></div><div class="form-group"><label class="form-label">Nomor rekening</label><input id="paymentAccountNumber" class="form-control" value="${escapeHtml(payment.accountNumber || "")}" placeholder="Nomor rekening"></div><div class="form-group"><label class="form-label">Nama pemilik rekening</label><input id="paymentAccountHolder" class="form-control" value="${escapeHtml(payment.accountHolder || "")}" placeholder="Izzuddin Academy"></div><div class="form-group"><label class="form-label">WhatsApp admin</label><input id="paymentAdminWhatsapp" class="form-control" value="${escapeHtml(payment.adminWhatsapp || "")}" placeholder="08xxxxxxxxxx"></div><div class="form-group full"><label class="form-label">Petunjuk pembayaran</label><textarea id="paymentInstructions" class="form-control" placeholder="Contoh: Transfer sesuai nominal, lalu unggah bukti yang jelas.">${escapeHtml(payment.instructions || "")}</textarea></div><div class="form-group full"><button class="btn btn-primary" type="submit">Simpan Pengaturan Pembayaran</button></div></form></div></section>` : ""}
      </div>
      <aside class="stack"><section class="card"><div class="card-head"><div><h3>Keamanan Akun</h3><p>Ganti kata sandi secara berkala.</p></div></div><div class="card-body"><button class="btn btn-secondary btn-block" id="changePassword">${icon("lock")} Ganti Kata Sandi</button></div></section><section class="card card-pad brand-note"><img src="assets/logo-izzuddin.png" alt="Logo Izzuddin Academy"><div><b>Izzuddin Academy</b><span>Learning Management System</span></div></section>${isAdminRole() ? `<section class="card card-pad"><div class="privacy-note"><b>Bukti pembayaran ringan</b><span>Gambar bukti transfer dikompres otomatis dan disimpan privat di database, tanpa layanan penyimpanan tambahan.</span></div></section>` : ""}</aside>
    </div>`;
  qs("#profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = qs("#profileName").value.trim(); const phone = qs("#profilePhone").value.trim();
    if (!name) return toast("Nama tidak boleh kosong.", "warning");
    const now = Date.now();
    await updateValues({ [`users/${state.user.uid}/name`]: name, [`users/${state.user.uid}/phone`]: phone, [`users/${state.user.uid}/updatedAt`]: now, [`publicProfiles/${state.user.uid}/name`]: name, [`publicProfiles/${state.user.uid}/updatedAt`]: now });
    state.profile.name = name; state.profile.phone = phone; renderShell(); route(); toast("Profil berhasil diperbarui.", "success");
  });
  qs("#paymentSettingsForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = { bankName: qs("#paymentBankName").value.trim(), accountNumber: qs("#paymentAccountNumber").value.trim(), accountHolder: qs("#paymentAccountHolder").value.trim(), adminWhatsapp: qs("#paymentAdminWhatsapp").value.trim(), instructions: qs("#paymentInstructions").value.trim(), updatedAt: Date.now(), updatedBy: state.user.uid };
    await setValue("system/settings/payment", payload); state.paymentSettings = payload; toast("Pengaturan pembayaran berhasil disimpan.", "success");
  });
  qs("#changePassword")?.addEventListener("click", openPasswordForm);
}

function openPasswordForm() {
  const body = `<form class="form-grid"><div class="form-group full"><label class="form-label">Kata sandi saat ini</label><input id="currentPassword" class="form-control" type="password"></div><div class="form-group"><label class="form-label">Kata sandi baru</label><input id="newPassword" class="form-control" type="password" minlength="8"></div><div class="form-group"><label class="form-label">Ulangi kata sandi baru</label><input id="confirmPassword" class="form-control" type="password" minlength="8"></div></form>`;
  const modal = openModal({ title: "Ganti Kata Sandi", body, size: "sm", footer: `<button class="btn btn-ghost" data-close-footer>Batal</button><button class="btn btn-primary" id="savePassword">Ganti Kata Sandi</button>` });
  modal.querySelector("[data-close-footer]")?.addEventListener("click", closeModal);
  modal.querySelector("#savePassword")?.addEventListener("click", async () => { const current = modal.querySelector("#currentPassword").value; const next = modal.querySelector("#newPassword").value; const confirmNext = modal.querySelector("#confirmPassword").value; if (next.length < 8 || next !== confirmNext) return toast("Kata sandi baru minimal 8 karakter dan harus sama.", "warning"); try { const credential = EmailAuthProvider.credential(state.user.email, current); await reauthenticateWithCredential(state.user, credential); await updatePassword(state.user, next); closeModal(); toast("Kata sandi berhasil diganti.", "success"); } catch (error) { toast(friendlyError(error), "error"); } });
}

function patchStudentNavigation() {
  if (!isStudentRole()) return;
  const settingsButton = qs('[data-route="settings"]');
  if (settingsButton && !qs('[data-route="reports"]')) {
    const button = document.createElement("button");
    button.className = "nav-item";
    button.dataset.route = "reports";
    button.innerHTML = `<span class="nav-icon">${icon("report")}</span>Progres Saya`;
    button.addEventListener("click", () => navigate("reports"));
    settingsButton.before(button);
  }
}

onAuthStateChanged(auth, async (user) => {
  cleanupMeetingPlayer();
  clearSubscriptions();
  clearGlobalSubscriptions();
  state.user = user || null;
  state.profile = null;
  state.paymentSettings = null;
  if (!user) {
    renderAuth(); hideLoader(); return;
  }
  try {
    const profile = state.registrationInProgress ? await waitForProfile(user.uid) : (await getProfile(user.uid) || await waitForProfile(user.uid, 3));
    if (!profile) {
      await signOut(auth); renderAuth("register"); toast("Profil akun belum berhasil dibuat. Silakan daftar kembali.", "warning"); hideLoader(); return;
    }
    if (profile.status === "inactive") {
      await signOut(auth); renderAuth(); toast("Akun Anda sedang dinonaktifkan.", "error"); hideLoader(); return;
    }
    state.profile = { ...profile, role: normalizeRole(profile.role) };
    renderShell();
    if (!location.hash || location.hash === "#/") location.hash = isStudentRole() ? "#/catalog" : "#/dashboard";
    await route();
    hideLoader();
  } catch (error) {
    console.error(error); renderAuth(); toast(friendlyError(error), "error"); hideLoader();
  }
});

window.addEventListener("hashchange", route);
window.addEventListener("visibilitychange", () => {
  if (document.hidden && state.currentMeeting && state.currentClassId) saveWatchProgress(state.currentClassId, state.currentMeeting.id);
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js?v=4.3.0", { updateViaCache: "none" });
      registration.update().catch(() => {});
    } catch (_) {}
  });
}
