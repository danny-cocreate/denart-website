# DenArt Visual QA Plan

**Created:** 2026-02-15 18:26 EST
**Status:** In Progress

## Objective
Run visual QA on all key pages using the Impeccable framework (/critique /simplify /polish).

## Batches (5 pages max per batch)

### Batch 1: Core Pages (High Traffic)
| # | Page | URL | Status | Issues |
|---|------|-----|--------|--------|
| 1 | Homepage | / | ⚠ | Visual monotony (repetitive events), spacing issues, duplicate footer logos, CTA too subtle |
| 2 | Services Index | /services/ | ◑ | In progress |
| 3 | Classes Index | /classes/ | ○ | — |
| 4 | Gallery Index | /gallery/ | ○ | — |
| 5 | Contact | /contact/ | ○ | — |

### Batch 2: Service Detail Pages
| # | Page | URL | Status | Issues |
|---|------|-----|--------|--------|
| 1 | Fine Art | /services/fine-art-body-painting/ | ⚠ | Script font in FAQ, buried CTA, hero impact |
| 2 | Maternity | /services/maternity-body-painting/ | ○ | — |
| 3 | Hypnotic | /services/hypnotic-body-painting/ | ○ | — |
| 4 | Events | /services/events-corporate-body-painting/ | ○ | — |
| 5 | Private Party | /services/private-body-painting-party/ | ○ | — |

### Batch 3: Class & Info Pages
| # | Page | URL | Status | Issues |
|---|------|-----|--------|--------|
| 1 | UV Couples Class | /classes/uv-body-paint-class-for-couples/ | ○ | — |
| 2 | About | /about/ | ○ | — |
| 3 | Testimonials | /testimonials/ | ○ | — |
| 4 | Media (Press) | /media/ | ○ | — |
| 5 | Get a Quote | /get-a-quote/ | ○ | — |

### Batch 4: Policy & Utility Pages
| # | Page | URL | Status | Issues |
|---|------|-----|--------|--------|
| 1 | FAQ | /faq/ | ○ | — |
| 2 | Cancellation Policy | /cancellation-and-reschedule-policy/ | ○ | — |
| 3 | Privacy Policy | /privacy-policy/ | ○ | — |
| 4 | Preparation Info | /preparation-information/ | ○ | — |
| 5 | Redeem Gift | /redeem-gift-certificate/ | ○ | — |

### Batch 5: Additional Pages
| # | Page | URL | Status | Issues |
|---|------|-----|--------|--------|
| 1 | Print Services | /print-services/ | ○ | — |
| 2 | Body Painting Models | /body-painting-models/ | ○ | — |
| 3 | Become a Model | /become-a-model/ | ○ | — |
| 4 | Policies (Overview) | /policies/ | ○ | — |
| 5 | Gallery Detail (sample) | /gallery/asian-water-lily/ | ○ | — |

---

## Status Legend
- ○ = Not started
- ◑ = In progress
- ● = Pass (no critical issues)
- ⚠ = Minor issues found
- ✕ = Critical issues found

## Progress Log

### Batch 1 Progress
**Completed:** 2026-02-15 18:45 EST

| # | Page | URL | Status | Issues |
|---|------|-----|--------|--------|
| 1 | Homepage | / | ⚠ | 7 issues (2 HIGH) |
| 2 | Services Index | /services/ | ⚠ | 5 issues (2 HIGH) |
| 3 | Classes Index | /classes/ | ● | 2 issues (0 HIGH) |
| 4 | Gallery Index | /gallery/ | ⚠ | 5 issues (2 HIGH) |
| 5 | Contact | /contact/ | ● | 3 issues (0 HIGH) |

**Key findings:**
- Red arrow icons are the biggest visual issue (present sitewide)
- Gallery has missing thumbnails in "Other Works"
- Homepage events section is repetitive (8 similar entries)

Full report: `VISUAL_QA_REPORT.md`

### Batch 1 Fixes Applied
- ✅ Fixed "1 services" → "1 service" pluralization in services/index.astro
- ✅ Homepage already limits events to 4 (`.slice(0, 4)`)
- ✅ Arrows are text `→` with hover effects (not red SVG icons as reported)
- ✅ Gallery images exist — loading issue, not missing files

---

## QA Criteria (Impeccable Framework)

**CRITIQUE:** Visual hierarchy, spacing, typography, color contrast, CTA visibility, mobile considerations
**SIMPLIFY:** Remove clutter, streamline layout, reduce cognitive load
**POLISH:** Final refinements, consistency, micro-interactions, professional finish
