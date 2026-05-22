import { isUpcomingPretixDate } from '../utils/pretix-events';

const BOOKING_CTA_SELECTOR = '[data-booking-cta]';

function applyScheduleVisibility(schedule: HTMLElement): boolean {
  const slots = schedule.querySelectorAll<HTMLElement>('[data-pretix-slot]');
  let visibleCount = 0;

  slots.forEach((slot) => {
    const rawDate = slot.dataset.rawDate;
    const show = rawDate ? isUpcomingPretixDate(rawDate) : false;
    slot.hidden = !show;
    if (show) visibleCount += 1;
  });

  const grid = schedule.querySelector<HTMLElement>('.pretix-schedule-grid');
  const empty = schedule.querySelector<HTMLElement>('.pretix-schedule-empty');
  const viewAll = schedule.querySelector<HTMLElement>('.pretix-schedule-view-all');
  const hasUpcoming = visibleCount > 0;

  if (grid) grid.hidden = !hasUpcoming;
  if (viewAll) viewAll.hidden = !hasUpcoming;
  if (empty) empty.hidden = hasUpcoming;

  schedule.dataset.hasUpcoming = hasUpcoming ? 'true' : 'false';
  return hasUpcoming;
}

function applyCalendarVisibility(wrapper: HTMLElement): void {
  const articles = wrapper.querySelectorAll<HTMLElement>('[data-pretix-day]');

  articles.forEach((article) => {
    const slots = article.querySelectorAll<HTMLElement>('[data-pretix-slot]');
    let visibleCount = 0;

    slots.forEach((slot) => {
      const rawDate = slot.dataset.rawDate;
      const show = rawDate ? isUpcomingPretixDate(rawDate) : false;
      slot.hidden = !show;
      if (show) visibleCount += 1;
    });

    article.hidden = visibleCount === 0;
  });

  const empty = wrapper.querySelector<HTMLElement>('.calendar-empty');
  const grid = wrapper.querySelector<HTMLElement>('.calendar-grid');
  const hasVisibleDays =
    Array.from(articles).some((article) => !article.hidden) ||
    (grid?.querySelector('[data-pretix-slot]:not([hidden])') ?? null) != null;

  if (grid) grid.hidden = !hasVisibleDays;
  if (empty) empty.hidden = hasVisibleDays;
}

function setBookingCtasEnabled(enabled: boolean): void {
  document.querySelectorAll<HTMLButtonElement>(BOOKING_CTA_SELECTOR).forEach((button) => {
    button.disabled = !enabled;
    button.setAttribute('aria-disabled', String(!enabled));
    if (!enabled) {
      button.title = 'No upcoming dates scheduled';
    } else {
      button.removeAttribute('title');
    }
  });

  document.documentElement.dataset.bookingAvailable = enabled ? 'true' : 'false';
}

function pageHasUpcomingFromSchedules(): boolean {
  const schedules = document.querySelectorAll<HTMLElement>('.pretix-schedule');
  if (schedules.length === 0) return false;

  return Array.from(schedules).some((schedule) => {
    if (schedule.dataset.hasUpcoming === 'true') return true;
    return (
      schedule.querySelector('[data-pretix-slot]:not([hidden])') !== null
    );
  });
}

export function initPretixScheduleFilters(): void {
  document.querySelectorAll<HTMLElement>('.pretix-schedule').forEach(applyScheduleVisibility);
  document.querySelectorAll<HTMLElement>('.calendar-wrapper').forEach(applyCalendarVisibility);

  const hasBookingCtas = document.querySelector(BOOKING_CTA_SELECTOR) !== null;
  if (hasBookingCtas) {
    setBookingCtasEnabled(pageHasUpcomingFromSchedules());
  }

  document.dispatchEvent(new CustomEvent('denart-booking-availability-ready'));
}

let initialized = false;

function runWhenReady(): void {
  if (initialized) return;
  initialized = true;
  initPretixScheduleFilters();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runWhenReady);
} else {
  runWhenReady();
}
