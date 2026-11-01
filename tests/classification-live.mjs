import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    p = await context.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:4173");
  await p.getByLabel("Как вас зовут?").fill("Тест темы");
  await p.locator("#onboard-form button").click();
  await p.locator("#profile-form").waitFor();
  await p.locator(".bottom-nav [data-action=ideas]").click();
  await p.locator("[data-action=new-idea]").first().click();
  await p.locator("#idea-form [name=title]").fill("Рисуем смешные облака");
  await p.locator("#idea-form [name=category]").selectOption("Творчество");
  await p.locator("#idea-form [name=topic]").selectOption("Рисование");
  await p.locator("#idea-form button[type=submit]").click();
  await p
    .locator(".catalogue-paged .idea-card")
    .filter({ hasText: "Рисуем смешные облака" })
    .waitFor();
  await p.locator("[data-catalogue-filter=category]").selectOption("Рисование");
  assert.ok(
    (await p
      .locator(".catalogue-paged .idea-card")
      .filter({ hasText: "Рисуем смешные облака" })
      .count()) === 1,
  );
  await p
    .locator(".catalogue-paged .idea-card")
    .filter({ hasText: "Рисуем смешные облака" })
    .locator(".title-button")
    .click();
  assert.ok(
    (await p.locator("#sheet-content .eyebrow").textContent()).includes(
      "Творчество · Рисование",
    ),
  );
  await p.locator("[data-action=edit-idea]").click();
  assert.equal(
    await p.locator("#idea-form [name=topic]").inputValue(),
    "Рисование",
  );
  await p.locator("#idea-form [name=topic]").selectOption("");
  await p.locator("#idea-form button[type=submit]").click();
  await p
    .locator(".catalogue-paged .idea-card")
    .filter({ hasText: "Рисуем смешные облака" })
    .locator(".title-button")
    .click();
  await p.locator("[data-action=edit-idea]").click();
  assert.equal(await p.locator("#idea-form [name=topic]").inputValue(), "");
  await p.locator(".close-sheet").click();
  const duplicates = await p
    .locator("[data-catalogue-filter=category]")
    .evaluate((el) => {
      const values = [...el.options].map((o) => o.value);
      return values.length - new Set(values).size;
    });
  assert.equal(duplicates, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS create, filter by topic, reopen, remove optional topic; category retained and grouped filters contain no duplicates",
  );
} finally {
  await browser.close();
}
