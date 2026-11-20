// Exercise the actual authenticated staff server without printing its access code.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const path = require("node:path");
const readline = require("node:readline");

async function run() {
  const server = spawn(process.env.PYTHON || "python3",
    ["-u", path.join(__dirname, "../admin/serve.py"), "--port", "0", "--data-dir", process.argv[2] || "site/data"],
    { stdio: ["ignore", "pipe", "inherit"] });
  let browser;
  try {
    let url, code;
    for await (const line of readline.createInterface({input: server.stdout})) {
      if (line.startsWith("Open http:")) url = line.match(/http:\/\/127\.0\.0\.1:\d+\//)[0];
      if (line.startsWith("Staff access code: ")) { code = line.slice("Staff access code: ".length); break; }
    }
    assert.ok(url && code, "Staff server should provide a local address and temporary credential");
    browser = await chromium.launch(process.env.CHROME_EXECUTABLE ? {
      executablePath: process.env.CHROME_EXECUTABLE
    } : {});
    for (const width of [1360, 390]) {
      const context = await browser.newContext({viewport: {width, height: 860}});
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(String(error)));
      assert.equal((await context.request.get(url + "data/semantic.json")).status(), 401);
      await page.goto(url);
      await page.getByLabel("Access code").fill(code);
      await page.getByRole("button", {name:"Open staff console"}).click();
      const selector = page.getByLabel("Benchmark query (A–Z)");
      await selector.waitFor();
      assert.equal((await context.request.get(url + "data/semantic.json")).status(), 200);
      const rows = await selector.locator("option").allTextContents();
      const collator = new Intl.Collator("en-GB", {sensitivity:"base", numeric:true});
      const queries = rows.map(row => row.split(" · ")[0]);
      assert.deepEqual(queries, [...queries].sort(collator.compare));
      await selector.selectOption("B29");
      assert.match(await selector.locator("option:checked").textContent(), /walk dogs/i);
      await page.getByRole("link", {name:"Coordinator desk"}).click();
      await page.getByRole("button", {name:"Preview volunteer result"}).click();
      assert.equal(await page.locator(".admin-preview dd").first().textContent(), "To confirm");
      await page.getByRole("link", {name:"Return to the coordinator desk"}).click();
      await page.getByRole("button", {name:/^Confirm step-free access for Community garden buddy/}).click();
      await page.getByRole("button", {name:"Preview volunteer result"}).click();
      assert.equal(await page.locator(".admin-preview dd").first().textContent(), "Matches");
      await page.getByRole("link", {name:"Return to the coordinator desk"}).click();
      const undo = page.getByRole("button", {name:/^Undo confirmation for Community garden buddy/});
      const record = page.locator('details[data-item="garden-buddy:stepFree"]');
      if (!(await record.evaluate(panel => panel.open))) await record.locator("summary").click();
      await undo.click();
      await page.getByRole("button", {name:"Preview volunteer result"}).click();
      assert.equal(await page.locator(".admin-preview dd").first().textContent(), "To confirm");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(width + "px · staff sign-in, manifest access, A–Z queries, B29, host review and undo passed");
    }
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null && !server.killed) {
      const stopped = once(server, "exit");
      server.kill("SIGTERM");
      await stopped;
    }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
