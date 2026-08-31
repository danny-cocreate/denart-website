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

test('checkout modal iframe targets same-origin checkout widget when booking is available', async ({ page }) => {
  await gotoClassAndWaitForBookingState(page, '/classes/uv-body-paint-couples');
  await expectBookNowEnabled(page);

  await page.getByRole('button', { name: /Book Now/i }).first().click();

  const iframe = page.locator('#checkout-widget-iframe');
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute('src', /\/checkout-widget\/index\.html/);
  await expect(iframe).toHaveAttribute('src', /event=paint-in-the-dark/);
});

test('speed friending hero shows price, safety copy, tickets, and no 1:1 session CTA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/classes/speed-friending');

  await expect(page.getByRole('heading', { name: /Speed Friending x Body Painting/i })).toBeVisible();
  await expect(page.getByText('Make authentic connections with other singles')).toBeVisible();
  await expect(page.getByText(/Everyone paints — and gets painted/i).first()).toBeVisible();
  await expect(page.getByText(/You paint other people and they paint you/i)).toBeVisible();
  const earlyBird = page.getByText(/\$39 early bird through 09\/11/i).first();
  await expect(earlyBird).toBeVisible();
  const earlyBirdBox = await earlyBird.boundingBox();
  expect(earlyBirdBox, 'Early-bird price should be in the hero').not.toBeNull();
  expect(earlyBirdBox!.y + earlyBirdBox!.height, 'Price should sit above the 844px mobile fold').toBeLessThan(844);
  await expect(page.getByText(/Staff monitor throughout — you can step away from any interaction/i).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /What's included/i })).toBeVisible();
  await expect(page.getByText(/All body painting supplies and tools provided/i)).toBeVisible();
  await expect(page.getByText('Wine').first()).toBeVisible();
  await expect(page.getByText('Tickets').first()).toBeVisible();
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
