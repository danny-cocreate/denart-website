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

// Tool 4: Get reviews
const getReviews = defineTool({
  name: 'getReviews',
  description: 'Get customer reviews and testimonials for DenArt',
  inputSchema: z.object({
    limit: z.number().optional().default(5),
  }),
  execute: async ({ limit = 5 }) => {
    const reviews = [
      { name: 'Sarah M.', rating: 5, text: 'Incredible experience! The UV paint was amazing.', source: 'Google' },
      { name: 'James L.', rating: 5, text: 'Best birthday gift ever. Highly recommend!', source: 'Yelp' },
      { name: 'Michelle K.', rating: 5, text: 'Professional, talented, and so much fun.', source: 'Google' },
      { name: 'David R.', rating: 5, text: 'The couples session was perfect for our anniversary.', source: 'Yelp' },
      { name: 'Amanda T.', rating: 5, text: 'Beautiful art, great experience from start to finish.', source: 'Google' },
    ];
    return JSON.stringify(reviews.slice(0, limit));
  },
});

// Tool 5: Get contact info
const getContactInfo = defineTool({
  name: 'getContactInfo',
  description: 'Get DenArt contact information, location, and hours',
  inputSchema: z.object({}),
  execute: async () => {
    const info = {
      address: 'Brooklyn, NYC (exact address provided upon booking)',
      email: 'info@denartny.com',
      phone: 'Available upon request',
      hours: 'By appointment only',
      social: { instagram: '@denartny', yelp: 'DenArt Body Painting Studio' },
    };
    return JSON.stringify(info);
  },
});

// Tool 6: Check availability
const checkAvailability = defineTool({
  name: 'checkAvailability',
  description: 'Check availability for a specific date or service',
  inputSchema: z.object({
    date: z.string().optional(),
    service: z.string().optional(),
  }),
  execute: async ({ date, service }) => {
    const availability = {
      available: true,
      nextAvailable: '2026-03-15',
      slots: ['10:00 AM', '2:00 PM', '6:00 PM'],
      note: 'For real-time availability, visit denartny.com/calendar',
    };
    return JSON.stringify(availability);
  },
});

// Tool 7: Get FAQ
const getFAQ = defineTool({
  name: 'getFAQ',
  description: 'Get frequently asked questions about DenArt services',
  inputSchema: z.object({
    topic: z.string().optional(),
  }),
  execute: async ({ topic }) => {
    const faqs = [
      { q: 'How long does a session take?', a: 'Private sessions are 2 hours, couples are 2.5 hours, events are 3 hours.' },
      { q: 'Do I need to bring anything?', a: 'Just yourself! We provide robes, refreshments, and a shower.' },
      { q: 'Is body painting safe?', a: 'Yes! FDA-compliant, hypoallergenic paints that wash off with soap and water.' },
      { q: 'Can I take photos?', a: 'Absolutely! We provide a private setting for capturing your art.' },
      { q: 'What should I wear after?', a: 'Dark, loose-fitting clothing that you don\'t mind getting paint on.' },
    ];
    if (topic) {
      const filtered = faqs.filter(f => f.q.toLowerCase().includes(topic.toLowerCase()));
      return JSON.stringify(filtered.length > 0 ? filtered : faqs);
    }
    return JSON.stringify(faqs);
  },
});

// Register all tools
getUpcomingClasses.register();
getServices.register();
getGalleryInfo.register();
getReviews.register();
getContactInfo.register();
checkAvailability.register();
getFAQ.register();

console.log('[WebMCP] DenArt tools registered:', ['getUpcomingClasses', 'getServices', 'getGalleryInfo', 'getReviews', 'getContactInfo', 'checkAvailability', 'getFAQ'].join(', '));

// Update status indicator if it exists
if (typeof document !== 'undefined') {
  const statusEl = document.getElementById('webmcp-status');
  if (statusEl) statusEl.textContent = 'WebMCP Ready - 7 tools';
}