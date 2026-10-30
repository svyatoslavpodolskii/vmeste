(() => {
  const sw = navigator.serviceWorker;
  if (!sw) return;
  let registration,
    reloading = false,
    checking = false;
  let hadController = !!sw.controller;
  const panel = document.createElement("aside");
  panel.id = "app-update";
  panel.setAttribute("aria-live", "polite");
  panel.style.cssText =
    "position:fixed;left:12px;right:12px;bottom:calc(92px + env(safe-area-inset-bottom));max-width:450px;margin:auto;padding:16px;background:#fff9f2;color:#47352c;border:1px solid #efcbd0;border-radius:20px;box-shadow:0 8px 30px #47352c30;z-index:1000;font:14px/1.5 system-ui;display:none";
  const message = document.createElement("p");
  message.style.margin = "0 0 10px";
  const apply = document.createElement("button");
  apply.textContent = "Обновить приложение";
  apply.style.cssText =
    "border:0;border-radius:12px;background:#fb6b87;color:#432c2e;padding:12px 16px;font:600 14px system-ui;cursor:pointer";
  const dismiss = document.createElement("button");
  dismiss.textContent = "Позже";
  dismiss.style.cssText =
    "border:0;background:transparent;padding:12px;font:14px system-ui;cursor:pointer;color:inherit";
  dismiss.onclick = () => {
    panel.style.display = "none";
  };
  panel.append(message, apply, dismiss);
  document.body.append(panel);
  function show(text, ready = false) {
    message.textContent = text;
    panel.style.display = "block";
    apply.hidden = !ready;
    apply.disabled = false;
    dismiss.hidden = false;
    dismiss.textContent = ready ? "Позже" : "Закрыть";
  }
  function available() {
    if (hadController && registration?.waiting)
      show(
        "Доступна новая версия. Комната, идеи, сердечки и планы сохранятся. Завершите ввод несохранённого текста перед обновлением.",
        true,
      );
  }
  function watch(worker) {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") available();
    });
  }
  // Never clear IndexedDB, localStorage or user data when updating the app shell.
  sw.addEventListener("controllerchange", () => {
    if (hadController && !reloading) {
      reloading = true;
      location.reload();
    }
    hadController = true;
  });
  const ready = sw
    .register("./service-worker.js", { updateViaCache: "none" })
    .then((reg) => {
      registration = reg;
      watch(reg.installing);
      reg.addEventListener("updatefound", () => watch(reg.installing));
      available();
      return reg;
    });
  ready.catch(() => {});
  async function check() {
    if (checking) return;
    checking = true;
    show("Проверяем обновление… Ваши данные остаются на устройстве.");
    try {
      if (!navigator.onLine)
        throw Error(
          "Для загрузки обновления нужен интернет. Офлайн можно продолжать пользоваться приложением.",
        );
      const reg = await ready;
      await reg.update();
      if (reg.installing)
        await new Promise((resolve, reject) => {
          const worker = reg.installing;
          const timer = setTimeout(
            () =>
              reject(
                Error("Загрузка ещё идёт. Повторите проверку чуть позже."),
              ),
            30000,
          );
          const done = () => {
            if (
              ["installed", "activated", "redundant"].includes(worker.state)
            ) {
              clearTimeout(timer);
              worker.removeEventListener("statechange", done);
              if (worker.state === "redundant")
                reject(
                  Error(
                    "Не удалось загрузить обновление. Текущая версия и ваши данные сохранены.",
                  ),
                );
              else resolve();
            }
          };
          worker.addEventListener("statechange", done);
          done();
        });
      if (reg.waiting) available();
      else show("У вас актуальная версия приложения. Все данные на месте.");
    } catch (error) {
      show(
        error.message || "Не удалось проверить обновление. Попробуйте позже.",
      );
    } finally {
      checking = false;
    }
  }
  function canActivate(worker) {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const finish = (value) => {
        clearTimeout(timer);
        channel.port1.close();
        channel.port2.close();
        resolve(value);
      };
      const timer = setTimeout(() => finish(false), 1500);
      channel.port1.onmessage = (event) => finish(!!event.data?.canActivate);
      worker.postMessage({ type: "UPDATE_CAPABILITIES" }, [channel.port2]);
    });
  }
  apply.onclick = async () => {
    if (!registration?.waiting) return check();
    if (!(await canActivate(registration.waiting))) {
      await check();
      if (!registration.waiting || !(await canActivate(registration.waiting))) {
        show(
          "Новая версия ещё загружается. Подключитесь к интернету и повторите проверку обновления чуть позже.",
        );
        return;
      }
    }
    apply.disabled = true;
    dismiss.hidden = true;
    message.textContent = "Сохраняем текущий план и обновляем приложение…";
    try {
      if (window.vmesteBeforeUpdate) await window.vmesteBeforeUpdate();
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      show(
        "Не удалось сохранить текущий план. Обновление отложено — попробуйте ещё раз.",
        true,
      );
    }
  };
  window.vmesteUpdates = { check };
  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="update-app"]')) check();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible")
      ready.then((reg) => reg.update()).catch(() => {});
  });
})();
