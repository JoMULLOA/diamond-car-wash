import { serve } from '@hono/node-server';
import { app } from '../api/index';

const PORT = parseInt(process.env.PORT || '4000');

console.log(`[Server] Starting Diamond Car Wash API on port ${PORT}...`);

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`[Server] Listening on http://localhost:${info.port}`);
});
