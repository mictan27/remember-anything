// Captures the README screenshots and demo GIF from the live site (or any URL).
//   node scripts/capture-media.mjs [url]
// Needs ffmpeg on PATH for the GIF. Writes to docs/.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SITE = process.argv[2] ?? "https://www.rememberanyth.ing";
const OUT = new URL("../docs/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const DAY = 86_400_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Puts example data into this (headless, throwaway) browser's storage. */
async function seed(page, data) {
  await page.evaluate(async (entries) => {
    await new Promise((resolve, reject) => {
      const open = indexedDB.open("keyval-store");
      open.onupgradeneeded = () => open.result.createObjectStore("keyval");
      open.onsuccess = () => {
        const tx = open.result.transaction("keyval", "readwrite");
        for (const [k, v] of entries) tx.objectStore("keyval").put(v, k);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      };
    });
  }, Object.entries(data));
}

function exampleData(now) {
  const item = (id, label, chunks, srs, sensitive = true) => ({
    id, label, value: chunks.join(""), kind: /^\d+$/.test(chunks.join("")) ? "digits" : "alnum",
    chunks, sensitive, hooks: chunks.map(() => null), createdAt: now - DAY, srs,
  });
  return {
    items: [
      item("a", "passport", ["X123", "45678"], { step: 1, due: now - 1000 }),
      item("b", "visa", ["4532", "8812", "0071", "9930"], { step: 0, due: now + DAY }),
      item("c", "mum's phone", ["415", "555", "0123"], { step: 2, due: now + 7 * DAY }, false),
      item("d", "bike lock", ["7294"], { step: 3, due: now + 16 * DAY }),
    ],
    pi: { frontier: 12, best: 60 },
    streak: { day: new Date(now).toISOString().slice(0, 10), count: 4 },
  };
}

async function waitHint(page, re) {
  await page.locator(".hint").filter({ hasText: re }).waitFor();
}

async function addCard(page, typeDelay) {
  await page.locator("#value").pressSequentially("4532 8812 0071 9930", { delay: typeDelay });
  await page.locator("#label").pressSequentially("visa", { delay: typeDelay });
  await sleep(500);
  await page.keyboard.press("Enter");
}

/** Learns the card number, with one deliberate mistake on the second chunk. */
async function learnCard(page, { delay, look, shot }) {
  const chunk = async (digits, chain) => {
    await waitHint(page, /remember this/);
    await sleep(look);
    await shot?.("flash");
    await page.keyboard.press("Space");
    await waitHint(page, /type it/);
    await sleep(250);
    await page.keyboard.type(digits, { delay });
    if (chain) {
      await waitHint(page, /all together|whole thing/);
      await sleep(400);
      await page.keyboard.type(chain, { delay });
    }
  };
  await chunk("4532");
  // Second chunk: a wrong digit restarts just this chunk.
  await waitHint(page, /remember this/);
  await sleep(look);
  await page.keyboard.press("Space");
  await waitHint(page, /type it/);
  await sleep(250);
  await page.keyboard.type("88", { delay });
  await page.keyboard.type("9");
  if (shot) {
    await sleep(260); // let the red finish fading in
    await shot("mistake");
  }
  await waitHint(page, /type it/);
  await sleep(250);
  await page.keyboard.type("8812", { delay });
  await waitHint(page, /all together/);
  await sleep(400);
  await page.keyboard.type("4532", { delay });
  await page.keyboard.type("88", { delay });
  await shot?.("chain");
  await page.keyboard.type("12", { delay });
  await chunk("0071", "453288120071");
  await chunk("9930", "4532881200719930");
  await page.locator(".results").waitFor();
}

async function screenshots(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 680 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const shot = async (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
  // A close-up of the digit line, its hook and hint, for the step-by-step images.
  const closeUp = async (name) => {
    const box = await page.locator(".line").boundingBox();
    const w = 640, h = 260;
    await page.screenshot({ path: join(OUT, `${name}.png`), clip: { x: box.x + box.width / 2 - w / 2, y: box.y - 60, width: w, height: h } });
  };

  await page.goto(SITE);
  await page.locator("#value").waitFor();
  await page.locator("#value").fill("4532 8812 0071 9930");
  await page.locator("#label").fill("visa");
  await sleep(500);
  await shot("add");
  await page.keyboard.press("Enter");
  const once = new Set();
  await learnCard(page, { delay: 20, look: 700, shot: async (name) => { if (!once.has(name)) { once.add(name); await closeUp(name); } } });
  await sleep(900);
  await shot("results");

  await seed(page, exampleData(Date.now()));
  await page.goto(SITE + "/#/");
  await page.reload();
  await page.locator(".row").first().waitFor();
  await sleep(700);
  await shot("home");

  await page.goto(SITE + "/#/pi");
  await waitHint(page, /remember this/);
  await sleep(900);
  await shot("pi");
  await ctx.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const p = await phone.newPage();
  await p.goto(SITE);
  await p.locator("#value").fill("415 555 0123");
  await p.locator("#label").fill("mum's phone");
  await p.keyboard.press("Enter");
  await p.locator(".hint").filter({ hasText: /remember this/ }).waitFor();
  await sleep(800);
  await p.screenshot({ path: join(OUT, "phone-flash.png") });
  await p.locator(".session-body").tap();
  await p.locator(".hint").filter({ hasText: /type it/ }).waitFor();
  await p.keyboard.type("41");
  await sleep(500);
  await p.screenshot({ path: join(OUT, "phone-typing.png") });
  await phone.close();
}

async function demoGif(browser) {
  const width = 1000, height = 680;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.goto(SITE);
  await page.locator("#value").waitFor();
  await sleep(600);

  const frames = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "png", maxWidth: width * 2, maxHeight: height * 2, everyNthFrame: 1 });

  await sleep(800);
  await addCard(page, 45);
  await learnCard(page, { delay: 115, look: 1300 });
  await sleep(3200);
  await cdp.send("Page.stopScreencast");
  await ctx.close();

  const dir = mkdtempSync(join(tmpdir(), "frames-"));
  let list = "";
  frames.forEach((f, i) => {
    const file = join(dir, `f${String(i).padStart(5, "0")}.png`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    const next = frames[i + 1]?.t ?? f.t + 2.5;
    list += `file '${file}'\nduration ${Math.max(0.02, next - f.t).toFixed(3)}\n`;
  });
  list += `file '${join(dir, `f${String(frames.length - 1).padStart(5, "0")}.png`)}'\n`;
  writeFileSync(join(dir, "list.txt"), list);
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"),
    "-vf", `fps=24,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=full[p];[b][p]paletteuse=dither=none`,
    join(OUT, "demo.gif"),
  ]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`demo.gif from ${frames.length} frames`);
}

const browser = await chromium.launch();
try {
  await screenshots(browser);
  await demoGif(browser);
} finally {
  await browser.close();
}
console.log(`wrote media to ${OUT}`);
