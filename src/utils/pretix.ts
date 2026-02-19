/**
 * DenArt Pretix Integration
 * Fetches events from the Pretix ticketing API
 */

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
  const token = import.meta.env.PRETIX_API_TOKEN;
  
  if (!token) {
    console.error('PRETIX_API_TOKEN not configured');
    return [];
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
      return [];
    }

    const data = await response.json();
    const now = new Date();
    
    // Filter to only active, future events
    return data.results
      .filter((event: any) => {
        const eventDate = new Date(event.date_from);
        return event.active && eventDate > now;
      })
      .map((event: any) => {
        const date = new Date(event.date_from);
        const endDate = event.date_to ? new Date(event.date_to) : null;
        
        // Format: "Fri, Feb 13"
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const fullDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        
        const startTime = date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }).toLowerCase();
        
        let timeStr = startTime;
        if (endDate) {
          const endTime = endDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
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
    return [];
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
