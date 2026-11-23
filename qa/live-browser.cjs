// Deterministic browser verification of the live transport UI with a stub endpoint.
// Run a local packaged preview before this script. No OpenAI requests are made.
const assert = require("node:assert/strict");
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

async function verifyInterviewChat(page, postBodies) {
  const liveCalls = postBodies.length;
  const exerciseSource = page.locator('[name="chat-source"][value="exercise"]');
  const communitySource = page.locator('[name="chat-source"][value="community"]');
  const history = page.locator(".chat-history");
  assert.ok(await communitySource.isChecked());
  assert.ok(await page.getByRole("radio", {name: "Live AI", exact: true}).isChecked());

  // Paste the supplied A straight into the regular Ask entry point.
  await ask(page, caseA);
  await checkCaseAnswer(page, ["Digital access buddy", "Digital skills facilitator"]);
  assert.ok(await exerciseSource.isChecked());
  assert.equal(await page.locator('[name="chat-mode"]:visible').count(), 0);
  assert.doesNotMatch(await history.innerText(), /Confirmed by the demo catalogue/);
  await ask(page, caseBFollowUp);
  await checkCaseAnswer(page, ["Digital skills facilitator"]);
  assert.equal(postBodies.length, liveCalls, "Both supplied cases must stay on-device.");

  const input = page.locator("#chat-input");
  await input.fill("A private exercise draft");
  await communitySource.check();
  assert.equal(await input.inputValue(), "");
  assert.equal(await page.locator(".chat-turn").count(), 1);
  assert.doesNotMatch(await history.innerText(), /Digital skills facilitator|safeguarding clearance/i);
  await ask(page, "Can I walk dogs at weekends?");
  await page.waitForFunction(() => document.querySelectorAll(".chat-source").length === 2);
  assert.equal(postBodies.length, liveCalls + 1);
  assert.deepEqual(postBodies.at(-1).history.map(turn => turn.user), [postBodies[0].message]);
  assert.doesNotMatch(JSON.stringify(postBodies), /safeguarding clearance|same volunteer|private exercise draft/i);
  await exerciseSource.check();
  assert.equal(await input.inputValue(), "A private exercise draft");
  assert.equal(await page.locator(".chat-turn").count(), 2);
  await checkCaseAnswer(page, ["Digital skills facilitator"]);
  await page.locator("[data-restart-chat]").click();
  assert.equal(await input.inputValue(), "");
  assert.equal(await page.locator(".chat-turn").count(), 0);

  // Open the interview link as a new visitor. Watch all requests before the
  // document loads, including configuration and catalogue reads.
  await page.goto("about:blank");
  const requests = [];
  const track = req => requests.push(req);
  page.on("request", track);
  try {
    await page.goto(new URL("#ask-exercise", base).href);
    await exerciseSource.waitFor();
    assert.ok(await exerciseSource.isChecked());
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
        next = "success";
        await verifyInterviewChat(page, messages);
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
