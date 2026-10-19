import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const base = "http://127.0.0.1:4173/";
async function context() {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await ctx.addInitScript(() => {
    let value;
    Object.defineProperty(window, "Peer", {
      configurable: true,
      get() {
        return value;
      },
      set(P) {
        value = class extends P {
          constructor(...args) {
            super(...args);
            this.on("open", () => console.log("PEER open", args[0].slice(-1)));
            this.on("error", (e) =>
              console.log("PEER error", args[0].slice(-1), e.type),
            );
            this.on("connection", (c) => {
              console.log("PEER incoming", args[0].slice(-1));
              c.on("open", () =>
                console.log("PEER channel open", args[0].slice(-1)),
              );
            });
          }
        };
      },
    });
  });
  ctx.on("page", (p) =>
    p.on("console", (m) => {
      if (m.text().startsWith("PEER")) console.log(m.text());
    }),
  );
  return ctx;
}
async function nav(p, label) {
  await p.getByRole("button", { name: label, exact: true }).click();
}
async function wait(fn, ms = 35000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw Error("Timed out waiting for state");
}
async function connect(p) {
  let last = "";
  await wait(async () => {
    const status = await p.locator("#connection-status").innerText();
    if (status !== last) {
      console.log("STATUS", status);
      last = status;
    }
    return /Всё синхронизировано|Вы вдвоём/.test(status);
  }, 65000);
}
async function search(p, title) {
  await nav(p, "Идеи");
  await p.getByLabel("Поиск идей").fill(title);
  await p.getByRole("heading", { name: title, exact: true }).waitFor();
}
async function add(p, title) {
  await nav(p, "Идеи");
  await p.getByRole("button", { name: "Предложить идею", exact: true }).click();
  await p.getByLabel("Название", { exact: true }).fill(title);
  await p.getByRole("button", { name: "Добавить нашу идею" }).click();
  await p.getByRole("heading", { name: title, exact: true }).waitFor();
}
try {
  const ca = await context(),
    cb = await context(),
    a = await ca.newPage(),
    b = await cb.newPage();
  await a.goto(base);
  await a.getByLabel("Как вас зовут?").fill("Аня");
  await a.getByRole("button", { name: "Создать нашу комнату" }).click();
  await a.getByRole("heading", { name: "О вас", exact: true }).waitFor();
  const room = new URL(a.url()).searchParams.get("room"),
    url = base + "?room=" + room;
  await b.goto(url);
  await b.getByLabel("Как вас зовут?").fill("Саша");
  await b.getByRole("button", { name: "Войти в нашу комнату" }).click();
  await connect(b);
  await Promise.all([ca.setOffline(true), cb.setOffline(true)]);
  await add(a, "Офлайн от Ани");
  await add(b, "Офлайн от Саши");
  await Promise.all([ca.setOffline(false), cb.setOffline(false)]);
  await connect(b);
  await search(a, "Офлайн от Саши");
  await search(b, "Офлайн от Ани");
  console.log("PASS independent offline changes converge after both reconnect");
  await search(a, "Офлайн от Ани");
  await a
    .getByRole("button", { name: "Открыть: Офлайн от Ани", exact: true })
    .click();
  await a.getByRole("button", { name: "Удалить идею", exact: true }).click();
  await a.getByRole("button", { name: "Продолжить", exact: true }).click();
  await wait(
    async () =>
      (await b
        .getByRole("heading", { name: "Офлайн от Ани", exact: true })
        .count()) === 0,
  );
  console.log("PASS deletion propagates as tombstone");
  await Promise.all([a.reload(), b.reload()]);
  await connect(b);
  await search(a, "Офлайн от Саши");
  await search(b, "Офлайн от Саши");
  console.log("PASS both refresh with persisted room and data");
  await cb.close();
  const cc = await context(),
    c = await cc.newPage();
  await c.goto(url);
  await c.getByLabel("Как вас зовут?").fill("Восстановление");
  await c.getByRole("button", { name: "Войти в нашу комнату" }).click();
  await connect(c);
  await search(c, "Офлайн от Саши");
  await c.getByLabel("Поиск идей").fill("Офлайн от Ани");
  assert.equal(
    await c
      .getByRole("heading", { name: "Офлайн от Ани", exact: true })
      .count(),
    0,
  );
  console.log("PASS empty device restores snapshot including deletion");
  await nav(c, "Профиль");
  await c.getByRole("button", { name: "О связи и приватности" }).click();
  await c.getByRole("button", { name: "Это я: Саша", exact: true }).click();
  await c.getByRole("button", { name: "Продолжить", exact: true }).click();
  await connect(c);
  await nav(c, "Профиль");
  assert.equal(await c.getByLabel("Имя", { exact: true }).inputValue(), "Саша");
  console.log("PASS original participant identity restored");
  await nav(a, "Собрать");
  await a.getByRole("button", { name: "Удиви нас", exact: false }).click();
  await a.locator(".plan-item").nth(2).waitFor();
  const before = await a.locator(".plan-item h3").first().textContent(),
    from = await a.locator(".drag-handle").first().boundingBox(),
    to = await a.locator(".plan-item").nth(2).boundingBox();
  await a.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await a.mouse.down();
  await a.mouse.move(to.x + to.width - 10, to.y + to.height / 2, { steps: 10 });
  await a.mouse.up();
  await wait(
    async () =>
      (await a.locator(".plan-item h3").nth(2).textContent()) === before,
  );
  console.log("PASS pointer drag reorders plan");
  await nav(a, "Идеи");
  await a.getByLabel("Поиск идей").fill("");
  await a.getByRole("button", { name: "Сегодня хочется — фильтры" }).click();
  await a.getByLabel("Есть время").selectOption("15");
  await a.getByRole("button", { name: "Найти занятие" }).click();
  assert.ok((await a.locator(".idea-card").count()) > 0);
  await a.getByRole("button", { name: "Сбросить фильтры" }).click();
  console.log("PASS filters and reset");
  await nav(a, "Профиль");
  await a.getByRole("button", { name: "Мои задания", exact: true }).click();
  await a.getByLabel("Новое задание").fill("Проверенное задание");
  await a
    .locator("#task-form")
    .getByRole("button", { name: "Добавить", exact: true })
    .click();
  await a.getByRole("heading", { name: "Проверенное задание" }).waitFor();
  await a
    .getByRole("button", { name: "Отметить готовым", exact: true })
    .click();
  await a.getByRole("button", { name: "Выполнено ✓", exact: true }).waitFor();
  console.log("PASS custom task create and complete");
} finally {
  await browser.close();
}
