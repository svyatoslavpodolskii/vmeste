// Cache version follows package.json. Cache is scoped to this installation path.
const CACHE = "vmeste-4.7.0-" + self.registration.scope;
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/update.js?v=4.7.0",
  "./css/beacon.css",
  "./css/circuit.css",
  "./css/immersive.css",
  "./css/instruments.css",
  "./css/styles.css",
  "./css/worlds.css",
  "./js/activity.js",
  "./js/app.js",
  "./js/atlas.js",
  "./js/auth.js",
  "./js/beacon-help.js",
  "./js/beacon-ui.js",
  "./js/beacon.js",
  "./js/boot.js",
  "./js/composition.js",
  "./js/coop-circuit.js",
  "./js/db.js",
  "./js/deck-session.js",
  "./js/expedition.js",
  "./js/frequency.js",
  "./js/game-pools.js",
  "./js/game-protocol.js",
  "./js/idea-classification.js",
  "./js/moments.js",
  "./js/mood.js",
  "./js/notifications.js",
  "./js/party.js",
  "./js/peer.js",
  "./js/plans.js",
  "./js/poetry.js",
  "./js/preferences.js",
  "./js/rooms.js",
  "./js/screens.js",
  "./js/sound-controls.js",
  "./js/sound.js",
  "./js/store.js",
  "./js/sync.js",
  "./js/turn-games.js",
  "./js/ui.js",
  "./js/update.js",
  "./js/worlds.js",
  "./data/games.js",
  "./data/ideas.js",
  "./data/more-ideas.js",
  "./data/presentation.js",
  "./data/topics.js",
  "./assets/art.svg",
  "./assets/baking.svg",
  "./assets/cafe.svg",
  "./assets/calm.svg",
  "./assets/camera.svg",
  "./assets/candle.svg",
  "./assets/cards.svg",
  "./assets/dance.svg",
  "./assets/date.svg",
  "./assets/food.svg",
  "./assets/games.svg",
  "./assets/garden.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon.svg",
  "./assets/magic.svg",
  "./assets/movie.svg",
  "./assets/music.svg",
  "./assets/nunito-cyrillic.woff2",
  "./assets/nunito-latin.woff2",
  "./assets/painting.svg",
  "./assets/paper.svg",
  "./assets/photo.svg",
  "./assets/plant.svg",
  "./assets/puzzle.svg",
  "./assets/quest.svg",
  "./assets/questions.svg",
  "./assets/space.svg",
  "./assets/sport.svg",
  "./assets/stars.svg",
  "./assets/story.svg",
  "./assets/tea.svg",
  "./assets/telescope.svg",
  "./assets/together.svg",
  "./assets/walk.svg",
  "./assets/wind.svg",
  "./vendor/peerjs.min.js",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(
          ASSETS.map((url) => new Request(url, { cache: "reload" })),
        ),
      ),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "UPDATE_CAPABILITIES")
    event.ports[0]?.postMessage({ canActivate: true });
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
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
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const data = event.notification.data || {},
        tab = ["matches", "games"].includes(data.tab) ? data.tab : "matches";
      const url = new URL("./", self.registration.scope);
      if (typeof data.room === "string")
        url.searchParams.set("room", data.room);
      url.hash = tab;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = windows.find((c) => {
        const u = new URL(c.url);
        return (
          u.origin === url.origin &&
          u.pathname.startsWith(new URL(self.registration.scope).pathname) &&
          u.searchParams.get("room") === data.room
        );
      });
      if (client) {
        await client.focus();
        client.postMessage({ type: "OPEN_ROOM_TAB", room: data.room, tab });
      } else await self.clients.openWindow(url.href);
    })(),
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
