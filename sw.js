const CACHE='belajarislam-v5.2.0-shell';
const ASSETS=['./','./index.html','./assets/css/styles.css','./assets/img/logo-icon.png','./assets/img/favicon.ico','./assets/img/icon-32.png','./assets/img/icon-64.png','./assets/img/icon-180.png','./assets/img/icon-192.png','./assets/img/icon-maskable-192.png','./assets/img/icon-512.png','./assets/img/icon-maskable-512.png','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});
