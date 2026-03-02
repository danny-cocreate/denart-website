import { defineTool } from 'webmcp-kit';
import { z } from 'zod';

const getUpcomingClasses = defineTool({
  name: 'getUpcomingClasses',
  description: 'Get upcoming class schedule for DenArt body painting sessions',
  inputSchema: z.object({
    limit: z.number().optional().default(5),
  }),
  execute: async ({ limit }) => {
    // Mock data - will connect to Pretix later
    const classes = [
      { date: '2026-03-13', time: '6:00 PM', spots: 3, type: 'Paint in the Dark' },
      { date: '2026-03-13', time: '8:30 PM', spots: 7, type: 'Paint in the Dark' },
      { date: '2026-03-27', time: '6:00 PM', spots: 5, type: 'Paint in the Dark' },
      { date: '2026-03-27', time: '8:30 PM', spots: 2, type: 'Paint in the Dark' },
    ];
    return JSON.stringify(classes.slice(0, limit));
  },
});

getUpcomingClasses.register();

console.log('[WebMCP] Tools registered');
