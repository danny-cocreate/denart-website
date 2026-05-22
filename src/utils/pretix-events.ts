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
