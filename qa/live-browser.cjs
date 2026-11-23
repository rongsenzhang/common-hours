// Deterministic browser verification of the live transport UI with a stub endpoint.
// Run a local packaged preview before this script. No OpenAI requests are made.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("playwright");
const base = new URL(process.argv[2] || "http://127.0.0.1:8754/");
const config = new URL("data/chat-config.json", base).href;
const api = new URL("qa-chat", base).href;
const caseA = "I’d like to help people one to one, ideally using the digital support skills I already have. I can only volunteer on weekday evenings. Online is fine, but I can’t travel more than three miles. I don’t know if my safeguarding clearance is valid for a new role.";
const caseBFollowUp = "The same volunteer can no longer volunteer online. Everything else stays the same.";

async function ask(page, question) {
  await page.locator("#chat-input").fill(question);
  await page.locator('#chat-form button[type="submit"]').click();
}

async function checkCaseAnswer(page, expectedRoles) {
  const answer = page.locator(".chat-turn").last();
  const recommendations = answer.locator("[data-exercise-recommendations] [data-exercise-title]");
  await recommendations.first().waitFor();
  assert.deepEqual(await recommendations.allTextContents(), expectedRoles);
  const pending = answer.locator("[data-exercise-pending]");
  assert.deepEqual(await pending.locator("[data-exercise-title]").allTextContents(),
    ["Youth reading mentor", "Form-filling volunteer"]);
  assert.match(await pending.innerText(), /clearance/i);
  assert.match(await pending.innerText(), /distance/i);
  assert.match(await answer.locator(".chat-criteria").innerText(), /3|three/i);
}

async function verifyInterviewChat(page, postBodies, replies) {
  const liveCalls = postBodies.length;
  assert.ok(await page.getByRole("radio", {name: "Live AI", exact: true}).isChecked());
  async function checkCommunityCase(question, mode) {
    await ask(page, question);
    const answer = page.locator(".chat-turn").last();
    await answer.getByText("OpenAI · browser-test-model").waitFor();
    const ids = await answer.locator("[data-detail]").evaluateAll(cards => cards.map(card => card.dataset.detail));
    const expected = replies[mode === "either" ? "A" : "B"];
    assert.deepEqual(ids, [...expected.matches, ...expected.toConfirm]);
    assert.equal(new URL(page.url()).hash, "#ask");
    assert.equal(postBodies.at(-1).message, question);
    assert.equal(await answer.locator("[data-exercise-title]").count(), 0);
  }
  await checkCommunityCase(caseA, "either");
  await checkCommunityCase(caseBFollowUp, "in-person");
  assert.equal(postBodies.length, liveCalls + 2);
  assert.equal(postBodies.at(-1).history.at(-1).user, caseA);
  assert.equal(postBodies.at(-1).history.at(-1).caseProfile.maxMiles, 3);
  await page.locator("[data-restart-chat]").click();
  await page.getByRole("button", {name: "Run Case B"}).click();
  await page.getByText("OpenAI · browser-test-model").waitFor();
  assert.equal(postBodies.at(-1).message, "Case B");
  assert.equal(postBodies.at(-1).history.length, 0);

  // Open the interview link as a new visitor. Watch all requests before the
  // document loads, including configuration and catalogue reads.
  await page.goto("about:blank");
  const requests = [];
  const track = req => requests.push(req);
  page.on("request", track);
  try {
    await page.goto(new URL("#ask-exercise", base).href);
    await page.getByRole("heading", {name: "Seven-role exercise chat"}).waitFor();
    await ask(page, "Case B");
    await checkCaseAnswer(page, ["Digital skills facilitator"]);
    const latest = page.locator(".chat-turn").last();
    const ranked = latest.locator("[data-exercise-recommendations] [data-exercise-title]");
    await ask(page, "The form-filling venue is 2 miles away.");
    assert.deepEqual(await ranked.allTextContents(), ["Form-filling volunteer", "Digital skills facilitator"]);
    await ask(page, "The form-filling venue is 5 miles away.");
    assert.deepEqual(await ranked.allTextContents(), ["Digital skills facilitator"]);
    assert.deepEqual(await latest.locator("[data-exercise-pending] [data-exercise-title]").allTextContents(),
      ["Youth reading mentor"]);
    assert.equal(requests.some(req => req.method() === "POST" ||
      /\/data\/(catalog|chat-config|host-questions)\.json/.test(new URL(req.url()).pathname)), false,
      "The seven-role entry point should need neither public catalogue nor live chat.");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  } finally {
    page.off("request", track);
  }
}

(async () => {
  const {matchCommunityCase} = await import("../site/community-case.js");
  const {exerciseProfile} = await import("../site/exercise-engine.js");
  const {opportunities} = JSON.parse(readFileSync(join(__dirname, "../site/data/catalog.json"), "utf8"));
  const replies = {};
  for (const id of ["A", "B"]) {
    const caseProfile = {...exerciseProfile(id), verifiedRoleId: null, stepFree: false};
    const result = matchCommunityCase(opportunities, caseProfile);
    replies[id] = {matches: result.recommendations.map(row => row.role.id), toConfirm: result.pending.slice(0, 3).map(row => row.role.id), caseProfile};
    assert.ok(replies[id].matches.length);
  }
  const browser = await chromium.launch(
    process.env.CHROME_EXECUTABLE
      ? { executablePath: process.env.CHROME_EXECUTABLE }
      : {},
  );
  try {
    for (const width of [1360, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      const messages = [];
      const unexpectedPosts = [];
      let next = "success",
        release;
      try {
        await page.route("**/*", (route) => {
          const request = route.request();
          if (request.method() === "POST" && request.url() !== api) {
            unexpectedPosts.push(request.url());
            return route.abort();
          }
          return route.continue();
        });
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
          const question = messages.at(-1).message;
          const preset = [caseA, caseBFollowUp, "Case B"].includes(question);
          return route.fulfill({
            json: {
              provider: "openai",
              model: "browser-test-model",
              text: "Confirmed by the demo catalogue.",
              ...(preset ? replies[question === caseA ? "A" : "B"] : {matches: ["shelter-dog-walker"], toConfirm: []}),
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
        next = "success";
        await verifyInterviewChat(page, messages, replies);
        assert.deepEqual(unexpectedPosts, []);
        console.log(
          width +
            "px passed: live transport, errors and cancel, interview case results, isolated transcripts, drafts and account-free direct entry.",
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
