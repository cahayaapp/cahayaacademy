const CACHE='belajarislam-v5.2.1-shell';
const ASSETS=['./','./index.html','./assets/css/styles.css?v=521','./assets/img/logo-icon.png?v=521','./assets/img/favicon.ico?v=521','./assets/img/icon-32.png?v=521','./assets/img/icon-64.png?v=521','./assets/img/icon-180.png?v=521','./assets/img/icon-192.png?v=521','./assets/img/icon-maskable-192.png?v=521','./assets/img/icon-512.png?v=521','./assets/img/icon-maskable-512.png?v=521','./manifest.webmanifest?v=521'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){ const clone=response.clone(); caches.open(CACHE).then(cache=>cache.put(event.request,clone)); }
    return response;
  }).catch(()=>caches.match(event.request)));
});
