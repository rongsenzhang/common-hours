// Run the public exercise at phone and desktop widths, including direct entry.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.argv[2] || "http://127.0.0.1:8754/";
const options = process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {};

async function verify(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  const calls = [];
  page.on("pageerror", err => errors.push(err.message));
  page.on("request", req => calls.push(req));
  try {
    await page.goto(new URL("#exercise", base).href);
    await page.getByRole("heading", { level: 1, name: "Matching exercise" }).waitFor();
    const shortlist = page.locator("#ex-recommendations h3");
    const expectedA = ["Digital access buddy", "Digital skills facilitator"];
    assert.deepEqual(await shortlist.allTextContents(), expectedA);
    assert.equal(await page.locator("nav [aria-current=page]").innerText(), "Matching exercise");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole("button", { name: /Case B/ }).click();
    assert.deepEqual(await shortlist.allTextContents(), ["Digital skills facilitator"]);
    assert.match(await page.locator("#ex-pending").innerText(), /Youth reading mentor/);
    assert.match(await page.locator("#ex-pending").innerText(), /Form-filling volunteer/);
    await page.getByText("Compare with a simple filter", { exact: true }).click();
    assert.deepEqual(await page.locator("#ex-baseline ol").first().locator("li").allTextContents(),
      ["Food parcel packer", "Digital skills facilitator"]);
    const radius = page.locator("[name=maxMiles]");
    if (!(await radius.isVisible())) await page.locator("#ex-controls summary").click();
    await radius.fill("5");
    assert.deepEqual(await shortlist.allTextContents(), ["Conversation partner", "Digital skills facilitator"]);
    assert.equal(await radius.evaluate(input => document.activeElement === input), true);
    await radius.fill("");
    assert.equal(await radius.getAttribute("aria-invalid"), "true");
    assert.equal(await shortlist.count(), 0);
    await page.getByRole("button", { name: /Case B/ }).click();
    await page.locator("[name=clearance]").selectOption("verified");
    assert.deepEqual(await shortlist.allTextContents(), ["Youth reading mentor", "Digital skills facilitator"]);
    await page.getByRole("button", { name: /Case A/ }).click();
    assert.deepEqual(await shortlist.allTextContents(), expectedA);
    await page.getByText("Seven source records", { exact: true }).click();
    assert.equal(await page.locator(".ex-records h4").count(), 7);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(calls.some(req => req.method() === "POST" || /\/data\/.*\.json/.test(req.url())), false,
      "Direct entry and case changes should run without the catalogue or chat service.");
    await page.getByRole("link", { name: "Discover", exact: true }).click();
    await page.getByRole("heading", { name: "Explore opportunities" }).waitFor();
    await page.goBack();
    await page.getByRole("heading", { name: "Matching exercise", exact: true }).waitFor();
    assert.deepEqual(await shortlist.allTextContents(), expectedA);
    assert.deepEqual(errors, []);
    console.log(width + "px passed: cases, baseline, edits, unknowns, navigation and network isolation.");
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch(options);
  try {
    for (const width of [320, 390, 1360]) await verify(browser, width);
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
