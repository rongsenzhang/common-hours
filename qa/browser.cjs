// Run against a served checkout or the public Pages URL. Use a fresh profile for each viewport.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = (process.argv[2] || "http://127.0.0.1:8754/").replace(/\/?$/, "/");
const screenDir = process.env.SCREENSHOT_DIR;
const options = process.env.CHROME_EXECUTABLE
  ? { executablePath: process.env.CHROME_EXECUTABLE }
  : {};
async function check(browser, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: width < 600,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (res) => {
    if (res.url().startsWith(base) && res.status() >= 400)
      errors.push(res.status() + " " + res.url());
  });
  await page.goto(base);
  await page.getByRole("heading", { name: "Explore opportunities" }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  const noOverflow = async () =>
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "horizontal overflow",
    );
  await noOverflow();
  if (screenDir) {
    fs.mkdirSync(screenDir, { recursive: true });
    await page.screenshot({
      path: path.join(screenDir, "discover-" + width + ".png"),
    });
  }
  await page
    .getByRole("button", { name: "Save Community garden buddy", exact: true })
    .click();
  await page.getByRole("button", { name: /^Saved/ }).click();
  assert.equal(await page.locator(".role-card").count(), 1);
  await page
    .getByRole("button", { name: "Community garden buddy", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.getByText("View source records").click();
  assert(
    await page
      .getByRole("dialog")
      .getByText("sessions.csv:S01")
      .first()
      .isVisible(),
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: /^Saved/ }).click();
  assert.equal(await page.locator(".role-card").count(), 1);
  await page
    .getByRole("link", { name: "Coordinator desk", exact: true })
    .click();
  await page.getByRole("heading", { name: "Review queue" }).waitFor();
  await page.locator('[data-demo="garden"]').click();
  await page
    .getByRole("button", { name: "Community garden buddy", exact: true })
    .waitFor();
  assert.equal(
    await page.locator("[data-section=review]").getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByRole("link", { name: "Coordinator desk", exact: true })
    .click();
  await noOverflow();
  const confirm = page.locator('[data-resolve="garden-buddy:stepFree"]');
  await confirm.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.activeElement?.dataset.undo === "garden-buddy:stepFree",
  );
  await page.locator('[data-demo="garden"]').click();
  assert.equal(
    await page.locator("[data-section=matches]").getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByRole("button", { name: "Community garden buddy", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Coordinator desk", exact: true })
    .click();
  await page
    .locator('details[data-item="garden-buddy:stepFree"] summary')
    .click();
  await page.locator('[data-undo="garden-buddy:stepFree"]').click();
  await page.locator('[data-demo="garden"]').click();
  await page.locator("#pref-form").waitFor({ state: "attached" });
  if (!(await page.locator("input[name=query]").isVisible()))
    await page.locator("[data-filter-toggle]").click();
  await page.locator("input[name=query]").fill("zyxqnoresult");
  await page.getByRole("button", { name: "Find roles" }).click();
  await page.getByRole("heading", { name: "No matching roles" }).waitFor();
  await page.getByRole("link", { name: "Evidence", exact: true }).click();
  await page.getByRole("heading", { name: "Search evidence" }).waitFor();
  await page.locator(".research-cases > summary").click();
  const example = page
    .locator(".research-case")
    .filter({ hasText: "walk dogs" });
  await example.locator("summary").click();
  assert((await example.innerText()).includes("Riverside litter walk"));
  await noOverflow();
  if (await page.locator("[data-semantic-case]").isVisible()) {
    await page.locator("[data-semantic-case]").selectOption("B07");
    assert.equal(
      await page.locator("[data-semantic-case]").inputValue(),
      "B07",
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    width +
      "px · search, saved role, source details, host review, undo, persistence, empty query result, benchmark and page width passed",
  );
  await context.close();
}
(async () => {
  const browser = await chromium.launch(options);
  try {
    for (const [w, h] of [
      [1360, 930],
      [390, 844],
      [320, 700],
    ])
      await check(browser, w, h);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
