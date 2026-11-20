// Run against the packaged volunteer site, locally or on GitHub Pages.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const base = (process.argv[2] || "http://127.0.0.1:8754/").replace(/\/?$/, "/");
const options = process.env.CHROME_EXECUTABLE
  ? { executablePath: process.env.CHROME_EXECUTABLE }
  : {};

async function verifyViewport(browser, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: width < 600,
  });
  try {
    const page = await context.newPage();
    const errors = [],
      requests = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("request", (req) => requests.push(req.url()));
    await page.goto(base);
    await page
      .getByRole("heading", { name: "Explore opportunities" })
      .waitFor();
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(await overflow(), false);
    await page
      .getByRole("button", { name: "Save Community garden buddy", exact: true })
      .click();
    await page.getByRole("button", { name: /^Saved/ }).click();
    assert.equal(await page.locator(".role-card").count(), 1);
    await page.reload();
    await page.getByRole("button", { name: /^Saved/ }).click();
    await page.locator('[data-detail="garden-buddy"]').click();
    await page.getByRole("dialog").waitFor();
    assert.doesNotMatch(
      await page.locator("dialog").innerText(),
      /\.csv:|embedding|title includes/i,
    );
    await page.keyboard.press("Escape");

    if (!(await page.locator("[name=query]").isVisible()))
      await page.locator("[data-filter-toggle]").click();
    async function search(query) {
      await page.locator("[name=query]").fill(query);
      await page
        .getByRole("button", { name: "Find roles", exact: true })
        .click();
    }
    await search("walk dogs");
    assert.deepEqual(
      (
        await page
          .locator(".role-card [data-detail]")
          .evaluateAll((items) => items.map((b) => b.dataset.detail))
      ).sort(),
      ["neighbourhood-dog-walker", "shelter-dog-walker"],
    );
    await search("litter walk");
    await page.locator('[data-detail="river-walk"]').click();
    assert.match(
      await page.locator("dialog").innerText(),
      /steps and uneven ground/i,
    );
    await page.keyboard.press("Escape");
    await search("walk horses");
    await page.getByRole("heading", { name: "No matching roles" }).waitFor();

    await page.locator('nav a[href="#ask"]').click();
    await page.locator("[data-prompt]").first().click();
    await page
      .locator('.chat-turn:last-child [data-detail="shelter-dog-walker"]')
      .click();
    await page
      .getByRole("heading", { name: "Shelter dog walking buddy", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    await page.locator("#chat-input").fill("What about weekdays?");
    await page.locator('#chat-form button[type="submit"]').click();
    await page
      .locator('.chat-turn:last-child [data-detail="neighbourhood-dog-walker"]')
      .waitFor();
    assert.equal(
      await page
        .locator('.chat-turn:last-child [data-detail="shelter-dog-walker"]')
        .count(),
      0,
    );
    assert.equal(await overflow(), false);
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({
        path: path.join(process.env.SCREENSHOT_DIR, "ask-" + width + ".png"),
      });
    }
    await page.getByRole("button", { name: "Start a new chat" }).click();
    await page.locator("#chat-input").fill("我想周末遛狗");
    await page.locator("#chat-input").press("Enter");
    await page
      .locator('.chat-turn:last-child [data-detail="shelter-dog-walker"]')
      .waitFor();
    await page.goto(base + "#evidence");
    await page
      .getByRole("heading", { name: "Explore opportunities" })
      .waitFor();
    assert.equal(
      await page.getByText("OpenAI embeddings", { exact: true }).count(),
      0,
    );
    assert(
      !requests.some((url) =>
        /\/data\/(semantic|evaluation)\.json|api\.openai\.com/.test(url),
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      width +
        "px passed: search, exclusions, saved roles, details, chat and page width.",
    );
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch(options);
  try {
    const api = await browser.newContext();
    for (const asset of [
      "data/evaluation.json",
      "data/semantic.json",
      "admin/index.html",
      "research-view.js",
      "desk-view.js",
    ]) {
      assert.equal((await api.request.get(base + asset)).status(), 404, asset);
    }
    const cat = await (
      await api.request.get(base + "data/catalog.json")
    ).json();
    assert(!cat.followUps && cat.opportunities.every((role) => !role.sources));
    const hosts = await (
      await api.request.get(base + "data/host-questions.json")
    ).json();
    assert(
      !hosts.model &&
        !hosts.provider &&
        hosts.questions.every((q) => !q.source),
    );
    await api.close();
    for (const [width, height] of [
      [1360, 930],
      [390, 844],
      [320, 700],
    ])
      await verifyViewport(browser, width, height);
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
