const CACHE='prumo-pwa-v31-20260918-login-title-motion';
const SHELL=['/','/index.html','/figma-caderno-theme-v1.css','/figma-caderno-theme-v1.js','/figma-caderno-dark-v2.css','/figma-caderno-stability-v3.css','/app.js','/history-status.js','/debts.js','/incomes.js','/financial-entity-panel-runtime-v2.js','/kpi-countup-v1.js','/profile-avatar-performance-v1.js','/pwa.js','/manifest.webmanifest','/pwa-icon.svg','/pwa-icon-maskable.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>null));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(req){
  try{
    const fresh=await fetch(req,{cache:'no-store'});
    if(fresh&&fresh.ok){const cache=await caches.open(CACHE);cache.put(req,fresh.clone()).catch(()=>{})}
    return fresh;
  }catch(_e){
    return (await caches.match(req))||new Response('',{status:504,statusText:'Offline'});
  }
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        const cache=await caches.open(CACHE);
        cache.put('/index.html',fresh.clone()).catch(()=>{});
        return fresh;
      }catch(_e){
        return (await caches.match('/index.html'))||(await caches.match('/'));
      }
    })());
    return;
  }

  const codeAsset=req.destination==='script'||req.destination==='style'||/\.(?:js|css|json|webmanifest)$/i.test(url.pathname);
  if(codeAsset){event.respondWith(networkFirst(req));return}

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(cached)return cached;
    try{
      const fresh=await fetch(req);
      if(fresh&&fresh.ok){const cache=await caches.open(CACHE);cache.put(req,fresh.clone()).catch(()=>{})}
      return fresh;
    }catch(_e){return new Response('',{status:504,statusText:'Offline'})}
  })());
});