import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
  limitToLast
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

setPersistence(auth, browserLocalPersistence).catch(console.error);

export {
  initializeApp,
  deleteApp,
  getAuth,
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  remove,
  onValue,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
  limitToLast,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  firebaseConfig
};
