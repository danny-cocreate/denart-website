import { expect, test } from '@playwright/test';
import {
  expectBookNowDisabled,
  expectBookNowEnabled,
  gotoClassAndWaitForBookingState,
} from './helpers/booking';

test('uv couples Book Now opens checkout modal when upcoming dates exist', async ({ page }) => {
  await gotoClassAndWaitForBookingState(page, '/classes/uv-body-paint-couples');
  await expectBookNowEnabled(page);

  await page.getByRole('button', { name: /Book Now/i }).first().click();
  await expect(page.locator('#checkout-widget-modal')).toBeVisible();
});

test('class schedule shows at most 10 upcoming dates and a view-all link', async ({ page }) => {
  await gotoClassAndWaitForBookingState(page, '/classes/uv-body-paint-couples');

  const slots = page.locator('.pretix-schedule [data-pretix-slot]:not([hidden])');
  expect(await slots.count()).toBeLessThanOrEqual(10);
  await expect(page.locator('.pretix-schedule .pretix-schedule-view-all')).toBeVisible();
});

test('checkout modal iframe targets same-origin checkout widget when booking is available', async ({ page }) => {
  await gotoClassAndWaitForBookingState(page, '/classes/uv-body-paint-couples');
  await expectBookNowEnabled(page);

  await page.getByRole('button', { name: /Book Now/i }).first().click();

  const iframe = page.locator('#checkout-widget-iframe');
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute('src', /\/checkout-widget\/index\.html/);
  await expect(iframe).toHaveAttribute('src', /event=paint-in-the-dark/);
});

test('speed friending hero shows price, mechanic, and no 1:1 session CTA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/classes/speed-friending');

  const hero = page.locator('#class-hero');
  await expect(hero.getByRole('heading', { name: /Speed Friending x Body Painting/i })).toBeVisible();
  await expect(hero.getByText('Everyone paints — and gets painted')).toBeVisible();
  await expect(page.getByText('Make authentic connections with other singles')).toHaveCount(0);
  await expect(hero.getByText(/Staff monitor throughout/i)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Not a two-minute pitch/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Who it[’']s for/i })).toBeVisible();
  await expect(page.getByText(/Singles 21[–-]40/i)).toBeVisible();
  const earlyBird = hero.getByText(/\$39 early bird through 09\/16/i);
  await expect(earlyBird).toBeVisible();
  const earlyBirdBox = await earlyBird.boundingBox();
  expect(earlyBirdBox, 'Early-bird price should be in the hero').not.toBeNull();
  expect(earlyBirdBox!.y + earlyBirdBox!.height, 'Price should sit above the 844px mobile fold').toBeLessThan(844);
  await expect(page.getByRole('heading', { name: /What's included/i })).toBeVisible();
  await expect(page.getByText('All paint and supplies')).toBeVisible();
  await expect(page.getByText('Wine').first()).toBeVisible();
  await expect(page.getByText('Chocolate')).toHaveCount(0);
  await expect(page.getByText('Mixer after')).toBeVisible();
  await expect(hero.getByText(/Fri, |Sat, |Sun, |Mon, |Tue, |Wed, |Thu,/)).toHaveCount(0);
  await expect(page.locator('[data-ticket-qty]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /More tickets/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Fewer tickets/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Book Now/i }).first()).toBeVisible();
  await expect(page.locator('#sticky-book-bar')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 2500));
  await expect(page.locator('#sticky-book-bar')).toBeVisible();
  await expect(page.getByRole('link', { name: /Book a Session/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Book Session/i })).toHaveCount(0);
});

test('speed friending stays disabled when only uv couples has upcoming dates', async ({ page }) => {
  await gotoClassAndWaitForBookingState(page, '/classes/speed-friending');
  await expectBookNowDisabled(page);
});

test('redrawn stays disabled when only uv couples has upcoming dates', async ({ page }) => {
  await gotoClassAndWaitForBookingState(page, '/classes/redrawn');
  await expectBookNowDisabled(page);
});
