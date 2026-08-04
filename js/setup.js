import {
  auth,
  db,
  ref,
  get,
  set,
  update,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "./firebase.js";
import { qs } from "./utils.js";

function showMessage(message, type = "info") {
  const el = qs("#setupMessage");
  el.className = `notice notice-${type}`;
  el.textContent = message;
}

async function claimOwner(user, name) {
  const ownerRef = ref(db, "system/ownerUid");
  const ownerSnap = await get(ownerRef);
  if (ownerSnap.exists() && ownerSnap.val() !== user.uid) {
    throw new Error("Administrator pertama sudah pernah diaktifkan. Silakan masuk melalui halaman utama.");
  }

  if (!ownerSnap.exists()) await set(ownerRef, user.uid);

  const now = Date.now();
  const updates = {};
  updates[`users/${user.uid}`] = {
    name,
    email: user.email || "",
    role: "admin",
    status: "active",
    createdAt: now,
    updatedAt: now
  };
  updates[`publicProfiles/${user.uid}`] = {
    name,
    role: "admin",
    avatar: "",
    updatedAt: now
  };
  updates["system/initialized"] = true;
  updates["system/initializedAt"] = now;
  updates["system/settings"] = {
    appName: "CAHAYA ACADEMY",
    institution: "Pesantren Cahaya Fajrul Islam",
    academicYear: "2026/2027",
    timezone: "Asia/Jakarta",
    registrationOpen: false,
    updatedAt: now
  };
  await update(ref(db), updates);
}

qs("#setupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = qs("#setupButton");
  const name = qs("#setupName").value.trim();
  const email = qs("#setupEmail").value.trim().toLowerCase();
  const password = qs("#setupPassword").value;

  if (!name || !email || password.length < 8) {
    showMessage("Lengkapi nama, email, dan kata sandi minimal 8 karakter.", "danger");
    return;
  }

  button.disabled = true;
  button.textContent = "Mengaktifkan administrator...";

  try {
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        credential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        throw error;
      }
    }

    await claimOwner(credential.user, name);
    showMessage("Administrator berhasil diaktifkan. Anda akan diarahkan ke LMS.", "success");
    setTimeout(() => { window.location.href = "./index.html"; }, 1200);
  } catch (error) {
    console.error(error);
    const friendly = {
      "auth/operation-not-allowed": "Login Email/Password belum diaktifkan di Firebase Authentication.",
      "auth/invalid-email": "Format email tidak valid.",
      "auth/weak-password": "Kata sandi terlalu lemah. Gunakan minimal 8 karakter.",
      "auth/invalid-credential": "Email sudah terdaftar, tetapi kata sandinya tidak cocok.",
      "PERMISSION_DENIED": "Database Rules belum dipasang atau tidak mengizinkan aktivasi administrator."
    };
    showMessage(friendly[error.code] || friendly[error.message] || error.message || "Aktivasi gagal.", "danger");
    try { await signOut(auth); } catch (_) {}
  } finally {
    button.disabled = false;
    button.textContent = "Aktifkan Administrator";
  }
});
