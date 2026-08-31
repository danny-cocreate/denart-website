/**
 * DenArt Pretix Integration
 * Fetches events from the Pretix ticketing API
 */

import { isUpcomingPretixDate } from './pretix-events';

const PRETIX_API_BASE = 'https://tickets.denartny.com/api/v1/organizers/denart-studio';
const DEFAULT_EVENT_SLUGS = [
  'uc-class-couples-2',
  'speed-friending',
];

// Default event slugs can be overridden via env var (comma-separated)
function getEventSlugs(): string[] {
  const envSlugs = import.meta.env.PRETIX_EVENT_SLUGS;
  if (envSlugs) {
    return envSlugs.split(',').map((s: string) => s.trim());
  }
  return DEFAULT_EVENT_SLUGS;
}

/**
 * Fetch subevents for a specific event slug
 */
export async function fetchSubeventsForSlug(slug: string): Promise<PretixEvent[]> {
  if (isE2ETestMode()) {
    return getE2EUpcomingSlugs().has(slug) ? getE2EMockSubevents(slug) : [];
  }

  const token = import.meta.env.PRETIX_API_TOKEN;
  
  if (!token) {
    console.error('PRETIX_API_TOKEN not configured');
    return fetchSubeventsFromCheckout(slug);
  }

  const url = `${PRETIX_API_BASE}/events/${slug}/subevents/`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${token}`,
      },
    });

    if (!response.ok) {
      console.error(`Pretix API error for ${slug}:`, response.status);
      return fetchSubeventsFromCheckout(slug);
    }

    const data = await response.json();
    const now = new Date();

    // Filter to only active, future events
    return data.results
      .filter((event: any) => {
        return event.active && isUpcomingPretixDate(event.date_from, now);
      })
      .map((event: any) => {
        const date = new Date(event.date_from);
        const endDate = event.date_to ? new Date(event.date_to) : null;
        
        const tz = 'America/New_York';
        
        // Format: "Fri, Feb 13"
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz });
        const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz });
        const fullDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: tz });
        
        const startTime = date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true,
          timeZone: tz 
        }).toLowerCase();
        
        let timeStr = startTime;
        if (endDate) {
          const endTime = endDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true,
            timeZone: tz 
          }).toLowerCase();
          timeStr = `${startTime} - ${endTime}`;
        }
        
        return {
          id: event.id,
          slug,
          dateStr: `${dayName}, ${monthDay}`,
          fullDate,
          timeStr,
          rawDate: date.toISOString(),
          url: `https://tickets.denartny.com/denart-studio/${slug}/?subevent=${event.id}`,
          pageUrl: SLUG_TO_PAGE[slug] || '/classes/',
        };
      });
  } catch (error) {
    console.error(`Failed to fetch subevents for ${slug}:`, error);
    return fetchSubeventsFromCheckout(slug);
  }
}

/**
 * Event data interface
 */
// Map Pretix slugs to DenArt page URLs
const SLUG_TO_PAGE: Record<string, string> = {
  'uc-class-couples-2': '/classes/uv-body-paint-couples/',
  'speed-friending': '/calendar',
  'uv-body-painting-workshop': '/classes/',
  'private-sessions': '/services/fine-art-body-painting/',
  'couples-body-painting': '/services/body-painting-for-2/',
};

const SLUG_TO_CHECKOUT_EVENT: Record<string, string> = {
  'uc-class-couples-2': 'paint-in-the-dark',
  'speed-friending': 'speed-friending',
};

function formatPretixEvent(
  slug: string,
  id: number | string,
  dateFrom: string,
  dateTo?: string | null,
): PretixEvent {
  const date = new Date(dateFrom);
  const endDate = dateTo ? new Date(dateTo) : null;
  const tz = 'America/New_York';
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz });
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz });
  const fullDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz,
  });
  const startTime = date
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    })
    .toLowerCase();
  let timeStr = startTime;
  if (endDate && endDate.getTime() !== date.getTime()) {
    const endTime = endDate
      .toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: tz,
      })
      .toLowerCase();
    timeStr = `${startTime} - ${endTime}`;
  }
  return {
    id: Number(id),
    slug,
    dateStr: `${dayName}, ${monthDay}`,
    fullDate,
    timeStr,
    rawDate: date.toISOString(),
    url: `https://tickets.denartny.com/denart-studio/${slug}/?subevent=${id}`,
    pageUrl: SLUG_TO_PAGE[slug] || '/classes/',
  };
}

