// Deterministic browser verification of the live transport UI with a stub endpoint.
// Run a local packaged preview before this script. No OpenAI requests are made.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = new URL(process.argv[2] || "http://127.0.0.1:8754/");
const config = new URL("data/chat-config.json", base).href;
const api = new URL("qa-chat", base).href;

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_EXECUTABLE
      ? { executablePath: process.env.CHROME_EXECUTABLE }
      : {},
  );
  try {
    for (const width of [1360, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      const messages = [];
      let next = "success",
        release;
      try {
        await page.route(config, (route) =>
          route.fulfill({ json: { endpoint: api } }),
        );
        await page.route(api, async (route) => {
          messages.push(route.request().postDataJSON());
          if (next === "wait")
            await new Promise((resolve) => {
              release = resolve;
            });
          if (next === "fail")
            return route.fulfill({ status: 503, body: "offline" });
          return route.fulfill({
            json: {
              provider: "openai",
              model: "browser-test-model",
              text: "Confirmed by the demo catalogue.",
              matches: ["shelter-dog-walker"],
              toConfirm: [],
              details: {},
            },
          });
        });
        await page.goto(base.href + "#ask");
        await page
          .getByRole("heading", { name: "Ask the role finder" })
          .waitFor();
        assert.equal(messages.length, 0);
        assert.ok(
          await page
            .getByText(/shares your question and up to eight/)
            .isVisible(),
        );
        await page.locator("[data-prompt]").first().click();
        await page
          .getByText("OpenAI · browser-test-model", { exact: true })
          .waitFor();
        assert.equal(messages.length, 1);
        assert.equal(messages[0].history.length, 0);
        await page.locator("[data-detail=shelter-dog-walker]").click();
        await page.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        const input = page.locator("#chat-input");
        next = "fail";
        await input.fill("What about workdays?");
        await page.locator('#chat-form button[type="submit"]').click();
        await page.getByRole("alert").waitFor();
        assert.equal(await input.inputValue(), "What about workdays?");
        assert.equal(messages[1].history[0].user, messages[0].message);
        await page.getByRole("radio", { name: "On-device search" }).check();
        await page.locator("[data-prompt]").first().click();
        assert.equal(messages.length, 2);
        await page.getByRole("radio", { name: "Live AI", exact: true }).check();
        next = "wait";
        await page.locator('#chat-form button[type="submit"]').click();
        await page
          .getByRole("button", { name: "Cancel", exact: true })
          .waitFor();
        await page.waitForFunction(
          () => document.querySelector("#chat-input").disabled,
        );
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.getByText("Cancelled.", { exact: false }).waitFor();
        assert.equal(await input.inputValue(), "What about workdays?");
        assert.equal(await page.locator(".chat-source").count(), 1);
        release?.();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        console.log(
          width +
            "px passed: live transport UI contract, isolated local mode, disclosure, errors, retry draft, cancel, grounded card and privacy.",
        );
      } finally {
        release?.();
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
