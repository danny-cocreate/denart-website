/**
 * Fetch UV Body Painting class events from Pretix
 */
export async function fetchPretixEvents() {
  const token = import.meta.env.PRETIX_API_TOKEN;
  
  if (!token) {
    console.error('PRETIX_API_TOKEN not configured');
    return [];
  }

  const url = 'https://tickets.denartny.com/api/v1/organizers/denart-studio/events/uc-class-couples-2/subevents/';
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${token}`,
      },
    });

    if (!response.ok) {
      console.error('Pretix API error:', response.status);
      return [];
    }

    const data = await response.json();
    
    // Filter to only active, future events
    const now = new Date();
    const events = data.results
      .filter(event => {
        const eventDate = new Date(event.date_from);
        return event.active && eventDate > now;
      })
      .map(event => {
        const date = new Date(event.date_from);
        const endDate = event.date_to ? new Date(event.date_to) : null;
        
        // Format: "Fri, Feb 13 | 6pm - 8pm"
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
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
          dateStr: `${dayName}, ${monthDay}`,
          timeStr,
          rawDate: date.toISOString(),
          url: `https://tickets.denartny.com/denart-studio/uc-class-couples-2/?subevent=${event.id}`,
        };
      })
      .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

    return events;
  } catch (error) {
    console.error('Failed to fetch Pretix events:', error);
    return [];
  }
}