/** Public checkout sessions API — used when the Pretix token is missing. */
async function fetchSubeventsFromCheckout(slug: string): Promise<PretixEvent[]> {
  const eventKey = SLUG_TO_CHECKOUT_EVENT[slug];
  if (!eventKey) return [];

  try {
    const response = await fetch(
      `https://checkout.denartny.com/api/sessions?event=${encodeURIComponent(eventKey)}`,
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (data.status !== 'success' || !Array.isArray(data.sessions)) return [];
    const now = new Date();
    return data.sessions
      .filter((session: { isSoldOut?: boolean; date?: string; startTime?: string }) => {
        const raw = session.startTime || session.date;
        return raw && !session.isSoldOut && isUpcomingPretixDate(raw, now);
      })
      .map((session: { id: string | number; date: string; startTime?: string; endTime?: string }) =>
        formatPretixEvent(slug, session.id, session.startTime || session.date, session.endTime),
      );
  } catch (error) {
    console.error(`Failed to fetch checkout sessions for ${slug}:`, error);
    return [];
  }
}

const E2E_MOCK_SUBEVENT_ID = 90001;
const E2E_MOCK_RAW_DATE = '2030-06-15T22:00:00.000Z';

function isE2ETestMode(): boolean {
  return process.env.E2E_TEST_MODE === 'true';
}

function getE2EUpcomingSlugs(): Set<string> {
  const raw = process.env.E2E_PRETIX_UPCOMING_SLUGS || '';
  return new Set(raw.split(',').map((slug) => slug.trim()).filter(Boolean));
}

/** Stable upcoming subevent for Playwright when slug is listed in E2E_PRETIX_UPCOMING_SLUGS. */
function getE2EMockSubevents(slug: string): PretixEvent[] {
  const date = new Date(E2E_MOCK_RAW_DATE);
  const tz = 'America/New_York';
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz });
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz });
  const fullDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: tz,
  });
  const timeStr = date
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    })
    .toLowerCase();

  return [
    {
      id: E2E_MOCK_SUBEVENT_ID,
      slug,
      dateStr: `${dayName}, ${monthDay}`,
      fullDate,
      timeStr,
      rawDate: E2E_MOCK_RAW_DATE,
      url: `https://tickets.denartny.com/denart-studio/${slug}/?subevent=${E2E_MOCK_SUBEVENT_ID}`,
      pageUrl: SLUG_TO_PAGE[slug] || '/classes/',
    },
  ];
}

export interface PretixEvent {
  id: number;
  slug: string;
  dateStr: string;
  fullDate: string;
  timeStr: string;
  rawDate: string;
  url: string;
  pageUrl: string;
  title?: string;
  description?: string;
  price?: string;
}

/**
 * Fetch all events from all configured event slugs
 * Returns sorted list of upcoming events
 */
export async function fetchAllPretixEvents(): Promise<PretixEvent[]> {
  const slugs = getEventSlugs();
  const allEvents: PretixEvent[] = [];
  
  // Fetch events from all slugs in parallel
  const results = await Promise.all(
    slugs.map(slug => fetchSubeventsForSlug(slug))
  );
  
  // Flatten and sort by date
  for (const events of results) {
    allEvents.push(...events);
  }
  
  return allEvents.sort((a, b) => 
    new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime()
  );
}

/**
 * Fetch UV Body Painting class events from Pretix (legacy function)
 * For backwards compatibility - fetches only the couples class
 */
export async function fetchPretixEvents(): Promise<PretixEvent[]> {
  return fetchSubeventsForSlug('uc-class-couples-2');
}
