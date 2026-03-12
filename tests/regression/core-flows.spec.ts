import { expect, test } from '@playwright/test';

test('homepage renders with primary CTA', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: /Body painting/i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Book Private Session/i })).toBeVisible();
});

test('quote page loads with quote form', async ({ page }) => {
  await page.goto('/get-a-quote');

  await expect(page.getByRole('heading', { name: /Get a Quote/i })).toBeVisible();
  await expect(page.locator('#quote-form')).toBeVisible();
});

test('quote form can be submitted successfully', async ({ page }) => {
  await page.goto('/get-a-quote');

  await page.fill('#name', 'Regression Test User');
  await page.fill('#email', 'regression+quote@example.com');
  await page.selectOption('#service', 'fine-art');
  await page.fill('#details', 'Automated regression test submission.');
  await page.getByRole('button', { name: /Request Quote/i }).click();

  await expect(page.locator('#form-status')).toBeVisible();
  await expect(page.locator('#form-status')).toContainText(/quote request sent successfully/i);
});

test('schedule form can be submitted successfully', async ({ page }) => {
  await page.goto('/schedule-a-session');

  await page.fill('#schedule-name', 'Regression Test User');
  await page.fill('#schedule-email', 'regression+schedule@example.com');
  await page.selectOption('#schedule-session-type', {
    label: 'Fine Art Body Painting',
  });
  await page.fill('#schedule-date1', '2030-12-01');
  await page.click('#schedule-submit-btn');

  await expect(page.locator('#schedule-message')).toBeVisible();
  await expect(page.locator('#schedule-message')).toContainText(/we'll be in touch soon/i);
});

test('class page book now opens checkout modal', async ({ page }) => {
  await page.goto('/classes/uv-body-paint-couples');
  await page.getByRole('button', { name: /Book Now/i }).first().click();

  await expect(page.locator('#checkout-widget-modal')).toBeVisible();
});

test('checkout modal iframe targets checkout app', async ({ page }) => {
  await page.goto('/classes/uv-body-paint-couples');
  await page.getByRole('button', { name: /Book Now/i }).first().click();

  const iframe = page.locator('#checkout-widget-iframe');
  await expect(iframe).toBeVisible();
  await expect(iframe).toHaveAttribute('src', /checkout\.denartny\.com/);
});
