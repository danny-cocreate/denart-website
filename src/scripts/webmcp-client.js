// WebMCP client-side script
import { defineTool } from 'webmcp-kit';
import { z } from 'zod';

console.log('[WebMCP] Script loaded');

const getUpcomingClasses = defineTool({
  name: 'getUpcomingClasses',
  description: 'Get upcoming class schedule for DenArt body painting sessions',
  inputSchema: z.object({
    limit: z.number().optional().default(5),
  }),
  execute: async ({ limit }) => {
    const classes = [
      { date: '2026-03-13', time: '6:00 PM', spots: 3, type: 'Paint in the Dark' },
      { date: '2026-03-13', time: '8:30 PM', spots: 7, type: 'Paint in the Dark' },
      { date: '2026-03-27', time: '6:00 PM', spots: 5, type: 'Paint in the Dark' },
    ];
    return JSON.stringify(classes.slice(0, limit));
  },
});

getUpcomingClasses.register();
console.log('[WebMCP] Tool registered:', getUpcomingClasses.name);

// MCP-B polyfill: expose tools globally for discovery
if (typeof window !== 'undefined') {
  window.__MCP_TOOLS__ = window.__MCP_TOOLS__ || {};
  window.__MCP_TOOLS__['getUpcomingClasses'] = getUpcomingClasses;
  console.log('[WebMCP] Exposed to window.__MCP_TOOLS__');
  
  // Also try window.webmcp for broader compatibility
  window.webmcp = window.webmcp || {};
  window.webmcp.getUpcomingClasses = getUpcomingClasses;
  console.log('[WebMCP] Exposed to window.webmcp');
}

if (typeof navigator !== 'undefined' && navigator.modelContext) {
  console.log('[WebMCP] navigator.modelContext available!');
  document.getElementById('webmcp-status').textContent = 'WebMCP Ready - Tools Registered';
} else {
  console.log('[WebMCP] navigator.modelContext NOT available (need Chrome Canary)');
  document.getElementById('webmcp-status').textContent = 'WebMCP loaded - Chrome Canary needed for full functionality';
}
