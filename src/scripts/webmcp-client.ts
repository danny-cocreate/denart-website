// WebMCP Client - Register tools for AI agent discovery
import { defineTool } from 'webmcp-kit';
import { z } from 'zod';

console.log('[WebMCP] Loading DenArt tools...');

// Tool 1: Get upcoming classes
const getUpcomingClasses = defineTool({
  name: 'getUpcomingClasses',
  description: 'Get upcoming DenArt class schedule for UV body painting sessions',
  inputSchema: z.object({
    limit: z.number().optional().default(5),
  }),
  execute: async ({ limit = 5 }) => {
    // This would fetch from Pretix in production
    const classes = [
      { date: '2026-03-13', time: '6:00 PM', spots: 3, type: 'Paint in the Dark' },
      { date: '2026-03-13', time: '8:30 PM', spots: 7, type: 'Paint in the Dark' },
      { date: '2026-03-27', time: '6:00 PM', spots: 5, type: 'Paint in the Dark' },
    ];
    return JSON.stringify(classes.slice(0, limit));
  },
});

// Tool 2: Get services list
const getServices = defineTool({
  name: 'getServices',
  description: 'Get list of DenArt services and pricing',
  inputSchema: z.object({
    category: z.string().optional(),
  }),
  execute: async ({ category }) => {
    const services = [
      { name: 'Private Session', price: 250, duration: '2 hours', description: 'One-on-one body painting session' },
      { name: 'Couples Session', price: 400, duration: '2.5 hours', description: 'Body painting for two' },
      { name: 'UV Paint in the Dark', price: 150, duration: '2 hours', description: 'Glow-in-the-dark UV body painting class' },
      { name: 'Maternity Paint', price: 300, duration: '2 hours', description: 'Beautiful belly art for expecting mothers' },
      { name: 'Event/Party', price: 500, duration: '3 hours', description: 'Body painting for events and parties' },
    ];
    if (category) {
      return JSON.stringify(services.filter(s => s.name.toLowerCase().includes(category.toLowerCase())));
    }
    return JSON.stringify(services);
  },
});

// Tool 3: Get gallery info
const getGalleryInfo = defineTool({
  name: 'getGalleryInfo',
  description: 'Get information about DenArt gallery',
  inputSchema: z.object({
    category: z.string().optional(),
  }),
  execute: async ({ category }) => {
    const gallery = {
      totalImages: 130,
      categories: ['fine-art', 'uv-glow', 'maternity', 'couples', 'events', 'model-portfolio'],
      location: 'Brooklyn, NYC',
      established: 2011,
      bodiesPainted: '2000+',
    };
    return JSON.stringify(gallery);
  },
});

// Register all tools
getUpcomingClasses.register();
getServices.register();
getGalleryInfo.register();

console.log('[WebMCP] DenArt tools registered:', ['getUpcomingClasses', 'getServices', 'getGalleryInfo'].join(', '));

// Update status indicator if it exists
if (typeof document !== 'undefined') {
  const statusEl = document.getElementById('webmcp-status');
  if (statusEl) {
    statusEl.textContent = 'WebMCP Ready';
  }
}