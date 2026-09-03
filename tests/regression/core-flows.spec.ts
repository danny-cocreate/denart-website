import { expect, test } from '@playwright/test';

test('homepage renders with primary CTA', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { level: 1, name: /Manifestation, through body painting/i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Book a Session/i }).first()).toBeVisible();
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

test('wish-fulfilled booking hides the design field', async ({ page }) => {
  await page.goto('/schedule-a-session?service=embodied-manifestation');

  await expect(page.locator('#schedule-design-wrap')).toBeHidden();

  await page.selectOption('#schedule-session-type', {
    label: 'Fine Art Body Painting',
  });
  await expect(page.locator('#schedule-design-wrap')).toBeVisible();

  await page.selectOption('#schedule-session-type', {
    label: 'Embodied Manifestation — The Wish-Fulfilled Session',
  });
  await expect(page.locator('#schedule-design-wrap')).toBeHidden();
});

test('wish-fulfilled page copy and booking funnel', async ({ page }) => {
  await page.goto('/services/embodied-manifestation');

  await expect(
    page.getByRole('heading', { level: 1, name: /Manifestation that finally feels real/i }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Request a session/i }).first()).toBeVisible();
  await expect(page.getByText(/coverage is your call/i).first()).toBeVisible();
  await expect(page.getByText(/This isn't therapy or medical care/i)).toBeVisible();
  await expect(page.getByText(/sit alongside professional support/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Mark this chapter/i })).toBeVisible();
  await expect(page.getByText(/Become her/i)).toHaveCount(0);
  await expect(page.getByText(/Probably not for you if/i)).toHaveCount(0);

  await page.getByRole('link', { name: /Request a session/i }).first().click();
  await expect(page).toHaveURL(/schedule-a-session\?service=embodied-manifestation/);
  await expect(page.locator('#schedule-session-type')).toHaveValue('Wish-Fulfilled Session');
  await expect(page.locator('#schedule-design-wrap')).toBeHidden();
  await expect(page.getByPlaceholder(/Van Gogh/i)).toBeHidden();
});

