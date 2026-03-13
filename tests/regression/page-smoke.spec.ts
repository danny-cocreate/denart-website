import { expect, test, type Page } from '@playwright/test';

const CORE_PAGE_PATHS = [
  '/services',
  '/services/fine-art-body-painting',
  '/services/hypnotic-body-painting',
  '/services/body-painting-for-events',
  '/gallery',
  '/gallery/art-history',
  '/gallery/events',
  '/classes',
  '/classes/speed-friending',
  '/contact',
  '/reviews',
] as const;

const GALLERY_SAMPLE_PATH_SETS = [
  ['/gallery/starry-night-after-van-gogh', '/gallery/sakura'],
  ['/gallery/chinese-dragon-1', '/gallery/glowing-skull'],
  ['/gallery/birth-of-venus', '/gallery/tribal-uv'],
] as const;

function getGallerySampleSet(): readonly string[] {
  const envBucket = Number.parseInt(process.env.GALLERY_SAMPLE_BUCKET || '', 10);
  if (Number.isInteger(envBucket) && envBucket >= 0) {
    return GALLERY_SAMPLE_PATH_SETS[envBucket % GALLERY_SAMPLE_PATH_SETS.length];
  }

  // Deterministic daily rotation keeps coverage broad without random flakiness.
  const utcDayNumber = Math.floor(Date.now() / 86_400_000);
  return GALLERY_SAMPLE_PATH_SETS[utcDayNumber % GALLERY_SAMPLE_PATH_SETS.length];
}

async function expectPageHealthy(path: string, page: Page) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `No response when loading ${path}`).not.toBeNull();
  expect(response!.status(), `Unexpected status for ${path}`).toBeLessThan(400);

  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('h1, h2').first()).toBeVisible();
}

for (const path of CORE_PAGE_PATHS) {
  test(`page smoke: ${path} loads`, async ({ page }) => {
    await expectPageHealthy(path, page);
  });
}

for (const path of getGallerySampleSet()) {
  test(`gallery sample: ${path} loads`, async ({ page }) => {
    await expectPageHealthy(path, page);
  });
}
