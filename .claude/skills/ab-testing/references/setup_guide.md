# A/B Test Setup Guide — Step by Step

This guide covers everything needed to add variant B markup to an Astro page,
thread the variant through to the checkout widget, and verify things are wired
up correctly before going live.

---

## Part 1 — One-time infrastructure (already done after initial setup)

The following is already in `src/layouts/BaseLayout.astro` after initial setup.
No need to touch it for each new experiment — just update the `EXPERIMENT_ID`.

```html
<!-- A/B testing — variant assignment -->
<script is:inline>
  (function() {
    try {
      var EXPERIMENT_ID = '';  // Set to the active experiment id, e.g. 'exp-001'
      if (!EXPERIMENT_ID) return;

      var storageKey = 'ab_' + EXPERIMENT_ID;
      var v = null;

      // Try cookie first (more reliable in IG in-app browser)
      document.cookie.split(';').forEach(function(c) {
        var kv = c.trim().split('=');
        if (kv[0] === storageKey) v = kv[1];
      });

      // Fall back to localStorage
      if (!v) {
        try { v = localStorage.getItem(storageKey); } catch(e) {}
      }

      // Assign if no valid assignment found
      if (v !== 'A' && v !== 'B') {
        v = Math.random() < 0.5 ? 'A' : 'B';
        var exp = new Date();
        exp.setDate(exp.getDate() + 30);
        document.cookie = storageKey + '=' + v + '; expires=' + exp.toUTCString() + '; path=/; SameSite=Lax';
        try { localStorage.setItem(storageKey, v); } catch(e) {}
      }

      // Apply to DOM + expose globally
      document.documentElement.classList.add('ab-' + v);
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ ab_variant: v, ab_experiment: EXPERIMENT_ID });
      window.__AB_VARIANT = v;
      window.__AB_EXPERIMENT = EXPERIMENT_ID;

    } catch(e) {} // Fail silently — never crash the page
  })();
</script>
```

And this addition to the GA4 config block (fires the GA4 user property + event):
```javascript
// Inside the existing GA4 init block, after gtag('config', ...)
if (window.__AB_VARIANT) {
  gtag('set', { 'user_properties': { 'ab_variant': window.__AB_VARIANT } });
  gtag('event', 'ab_variant_assigned', {
    ab_variant: window.__AB_VARIANT,
    ab_experiment: window.__AB_EXPERIMENT
  });
}
```

---

## Part 2 — GA4 custom dimension (one-time, first experiment only)

Before the review script can query `ab_variant` from the GA4 Data API, it must
be registered as a custom dimension:

1. GA4 → Admin → Property → Custom Definitions → **Custom Dimensions**
2. Click **Create custom dimension**
3. Name: `ab_variant`
4. Scope: **Event**
5. Event parameter: `ab_variant`
6. Save

Once created, set `"ga4_dimension_ready": true` in `experiments.json`.

Note: GA4 custom dimensions take up to 24 hours to backfill. Start the
experiment at least 1 day before expecting to see variant data in the API.

---

## Part 3 — Adding variant B markup to a page

### The CSS pattern

All variant-specific content uses the `.ab-A` and `.ab-B` classes on `<html>`
(applied by the inline script). The default state (no JS / script blocked) should
always show variant A (the control). So:

```css
/* global.css — add to the A/B testing section */

/* Variant B content: hidden by default, shown when B is active */
.ab-variant-b-only { display: none; }
html.ab-B .ab-variant-b-only { display: block; }

/* Variant A content: shown by default, hidden when B is active */
html.ab-B .ab-variant-a-only { display: none; }
```

### In the Astro component

```astro
<!-- VARIANT A (control) — visible by default -->
<section class="ab-variant-a-only">
  <h1>Paint in the Dark UV Class</h1>
  <p>A couples body painting experience unlike anything else.</p>
</section>

<!-- VARIANT B (test) — hidden until JS assigns variant B -->
<section class="ab-variant-b-only">
  <h1>Only 8 Spots Left — Book Your Date Night</h1>
  <p>NYC's most unique couples experience. Don't miss it.</p>
</section>
```

Keep both sections as close together in the markup as possible. Avoid large
blocks of hidden HTML — if the variant changes an entire section, that's fine,
but don't duplicate the entire page layout.

### Inline style override (if Tailwind classes cause conflicts)

If Tailwind's utility classes override the CSS rules, use inline style as fallback:

```astro
<section class="ab-variant-b-only" style="display: none;">
  ...
</section>
```

The `.ab-B` class added to `<html>` will override this via the CSS rule.

---

## Part 4 — Passing the variant to the checkout widget

The checkout widget at `checkout.denartny.com` is embedded via an iframe or
redirect. To pass the variant, append it to the checkout URL so GA4 can
attribute purchases by variant.

Find where the checkout URL is constructed in the landing page component
(look for `checkout.denartny.com`) and add a JS snippet:

```javascript
// After page load, append variant to all checkout links
document.addEventListener('DOMContentLoaded', function() {
  var variant = window.__AB_VARIANT;
  if (!variant) return;
  document.querySelectorAll('a[href*="checkout.denartny.com"]').forEach(function(a) {
    var url = new URL(a.href);
    url.searchParams.set('abv', variant);
    a.href = url.toString();
  });
});
```

On the checkout widget side (`Checkout-flow` React app), read it from the URL:
```javascript
const abVariant = new URLSearchParams(window.location.search).get('abv');
if (abVariant) {
  gtag('set', { 'user_properties': { 'ab_variant': abVariant } });
}
```

This ensures that if a user converts (purchase event on checkout.denartny.com),
the variant is attached to their GA4 session.

---

## Part 5 — Pre-launch checklist

Before pushing:
- [ ] `EXPERIMENT_ID` in BaseLayout.astro matches the `id` in `experiments.json`
- [ ] `experiments.json` has today's date in `start_date`
- [ ] Both variant A and variant B markup exist on the target page
- [ ] `ab-variant-a-only` and `ab-variant-b-only` CSS rules are in `global.css`
- [ ] GA4 custom dimension `ab_variant` is registered (if this is the first experiment)
- [ ] Verified locally: open the page, check DevTools console for `ab_variant_assigned` event
- [ ] Verify variant switching: in DevTools console, run `document.documentElement.classList.replace('ab-A', 'ab-B')` — variant B content should appear

---

## Part 6 — Ending an experiment

When shipping the winner:

1. In the target Astro page, remove both `ab-variant-a-only` and `ab-variant-b-only` wrappers.
   Whichever variant won becomes the permanent markup.
2. Remove the corresponding CSS rules from `global.css`.
3. In `BaseLayout.astro`, set `EXPERIMENT_ID = ''` (blank string). This deactivates assignment
   without removing the infrastructure for future experiments.
4. Move `active_experiment` to `completed_experiments` in `experiments.json` with the final
   results filled in.
5. Push to main.
