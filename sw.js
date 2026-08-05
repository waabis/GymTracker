/* Rack service worker — makes the app open with no signal.
 *
 * BUMP `CACHE` ON EVERY DEPLOY. Changing this file is what tells the browser
 * there is a new version to install; if index.html changes but this file does
 * not, phones keep serving the old cached app forever.
 *
 * All paths are relative on purpose: the app lives at /GymTracker/ on GitHub
 * Pages but at / when served locally, and relative paths work in both.
 */
const CACHE='rack-v7';

/* Must cache for the app to open at all. */
const CORE=['./','./index.html','./manifest.json'];

/* Nice to have offline; a miss here is survivable (the font falls back to the
 * system one, and index.html already guards against Supabase being absent). */
const EXTRAS=[
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;800&display=swap'
];

/* Supabase API calls must always hit the network. Serving a cached session or
 * stale rows would be worse than failing honestly. */
const isApi=u=>u.hostname.endsWith('.supabase.co');
const keep=r=>r&&(r.ok||r.type==='opaque');

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    await c.addAll(CORE);
    /* allSettled, not addAll: one unreachable CDN must not fail the install
       and leave the app with no offline copy at all. */
    await Promise.allSettled(EXTRAS.map(u=>c.add(u)));
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

/* The page asks for the update only when the user taps for it, so an update
   never interrupts a workout. */
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting();});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(isApi(url))return;

  /* Opening the app: serve the cached page immediately so a dead signal still
     gets you in, and refresh the copy in the background for next time. */
  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const cached=await c.match('./index.html');
      const net=fetch(req).then(r=>{if(keep(r))c.put('./index.html',r.clone());return r;})
        .catch(()=>null);
      return cached||await net||new Response(
        '<h1>Offline</h1><p>Rack has not been saved for offline use yet. Open it once with a connection.</p>',
        {status:503,headers:{'Content-Type':'text/html'}});
    })());
    return;
  }

  /* Everything else (fonts, the Supabase library): cache first so it is
     instant and works offline, refreshed quietly in the background. */
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const cached=await c.match(req);
    const net=fetch(req).then(r=>{if(keep(r))c.put(req,r.clone());return r;})
      .catch(()=>null);
    return cached||await net||Response.error();
  })());
});
