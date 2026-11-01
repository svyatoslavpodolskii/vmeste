import { copyFile, writeFile, readdir, readFile } from "node:fs/promises";
for (const subset of ["latin", "cyrillic"])
  await copyFile(
    `node_modules/@fontsource-variable/nunito/files/nunito-${subset}-wght-normal.woff2`,
    `assets/nunito-${subset}.woff2`,
  );
await copyFile(
  "node_modules/@fontsource-variable/nunito/LICENSE",
  "assets/NUNITO-LICENSE",
);
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const files = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/update.js?v=" + version,
  ...(await Promise.all(
    ["css", "js", "data", "assets", "vendor"].map(async (dir) =>
      (await readdir(dir))
        .filter((f) => !f.includes("LICENSE"))
        .map((f) => "./" + dir + "/" + f),
    ),
  ).then((a) => a.flat())),
];
await writeFile(
  "service-worker.js",
  `// Cache version follows package.json. Cache is scoped to this installation path.
const CACHE='vmeste-${version}-'+self.registration.scope;
const ASSETS=${JSON.stringify(files, null, 2)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))));});
self.addEventListener('message',event=>{if(event.data?.type==='UPDATE_CAPABILITIES')event.ports[0]?.postMessage({canActivate:true});if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('vmeste-')&&k.endsWith(self.registration.scope)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const data=event.notification.data||{},tab=['matches','games'].includes(data.tab)?data.tab:'matches';const url=new URL('./',self.registration.scope);if(typeof data.room==='string')url.searchParams.set('room',data.room);url.hash=tab;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=windows.find(c=>{const u=new URL(c.url);return u.origin===url.origin&&u.pathname.startsWith(new URL(self.registration.scope).pathname)&&u.searchParams.get('room')===data.room;});if(client){await client.focus();client.postMessage({type:'OPEN_ROOM_TAB',room:data.room,tab});}else await self.clients.openWindow(url.href);})());});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(c=>c.match(new URL('./index.html',self.registration.scope)))));return;}event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(event.request);return cached||fetch(event.request);}));});
`,
);
