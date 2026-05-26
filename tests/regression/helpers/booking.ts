import { expect, type Page } from '@playwright/test';

export const CLASS_BOOKING_PAGES = [
  { path: '/classes/uv-body-paint-couples', pretixSlug: 'uc-class-couples-2' },
  { path: '/classes/speed-friending', pretixSlug: 'speed-friending' },
  { path: '/classes/redrawn', pretixSlug: 'redrawn' },
] as const;

/** Wait for client-side Pretix schedule filtering and booking CTA state. */
export async function gotoClassAndWaitForBookingState(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });

  await page.evaluate(() =>
    new Promise<void>((resolve) => {
      if (!document.querySelector('[data-booking-cta]')) {
        resolve();
        return;
      }

      const availability = document.documentElement.dataset.bookingAvailable;
      if (availability === 'true' || availability === 'false') {
        resolve();
        return;
      }

      document.addEventListener('denart-booking-availability-ready', () => resolve(), {
        once: true,
      });
    }),
  );
}

export async function expectBookNowDisabled(page: Page): Promise<void> {
  const bookNowButtons = page.getByRole('button', { name: /Book Now/i });
  const count = await bookNowButtons.count();

  expect(count, 'Expected at least one Book Now button on class page').toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    await expect(bookNowButtons.nth(i)).toBeDisabled();
    await expect(bookNowButtons.nth(i)).toHaveAttribute('aria-disabled', 'true');
  }

  await expect(page.locator('html')).toHaveAttribute('data-booking-available', 'false');
  await expect(page.locator('#checkout-widget-modal')).toHaveClass(/hidden/);

  await page.evaluate(() => {
    if (typeof window.openCheckoutWidgetModal === 'function') {
      window.openCheckoutWidgetModal();
    }
  });

  await expect(page.locator('#checkout-widget-modal')).toHaveClass(/hidden/);
}

export async function expectBookNowEnabled(page: Page): Promise<void> {
  const bookNowButtons = page.getByRole('button', { name: /Book Now/i });
  const count = await bookNowButtons.count();

  expect(count, 'Expected at least one Book Now button on class page').toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    await expect(bookNowButtons.nth(i)).toBeEnabled();
  }

  await expect(page.locator('html')).toHaveAttribute('data-booking-available', 'true');
}
