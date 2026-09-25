import { expect, test } from '@playwright/test';

test('calendar lists each event type when two classes share a date', async ({ page }) => {
  await page.goto('/calendar');

  const day = page.locator('[data-pretix-day]').first();
  await expect(day).toBeVisible();
  await expect(day.getByRole('heading', { name: 'Speed Friending' })).toBeVisible();
  await expect(day.getByRole('heading', { name: 'UV Class for Couples' })).toBeVisible();

  const groups = day.locator('[data-pretix-event-group]:not([hidden])');
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0).getByRole('heading', { name: 'Speed Friending' })).toBeVisible();
  await expect(groups.nth(0).getByText('6:00 pm', { exact: true })).toBeVisible();
  await expect(groups.nth(1).getByRole('heading', { name: 'UV Class for Couples' })).toBeVisible();
  await expect(groups.nth(1).getByText('8:30 pm', { exact: true })).toBeVisible();
  await expect(day.getByText(/\d:\d{2}\s*[ap]m\s*-\s*\d/i)).toHaveCount(0);
});
