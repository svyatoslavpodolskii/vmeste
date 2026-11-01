// Independent of the module graph: even a broken cached import must offer a way back.
(() => {
  const app = document.getElementById("app");
  const loading = () => !!app.querySelector(".loading");
  let shown = false;
  function recover() {
    if (shown || !loading()) return;
    shown = true;
    app.innerHTML =
      '<main class="onboarding"><h1>Место почти готово</h1><p>Запуск задержался. Можно повторить или загрузить свежую версию. Комнаты, идеи и сердечки останутся на устройстве.</p><button class="btn primary" id="boot-retry">Попробовать снова</button><button class="btn soft" id="boot-refresh">Восстановить приложение</button><p id="boot-status" role="status"></p></main>';
    document.getElementById("boot-retry").onclick = () => location.reload();
    document.getElementById("boot-refresh").onclick = async (event) => {
      event.target.disabled = true;
      const status = document.getElementById("boot-status");
      status.textContent = "Загружаем приложение. Личные данные не трогаем…";
      try {
        // Verify connectivity before touching the offline shell. Only our scoped
        // application caches are removed; never IndexedDB, storage or room keys.
        const response = await fetch("./index.html?recover=" + Date.now(), {
          cache: "reload",
        });
        if (!response.ok)
          throw Error(
            "Нет соединения с сервером. Повторите, когда появится интернет.",
          );
        const scope = new URL("./", location.href).href;
        const registrations =
          (await navigator.serviceWorker?.getRegistrations()) || [];
        for (const registration of registrations)
          if (registration.scope === scope) await registration.unregister();
        if (window.caches)
          for (const key of await caches.keys())
            if (key.startsWith("vmeste-") && key.endsWith(scope))
              await caches.delete(key);
        location.reload();
      } catch (error) {
        status.textContent =
          error.message ||
          "Не получилось загрузить приложение. Попробуйте ещё раз.";
        event.target.disabled = false;
      }
    };
  }
  setTimeout(recover, 15000);
  window.addEventListener("error", () => setTimeout(recover, 0), true);
  window.addEventListener("unhandledrejection", () => setTimeout(recover, 0));
})();
