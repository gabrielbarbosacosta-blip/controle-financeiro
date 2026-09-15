const CACHE='controle-financeiro-pwa-v1';
const SHELL=['/','/index.html','/app.css','/app.js','/history-status.js','/pwa.js','/manifest.webmanifest','/pwa-icon.svg','/pwa-icon-maskable.svg'];

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

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        const cache=await caches.open(CACHE);
        cache.put('/index.html',fresh.clone()).catch(()=>{});
        return fresh;
      }catch(_e){
        return (await caches.match('/index.html'))||(await caches.match('/'));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    const network=fetch(req).then(async response=>{
      if(response&&response.ok){
        const cache=await caches.open(CACHE);
        cache.put(req,response.clone()).catch(()=>{});
      }
      return response;
    }).catch(()=>null);
    return cached||await network||new Response('',{status:504,statusText:'Offline'});
  })());
});
