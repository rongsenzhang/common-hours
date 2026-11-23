// Run the public exercise at phone and desktop widths, including direct entry.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.argv[2] || "http://127.0.0.1:8754/";
const options = process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {};

async function verifyVenueScenario(page, shortlist, expectedA) {
  const formRole = "Form-filling volunteer";
  const facilitator = "Digital skills facilitator";
  const venue = page.locator("#ex-venue-scenario");
  const setting = value => venue.locator(`input[value="${value}"]`);
  const simpleFilter = page.locator("#ex-baseline ol").first().locator("li");
  const sourceRecords = page.locator(".ex-records > li");
  const original = await sourceRecords.allTextContents();
  const formsRecord = sourceRecords.filter({ has: page.getByRole("heading", { name: formRole, includeHidden: true }) });
  assert.match(await formsRecord.textContent(), /Thu evening · in person, distance not recorded/);
  assert.equal(await setting("unknown").isChecked(), true);

  await setting("2").check();
  assert.deepEqual(await shortlist.allTextContents(), [formRole, facilitator]);
  assert.match(await page.locator("#ex-venue-outcome").innerText(), /number 1/);
  assert.deepEqual(await simpleFilter.allTextContents(), ["Food parcel packer", formRole, facilitator]);
  assert.doesNotMatch(await page.locator("#ex-pending").textContent(), /Form-filling volunteer/);
  assert.deepEqual(await sourceRecords.allTextContents(), original);

  await setting("5").check();
  assert.deepEqual(await shortlist.allTextContents(), [facilitator]);
  assert.match(await page.locator("#ex-venue-outcome").innerText(), /ruled out/i);
  assert.deepEqual(await simpleFilter.allTextContents(), ["Food parcel packer", facilitator]);
  assert.match(await page.locator("#ex-excluded").textContent(), /Form-filling volunteer/);
  assert.doesNotMatch(await page.locator("#ex-pending").textContent(), /Form-filling volunteer/);
  assert.deepEqual(await sourceRecords.allTextContents(), original);

  const radius = page.locator("[name=maxMiles]");
  if (!(await radius.isVisible())) await page.locator("#ex-controls summary").click();
  await radius.fill("5");
  assert.equal(await setting("5").isChecked(), true);
  assert.equal((await shortlist.allTextContents())[0], formRole);
  await radius.fill("3");
  assert.match(await page.locator("#ex-excluded").textContent(), /Form-filling volunteer/);

  await setting("unknown").check();
  assert.match(await page.locator("#ex-venue-outcome").innerText(), /needs confirmation/i);
  assert.match(await page.locator("#ex-pending").textContent(), /Form-filling volunteer/);
  await setting("2").check();
  await page.getByRole("button", { name: /Case A/ }).click();
  assert.equal(await setting("unknown").isChecked(), true);
  assert.deepEqual(await shortlist.allTextContents(), expectedA);
  await setting("2").check();
  assert.deepEqual(await shortlist.allTextContents(), [expectedA[0], formRole, facilitator]);
  await page.getByRole("button", { name: /Case B/ }).click();
  assert.equal(await setting("unknown").isChecked(), true);
  assert.deepEqual(await shortlist.allTextContents(), [facilitator]);
}

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
    await verifyVenueScenario(page, shortlist, expectedA);
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
    await page.locator("#ex-wording summary").click();
    assert.ok(await page.locator("#ex-wording li[data-check=pass]").count() >= 2);
    assert.equal(await page.locator("#ex-wording li[data-check=check]").count(), 0);
    await page.locator("#ex-odi summary").click();
    const mapping = await page.locator("#ex-odi").innerText();
    for (const field of ["allowsRemoteParticipation", "requirement", "location"]) assert.ok(mapping.includes(field), field);
    assert.ok(await page.locator('#ex-odi a[href^="https://standard.volunteeringdata.io/ontology"]').count());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(calls.some(req => req.method() === "POST" || /\/data\/.*\.json/.test(req.url())), false,
      "Direct entry and case changes should run without the catalogue or chat service.");
    await page.getByRole("link", { name: "Discover", exact: true }).click();
    await page.getByRole("heading", { name: "Explore opportunities" }).waitFor();
    await page.goBack();
    await page.getByRole("heading", { name: "Matching exercise", exact: true }).waitFor();
    assert.deepEqual(await shortlist.allTextContents(), expectedA);
    assert.deepEqual(errors, []);
    console.log(width + "px passed: original cases, all three venue settings, immutable records, wording checks, ODI mapping, navigation and network isolation.");
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch(options);
  try {
    for (const width of [320, 390, 1360]) await verify(browser, width);
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
