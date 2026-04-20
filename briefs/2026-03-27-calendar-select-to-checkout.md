# Brief: Calendar Select → Pre-Open Checkout Widget

**Date:** 2026-03-27
**Status:** in-progress
**Assigned Agent:** coder

## Objective
When user clicks "Select" on a date/time in the calendar, navigate to the event landing page AND automatically open the checkout widget with the selected date/time pre-selected.

## Current Behavior
- CalendarGrid.astro shows events with "Select" buttons
- Clicking "Select" goes to `event.pageUrl` (e.g., `/classes/uv-body-paint-couples`)
- Landing page has "Book Now" button that opens checkout widget, but user must select date again

## Required Behavior

### 1. CalendarGrid.astro (or wherever the Select link is generated)
- When generating the "Select" link for each event, append the subevent ID as a URL query parameter
- Format: `{pageUrl}?subevent={event.id}`
- Example: `/classes/uv-body-paint-couples?subevent=49`

### 2. classes/[slug].astro (landing page)
- On page load, check for `subevent` query parameter in URL
- If `subevent` param exists, automatically call `openCheckoutWidgetModal(subeventId)` after page loads
- This should happen without requiring any user interaction

## Technical Notes
- CheckoutWidgetModal.astro already supports passing subevent ID: `openCheckoutWidgetModal(subeventId)` appends it as `&subevent={id}` to the iframe src
- The iframe will handle pre-selecting the date/time internally

## Acceptance Criteria
1. Clicking "Select" on calendar → lands on event page with checkout already open
2. The correct date/time is pre-selected in the checkout widget
3. User can still close and reopen checkout normally if needed
4. No regression: pages without `?subevent=` param work exactly as before