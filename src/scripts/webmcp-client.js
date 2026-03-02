// WebMCP client-side script using @mcp-b/global
import '@mcp-b/global';
import { z } from 'zod';

console.log('[WebMCP] Script loaded');

// Define tool schema using Zod, convert to JSON schema
const toolSchema = z.object({
  limit: z.number().optional().default(5),
});

console.log('[WebMCP] Registering tool...');

// Register the tool with navigator.modelContext
navigator.modelContext.registerTool({
  name: 'getUpcomingClasses',
  description: 'Get upcoming class schedule for DenArt body painting sessions',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { 
        type: 'number', 
        description: 'Number of classes to return (default: 5)' 
      }
    },
    required: []
  },
  execute: async (args) => {
    const limit = args.limit || 5;
    const classes = [
      { date: '2026-03-13', time: '6:00 PM', spots: 3, type: 'Paint in the Dark' },
      { date: '2026-03-13', time: '8:30 PM', spots: 7, type: 'Paint in the Dark' },
      { date: '2026-03-27', time: '6:00 PM', spots: 5, type: 'Paint in the Dark' },
    ];
    
    const result = classes.slice(0, limit);
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  }
});

console.log('[WebMCP] Tool registered: getUpcomingClasses');

if (typeof navigator !== 'undefined' && navigator.modelContext) {
  console.log('[WebMCP] navigator.modelContext available!');
  document.getElementById('webmcp-status').textContent = 'WebMCP Ready - Tools Registered';
} else {
  console.log('[WebMCP] navigator.modelContext NOT available (need @mcp-b/global polyfill)');
  document.getElementById('webmcp-status').textContent = 'WebMCP loaded - @mcp-b/global needed';
}