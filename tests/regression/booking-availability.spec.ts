import { test } from '@playwright/test';
import {
  CLASS_BOOKING_PAGES,
  expectBookNowDisabled,
  gotoClassAndWaitForBookingState,
} from './helpers/booking';

for (const { path } of CLASS_BOOKING_PAGES) {
  test(`class page disables Book Now when no upcoming dates: ${path}`, async ({ page }) => {
    await gotoClassAndWaitForBookingState(page, path);
    await expectBookNowDisabled(page);
  });
}
