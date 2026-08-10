import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB2HRzcfPlQtrdGMgcP3iJw3cCB9gCkSjA',
  authDomain: 'cahayaacademy-f8787.firebaseapp.com',
  databaseURL: 'https://cahayaacademy-f8787-default-rtdb.firebaseio.com',
  projectId: 'cahayaacademy-f8787',
  storageBucket: 'cahayaacademy-f8787.firebasestorage.app',
  messagingSenderId: '893326323139',
  appId: '1:893326323139:web:33845efb560972e691a176'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

export { app, auth, db, storage, firebaseConfig };
