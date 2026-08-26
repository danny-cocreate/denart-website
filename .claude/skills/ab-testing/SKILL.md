---
name: ab-testing
description: >
  A/B testing system for denartny.com. Use this skill whenever D wants to: start a new experiment
  ("let's test a new headline", "set up an A/B test for the landing page"), check experiment
  results ("how's the test going", "is variant B winning", "check the A/B results", "should we
  ship the new version"), or conclude and ship a winner ("declare B the winner", "ship the new
  CTA", "end the experiment"). Also triggers automatically every 2 weeks from the scheduled review
  task. Covers the full lifecycle: experiment setup, GA4 data pull, statistical significance
  analysis, and shipping the winner to the codebase.
---

# A/B Testing — DenArt Landing Page

This skill manages the full lifecycle of conversion experiments on denartny.com: designing
the test, tracking variant assignment, pulling GA4 results, running statistical significance
checks, and shipping the winner.

## Infrastructure overview

Variant assignment happens via a tiny inline cookie script baked into `BaseLayout.astro`.
It runs synchronously before any other JS (right after the WKWebView polyfill), assigns every
visitor to variant A or B once per experiment, stores the assignment in a cookie + localStorage,
and exposes `window.__AB_VARIANT` for the rest of the page. GA4 receives the variant as a
user property (`ab_variant`) and an event (`ab_variant_assigned`), so every subsequent funnel
event carries the variant segmentation.

The active experiment is defined in `experiments.json` at the root of the Astro project. All
review scripts read this file to know what's running and what metric to measure.

Key paths on D's Mac:
- Astro project: `/Users/cocreatebot/projects/denart-website/`
- `experiments.json`: `/Users/cocreatebot/projects/denart-website/experiments.json`
- Review script: `/Users/cocreatebot/projects/denart-website/ab_review.py` (written fresh each run)

## The three modes

---

### MODE 1 — SETUP: Start a new experiment

Trigger: D wants to run a new test. May or may not have the hypothesis already formed.

**Step 1 — Define the experiment.** Ask (or infer from context):
- What element is being tested? (headline, CTA copy, hero image, social proof position, etc.)
- What is variant B? (Describe concretely — what changes from the control.)
- What is the primary success metric? Default to `begin_checkout` unless D says otherwise.
  Other options: `date_selected`, `form_start`. Don't use `purchase` as primary — too few events.
- Which page? Default to `/classes/uv-body-paint-couples`.

**Step 2 — Check if GA4 custom dimension exists.** The review script needs `ab_variant` registered
as a custom dimension in GA4 admin. First time only — check `experiments.json` for
`"ga4_dimension_ready": true`. If not set, tell D:

> "One-time setup needed: go to GA4 → Admin → Property → Custom Definitions → Custom Dimensions →
> Create. Name: `ab_variant`, Scope: Event, Event parameter: `ab_variant`. Once done, let me know
> and I'll mark it as ready in experiments.json."

Don't proceed to deployment until D confirms this is done.

**Step 3 — Create the experiment entry.** Write to `experiments.json`:
```json
{
  "ga4_dimension_ready": true,
  "active_experiment": {
    "id": "exp-001",
    "name": "Short descriptive name",
    "page": "/classes/uv-body-paint-couples",
    "start_date": "YYYY-MM-DD",
    "target_metric": "begin_checkout",
    "secondary_metrics": ["date_selected", "form_start"],
    "min_days": 14,
    "variant_a_desc": "Control: [describe current state]",
    "variant_b_desc": "Test: [describe what's different]"
  },
  "completed_experiments": []
}
```

Use today's date for `start_date`. Increment `id` from any existing completed experiments.

**Step 4 — Update the EXPERIMENT_ID in BaseLayout.astro.** Find the A/B inline script block
(look for `EXPERIMENT_ID`) and update it to match the new experiment's `id`. The EXPERIMENT_ID
being non-empty activates variant assignment for all visitors.

**Step 5 — Remind D to add the variant B markup.** The content changes live in the target page's
Astro component. Read `references/setup_guide.md` for the exact CSS pattern and where to add it.

**Step 6 — Confirm and push.** Once the page markup is ready, remind D to push to main so
GitHub Actions deploys it.

---

### MODE 2 — REVIEW: Analyze experiment results

Trigger: Scheduled task (every 2 weeks) or D asks about the experiment.

**Step 1 — Read `experiments.json`** to get the active experiment's `id`, `start_date`,
`target_metric`, and `min_days`.

**Step 2 — Write and run `ab_review.py`** on D's Mac via Desktop Commander:
```bash
cd /Users/cocreatebot/projects/denart-website && \
export GOOGLE_APPLICATION_CREDENTIALS=~/Desktop/denart-analytics-key.json && \
python3 ab_review.py > ab_review_output.csv 2>&1
```

Use the script template in `scripts/ab_review.py`. Customize `EXPERIMENT_ID`, `START_DATE`,
and `TARGET_METRIC` from `experiments.json`.

**Step 3 — Read the output** and interpret results. The script prints a plain-text summary
block at the end — read that first. It includes:
- Sample sizes (n_A, n_B)
- Conversion rates (p_A, p_B)
- Relative lift (%)
- p-value and significance threshold
- Recommendation: "Keep running", "Declare winner", or "Inconclusive / consider resetting"

**Step 4 — Report to D.** Use this structure:

```
Experiment: [name] — Day [N] of [min_days]+ 

Variant A (control): X% [metric] rate (N users)
Variant B (test):    Y% [metric] rate (N users)
Lift: +Z% relative

[p-value interpretation — one sentence]

Recommendation: [Keep running / Ship B / Inconclusive]
[If keeping running: estimated X more days to reach significance at current traffic]
[If shipping: "Variant B is the clear winner — ready to ship whenever you want."]
```

Keep it tight. D is running a studio, not writing a stats paper.

**Step 5 — If minimum days not reached,** state that and sign off. No recommendation yet.
Re-check at the next scheduled interval.

---

### MODE 3 — SHIP: Deploy the winner

Trigger: D says to ship, or review mode finds significance and D approves.

**Step 1 — Read `experiments.json`** to confirm which variant won.

**Step 2 — Make the winner the permanent default** in the target page's Astro component:
- If B won: remove all `ab-A`-specific CSS/HTML, make B's content the default, remove the
  `.ab-B` conditional wrapper.
- If A won (B failed): simply remove all variant B markup and the `.ab-B` CSS rules.
- Leave no A/B conditional logic in the file — the page should be clean after shipping.

**Step 3 — Clear the experiment in BaseLayout.astro.** Set `EXPERIMENT_ID = ''` in the inline
script. This stops variant assignment without removing the infrastructure.

**Step 4 — Archive the experiment.** Move `active_experiment` to `completed_experiments` in
`experiments.json`, adding `end_date`, `winner`, and the final conversion rates.

**Step 5 — Remind D to push to main.**

---

## experiments.json schema

```json
{
  "ga4_dimension_ready": false,
  "active_experiment": null,
  "completed_experiments": [
    {
      "id": "exp-001",
      "name": "Landing page headline copy",
      "page": "/classes/uv-body-paint-couples",
      "start_date": "2026-04-28",
      "end_date": "2026-05-19",
      "target_metric": "begin_checkout",
      "variant_a_desc": "Control: 'Paint in the Dark UV Class'",
      "variant_b_desc": "Test: 'Only 8 spots left — Book Now'",
      "winner": "B",
      "final_rates": { "A": 0.042, "B": 0.061 },
      "p_value": 0.031
    }
  ]
}
```

## Reference files

- `references/setup_guide.md` — full walkthrough for adding variant B markup to an Astro page,
  the CSS pattern, and how to thread the variant through to the checkout widget URL
- `scripts/ab_review.py` — GA4 pull + significance test template
