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

test('checkout modal iframe targets checkout app when booking is available', async ({ page }) => {
  await gotoClassAndWaitForBookingState(page, '/classes/uv-body-paint-couples');
  await expectBookNowEnabled(page);

  await page.getByRole('button', { name: /Book Now/i }).first().click();

  const iframe = page.locator('#checkout-widget-iframe');
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute('src', /checkout\.denartny\.com/);
});

test('speed friending stays disabled when only uv couples has upcoming dates', async ({ page }) => {
  await gotoClassAndWaitForBookingState(page, '/classes/speed-friending');
  await expectBookNowDisabled(page);
});

test('redrawn stays disabled when only uv couples has upcoming dates', async ({ page }) => {
  await gotoClassAndWaitForBookingState(page, '/classes/redrawn');
  await expectBookNowDisabled(page);
});
