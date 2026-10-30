import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const errors = [];
async function fresh() {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  c.on("page", (p) =>
    p.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("ERROR", e.message);
    }),
  );
  return { c, p: await c.newPage() };
}
async function host(name, capacity) {
  const x = await fresh();
  await x.p.goto("http://127.0.0.1:4173");
  await x.p.getByLabel("Как вас зовут?").fill(name);
  await x.p.locator('select[name="capacity"]').selectOption(String(capacity));
  await x.p.locator("#onboard-form button").click();
  await x.p.locator("#profile-form").waitFor();
  return x;
}
async function join(url, name, mode = "player") {
  const x = await fresh();
  await x.p.goto(url);
  await x.p.getByLabel("Как вас зовут?").fill(name);
  await x.p.locator('select[name="entryMode"]').selectOption(mode);
  await x.p.locator("#onboard-form button").click();
  return x;
}
async function approve(a, target, guest) {
  await a.locator('[data-action="approve-pair"]').waitFor({ timeout: 40000 });
  if (target)
    await a.locator("#admission-target").selectOption({ label: target });
  await a.locator('[data-action="approve-pair"]').click();
  await guest.locator('[data-action="confirm-pair-code"]').click();
}
try {
  const group = await host("Хозяин компании", 10),
    a = group.p,
    url = a.url(),
    members = [];
  for (let i = 1; i <= 9; i++) {
    const x = await join(url, "Друг " + i);
    await approve(a, null, x.p);
    await x.p.locator("#profile-form").waitFor({ timeout: 20000 });
    members.push(x);
    console.log("JOIN", i + 1);
  }
  await a.waitForFunction(
    () => document.querySelectorAll(".participants-grid>div").length === 10,
  );
  assert.ok(await a.locator(".friends-theme").count());
  const extra = await join(url, "Одиннадцатый");
  await extra.p.getByText(/Все места заняты/).waitFor({ timeout: 30000 });
  console.log("PASS 10 connected members and eleventh blocked");
  const last = members[8].p;
  await last.locator('.bottom-nav [data-action="ideas"]').click();
  await last.locator('[data-action="new-idea"]').first().click();
  await last
    .locator('#idea-form input[name="title"]')
    .fill("Десятый делится идеей");
  await last.locator('#idea-form button[type="submit"]').click();
  await last
    .getByRole("heading", { name: "Десятый делится идеей", exact: true })
    .waitFor();
  await members[0].p.locator('.bottom-nav [data-action="ideas"]').click();
  await members[0].p
    .getByRole("heading", { name: "Десятый делится идеей", exact: true })
    .waitFor({ timeout: 20000 });
  console.log("PASS client-to-client sync through hub");
  const firstRoom = new URL(a.url()).searchParams.get("room");
  await a.locator('[data-action="rooms"]').click();
  await a.locator('[data-action="new-room"]').click();
  await a.getByLabel("Как вас зовут?").fill("Свят");
  await a.locator("#onboard-form button").click();
  await a.locator("#profile-form").waitFor();
  await a.locator('[data-action="rooms"]').click();
  assert.equal(await a.locator(".room-choice").count(), 2);
  await a
    .locator(`[data-action="switch-room"][data-id="${firstRoom}"]`)
    .click();
  await a.locator(".participants-grid>div").nth(9).waitFor();
  console.log("PASS multiple rooms stay isolated and switch without data loss");
  await Promise.all([
    group.c.close(),
    extra.c.close(),
    ...members.map((x) => x.c.close()),
  ]);
  const pair = await host("Свят", 2),
    pa = pair.p,
    pu = pa.url();
  const guest = await join(pu, "Саида");
  await approve(pa, null, guest.p);
  await guest.p.locator("#profile-form").waitFor();
  await guest.p.locator('.bottom-nav [data-action="ideas"]').click();
  await guest.p.locator('.idea-card [data-action="like"]').first().click();
  const liked = await guest.p
    .locator(".idea-card")
    .first()
    .getAttribute("data-idea");
  await guest.p
    .locator(`.idea-card[data-idea="${liked}"] [data-action="add-plan"]`)
    .click();
  await guest.p.locator('.bottom-nav [data-action="build"]').click();
  await guest.p.locator(".plan-item").waitFor();
  const role = await guest.p.evaluate(
    () =>
      localStorage.getItem(
        "vmeste-user:member:" + new URL(location).searchParams.get("room"),
      ) || localStorage.getItem("vmeste-user"),
  );
  const mirror = await join(pu, "Мой компьютер", "mirror");
  await approve(pa, "Саида", mirror.p);
  await mirror.p.locator("#profile-form").waitFor();
  await mirror.p.waitForFunction(
    () =>
      document.querySelector('#profile-form input[name="name"]')?.value ===
      "Саида",
  );
  await mirror.p.locator('.bottom-nav [data-action="build"]').click();
  await mirror.p.locator(".plan-item").waitFor({ timeout: 20000 });
  console.log("PASS extra device keeps the same role and restores its draft");
  await guest.c.close();
  await mirror.c.close();
  await pa.waitForFunction(
    () =>
      /Ждём участников/.test(
        document.querySelector("#connection-status")?.textContent || "",
      ),
    null,
    { timeout: 35000 },
  );
  const restored = await join(pu, "Саида вернулась");
  await approve(pa, null, restored.p);
  await restored.p.locator("#profile-form").waitFor();
  assert.equal(
    await restored.p.locator('#profile-form input[name="name"]').inputValue(),
    "Саида",
  );
  await restored.p.locator('.bottom-nav [data-action="ideas"]').click();
  await restored.p
    .locator(`.idea-card[data-idea="${liked}"] [aria-pressed="true"]`)
    .waitFor();
  assert.equal(
    await restored.p.evaluate(
      (id) =>
        localStorage.getItem(
          "vmeste-user:member:" + new URL(location).searchParams.get("room"),
        ),
      role,
    ),
    role,
  );
  console.log(
    "PASS recovery receives original name, identity and likes from partner",
  );
  await pa.locator('[data-action="pair-names"]').first().click();
  await pa.locator('#pair-names-form input[name="me"]').fill("Свят");
  await pa.locator('#pair-names-form input[name="partner"]').fill("Саида");
  await pa.locator("#pair-names-form button").click();
  assert.deepEqual(errors, []);
  console.log("PASS all room lifecycle checks");
} finally {
  await browser.close();
}
