/**
 * Server entry point - TEMPORARY SHIM FILE
 * 
 * This file is being kept in the project root temporarily for backward compatibility,
 * but all server logic has been moved to the integration layer per the onion architecture.
 * 
 * See: src/integration/server/index.ts for the actual server implementation.
 */
import { createExpressServer } from './src/integration/server/server';

// The Express server
const app = createExpressServer();

// Use environment variable for port or fallback to 4000
const port = process.env['PORT'] || 4000;

app.listen(port, () => {
  console.log(`Node Express server listening on http://localhost:${port}`);
});
