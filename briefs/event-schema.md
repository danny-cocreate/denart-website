# Brief: Add Event Schema Markup to denartny.com Event Pages

## Status
- **Status:** in-progress
- **Assigned Agent:** coder
- **Created:** 2026-02-21

## Objective
Add JSON-LD Event schema markup to all event pages on denartny.com and submit the sitemap to Google Search Console.

## Requirements

### 1. Add Event Schema to Event Pages
- [ ] Modify `/src/pages/events/[slug].astro` to include JSON-LD Event schema
- [ ] Use schema.org Event type with available fields:
  - `@context`: "https://schema.org"
  - `@type`: "Event"
  - `name`: event.data.title
  - `description`: From event body (first 150 chars of Content)
  - `startDate`: Extract from event.data.date if parseable
  - `image`: From event.data.images[0].src if available
  - `url`: Current page URL
- [ ] Inject schema via `<script type="application/ld+json">` in the `<head>`

### 2. Rebuild Site & Sitemap
- [ ] Run build to generate updated pages with schema
- [ ] Ensure sitemap includes event pages (check `src/pages/events/[slug].astro` generates proper paths)
- [ ] Verify sitemap.xml in dist/ includes /events/* pages

### 3. Submit Sitemap
- [ ] Submit updated sitemap to Google Search Console
- Sitemap URL: https://denartny.com/sitemap-index.xml

## Context
- **Site:** denartny.com (Astro static site)
- **Location:** `/Users/cocreatebot/projects/denart-website/`
- **Event data structure:** See `src/content/config.ts` - events collection has: title, date, images[]

## Deliverable
- Event schema markup added to all event pages
- Sitemap rebuilt with event pages
- Sitemap submitted to Google

## Notes
- The site uses Astro content collections for events
- Event pages are at `/events/[slug]` 
- 41 event files exist in `src/content/events/`
