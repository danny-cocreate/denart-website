/**
 * Pre-build guard: refuses to build when class dates can't be fetched.
 *
 * Pages get their dates from Pretix (or the checkout bridge as a fallback) at
 * build time, and a failed fetch quietly renders a page with no dates and a
 * disabled Book button. On 2026-10-23 both hosts were unreachable from the
 * GitHub runner and the build produced exactly that, 90 minutes later. This
 * check fails in seconds instead, so a deploy never publishes dateless pages.
 *
 * Each slug passes if either source answers. "No upcoming dates" is a valid
 * answer; only an unreachable or erroring source fails.
 *
 * Skipped for E2E runs (mock dates) and with SKIP_PRETIX_CHECK=true.
 *
 * Run: node scripts/check-pretix-dates.mjs
 */

const PRETIX_API_BASE = 'https://tickets.denartny.com/api/v1/organizers/denart-studio';
const CHECKOUT_API = 'https://checkout.denartny.com/api/sessions';
// Keep in step with DEFAULT_EVENT_SLUGS / SLUG_TO_CHECKOUT_EVENT in src/utils/pretix.ts
const DEFAULT_EVENT_SLUGS = ['uc-class-couples-2', 'speed-friending'];
const SLUG_TO_CHECKOUT_EVENT = {
  'uc-class-couples-2': 'paint-in-the-dark',
  'speed-friending': 'speed-friending',
};
const TIMEOUT_MS = 15000;

if (process.env.E2E_TEST_MODE === 'true' || process.env.SKIP_PRETIX_CHECK === 'true') {
  console.log('check-pretix-dates: skipped');
  process.exit(0);
}

const slugs = (process.env.PRETIX_EVENT_SLUGS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const eventSlugs = slugs.length ? slugs : DEFAULT_EVENT_SLUGS;

async function tryPretix(slug) {
  const token = process.env.PRETIX_API_TOKEN;
  if (!token) return 'no PRETIX_API_TOKEN';
  try {
    const res = await fetch(`${PRETIX_API_BASE}/events/${slug}/subevents/`, {
      headers: { Authorization: `Token ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return `HTTP ${res.status}`;
    const data = await res.json();
    return Array.isArray(data.results) ? null : 'unexpected response';
  } catch (err) {
    return err?.cause?.code || err?.name || String(err);
  }
}

async function tryCheckout(slug) {
  const eventKey = SLUG_TO_CHECKOUT_EVENT[slug];
  if (!eventKey) return 'no checkout event for this slug';
  try {
    const res = await fetch(`${CHECKOUT_API}?event=${encodeURIComponent(eventKey)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return `HTTP ${res.status}`;
    const data = await res.json();
    return data.status === 'success' && Array.isArray(data.sessions) ? null : 'unexpected response';
  } catch (err) {
    return err?.cause?.code || err?.name || String(err);
  }
}

const failures = [];
await Promise.all(
  eventSlugs.map(async (slug) => {
    const pretixError = await tryPretix(slug);
    if (!pretixError) return;
    const checkoutError = await tryCheckout(slug);
    if (!checkoutError) return;
    failures.push(`${slug}: Pretix ${pretixError}; checkout bridge ${checkoutError}`);
  }),
);

if (failures.length) {
  console.error('check-pretix-dates: cannot fetch class dates, refusing to build pages without them.');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`check-pretix-dates: dates reachable for ${eventSlugs.join(', ')}`);
