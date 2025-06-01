import { createExpressServer } from './server';

/**
 * Server entry point for Angular Universal SSR
 * This file handles server startup and configuration
 */
function startServer() {
  const app = createExpressServer();
  
  // Use environment variable for port or fallback to 4000
  const port = process.env['PORT'] || 4000;
  
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

// Start the server when this file is executed directly
if (require.main === module) {
  startServer();
}

// Export server creation for testing
export { createExpressServer };
