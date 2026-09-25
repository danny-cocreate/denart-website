/** Returns true if the Pretix subevent start is still in the future (client or server). */
export function isUpcomingPretixDate(rawDate: string, now: Date = new Date()): boolean {
  const eventDate = new Date(rawDate);
  return !Number.isNaN(eventDate.getTime()) && eventDate > now;
}

export function filterUpcomingPretixDates<T extends { rawDate: string }>(
  events: T[],
  now: Date = new Date(),
): T[] {
  return events.filter((event) => isUpcomingPretixDate(event.rawDate, now));
}

export type CalendarEventGroup<T extends { slug: string }> = {
  slug: string;
  events: T[];
};

export type CalendarDay<T extends { dateStr: string; slug: string }> = {
  dateStr: string;
  eventGroups: CalendarEventGroup<T>[];
};

/** Group upcoming events by local date, then by Pretix slug so shared nights stay labeled. */
export function groupPretixEventsForCalendar<
  T extends { dateStr: string; slug: string },
>(events: T[]): CalendarDay<T>[] {
  const byDate = new Map<string, T[]>();

  for (const event of events) {
    const dayEvents = byDate.get(event.dateStr) ?? [];
    dayEvents.push(event);
    byDate.set(event.dateStr, dayEvents);
  }

  return Array.from(byDate.entries()).map(([dateStr, dayEvents]) => {
    const bySlug = new Map<string, T[]>();
    for (const event of dayEvents) {
      const slugEvents = bySlug.get(event.slug) ?? [];
      slugEvents.push(event);
      bySlug.set(event.slug, slugEvents);
    }

    return {
      dateStr,
      eventGroups: Array.from(bySlug.entries()).map(([slug, slugEvents]) => ({
        slug,
        events: slugEvents,
      })),
    };
  });
}
