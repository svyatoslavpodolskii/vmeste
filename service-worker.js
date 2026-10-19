// Increment CACHE when releasing updates. Cache is scoped to this installation path.
const CACHE = "vmeste-v1-" + self.registration.scope;
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/db.js",
  "./js/peer.js",
  "./js/plans.js",
  "./js/screens.js",
  "./js/store.js",
  "./js/sync.js",
  "./js/ui.js",
  "./data/games.js",
  "./data/ideas.js",
  "./assets/art.svg",
  "./assets/calm.svg",
  "./assets/date.svg",
  "./assets/food.svg",
  "./assets/games.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon.svg",
  "./assets/movie.svg",
  "./assets/music.svg",
  "./assets/nunito-cyrillic.woff2",
  "./assets/nunito-latin.woff2",
  "./assets/quest.svg",
  "./assets/questions.svg",
  "./assets/together.svg",
  "./assets/walk.svg",
  "./vendor/peerjs.min.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k.startsWith("vmeste-") &&
                k.endsWith(self.registration.scope) &&
                k !== CACHE,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches
          .open(CACHE)
          .then((c) =>
            c.match(new URL("./index.html", self.registration.scope)),
          ),
      ),
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      return cached || fetch(event.request);
    }),
  );
});
