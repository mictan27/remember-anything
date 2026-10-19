import { expect, test, type Page } from "@playwright/test";

const hint = (page: Page) => page.locator(".hint");

async function learnChunk(page: Page, digits: string) {
  await expect(hint(page)).toHaveText(/remember this/);
  await page.keyboard.press("Space");
  await expect(hint(page)).toHaveText("type it");
  await page.keyboard.type(digits);
}

test("learn a card number, with one mistake, and keep it after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What do you want to remember?" })).toBeVisible();
  await page.locator("#value").fill("4532 8812 0071 9930");
  await page.locator("#label").fill("visa");
  await page.keyboard.press("Enter");

  await expect(page.locator(".session-meta")).toContainText("chunk 1/4");
  await learnChunk(page, "4532");

  // A wrong digit restarts only this chunk.
  await learnChunk(page, "89");
  await expect(hint(page)).toHaveText("restart this chunk");
  await expect(page.locator(".d.bad")).toHaveText("9");
  await expect(hint(page)).toHaveText("type it");
  await page.keyboard.type("8812");

  await expect(hint(page)).toHaveText("now all together");
  await page.keyboard.type("45328812");
  await learnChunk(page, "0071");
  await expect(hint(page)).toHaveText("now all together");
  await page.keyboard.type("453288120071");
  await learnChunk(page, "9930");
  await expect(hint(page)).toHaveText("the whole thing, no mistakes");
  await page.keyboard.type("4532881200719930");

  await expect(page.locator(".next")).toHaveText("next review · tomorrow");
  await expect(page.locator(".big-stat").filter({ hasText: "restarts" })).toContainText("1");
  await expect(page.locator("#hook-1")).toHaveValue("88 piano keys · 12 a dozen eggs");
  await page.locator("#hook-1").fill("88 keys on grandma's piano");
  await page.locator("#hook-1").press("Escape");
  await page.keyboard.press("Enter");

  const row = page.locator(".row").filter({ hasText: "visa" });
  await expect(row).toContainText("•••• 9930");
  await expect(row).toContainText("review tomorrow");
  await page.reload();
  await expect(page.locator(".row").filter({ hasText: "visa" })).toContainText("review tomorrow");
});

test("review a due number from memory", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const item = {
      id: "seed", label: "passport", value: "X12345678", kind: "alnum", chunks: ["X123", "45678"],
      sensitive: true, hooks: [null, null], createdAt: 0, srs: { step: 0, due: Date.now() - 1000 },
    };
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("keyval-store");
      open.onupgradeneeded = () => open.result.createObjectStore("keyval");
      open.onsuccess = () => {
        const tx = open.result.transaction("keyval", "readwrite");
        tx.objectStore("keyval").put([item], "items");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload();
  await expect(page.locator(".section-label")).toHaveText("1 review due");
  await page.locator(".row").filter({ hasText: "passport" }).locator(".row-open").click();
  await expect(hint(page)).toHaveText("from memory, no hints");
  await page.keyboard.type("x12345678");
  await expect(page.locator(".next")).toHaveText("next review · in 3 days");
});

test("pi mode learns the first 20 digits", async ({ page }) => {
  await page.goto("/#/pi");
  for (const chunk of ["14159", "26535", "89793", "23846"].entries()) {
    const [i, digits] = chunk;
    await learnChunk(page, digits);
    if (i > 0 && i < 3) {
      await expect(hint(page)).toHaveText("now all together");
      await page.keyboard.type(["14159", "26535", "89793"].slice(0, i + 1).join(""));
    }
  }
  await expect(hint(page)).toHaveText("the whole thing, no mistakes");
  await page.keyboard.type("14159265358979323846");
  await expect(page.locator(".next")).toHaveText("20 digits learned");
});
