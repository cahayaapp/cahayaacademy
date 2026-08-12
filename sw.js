const CACHE='belajarislam-v6.4.5-shell';
const ASSETS=[
  './','./index.html','./assets/css/styles.css?v=645','./assets/img/logo-icon.svg?v=645','./assets/img/favicon.ico?v=645',
  './assets/img/icon-32.png?v=645','./assets/img/icon-64.png?v=645','./assets/img/icon-180.png?v=645','./assets/img/icon-192.png?v=645',
  './assets/img/icon-maskable-192.png?v=645','./assets/img/icon-512.png?v=645','./assets/img/icon-maskable-512.png?v=645','./manifest.webmanifest?v=645'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS).catch(()=>{})));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res;}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));return;
  }
  event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return res;}).catch(()=>caches.match(event.request)));
});
