// Captures the README close-ups and demo GIF from the live site (or any URL).
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** Close-ups of the digit line, its hook and hint, for the step-by-step images. */
async function closeUps(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 680 }, deviceScaleFactor: 2, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const taken = new Set();
  const closeUp = async (name) => {
    if (taken.has(name)) return;
    taken.add(name);
    const box = await page.locator(".line").boundingBox();
    const w = 640, h = 260;
    await page.screenshot({ path: join(OUT, `${name}.png`), clip: { x: box.x + box.width / 2 - w / 2, y: box.y - 60, width: w, height: h } });
  };

  await page.goto(SITE);
  await page.locator("#value").waitFor();
  await page.locator("#value").fill("4532 8812 0071 9930");
  await page.locator("#label").fill("visa");
  await page.keyboard.press("Enter");
  await learnCard(page, { delay: 20, look: 700, shot: closeUp });
  await ctx.close();
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
  await closeUps(browser);
  await demoGif(browser);
} finally {
  await browser.close();
}
console.log(`wrote media to ${OUT}`);
