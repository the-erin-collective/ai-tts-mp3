import { APP_BASE_HREF } from '@angular/common';
import { renderApplication } from '@angular/platform-server';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import bootstrap from '../bootstrap/main.server';

/**
 * Express server for Angular Universal SSR
 * Lives in the integration layer as it bridges the framework concerns with our application
 */
export function createExpressServer() {
  // The Express server
  const app = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../../../browser');
  const indexHtml = readFileSync(join(browserDistFolder, 'index.html'), 'utf-8');
  
  // Serve static files from /browser
  app.get('*.*', express.static(browserDistFolder, {
    maxAge: '1y'
  }));
  
  // All regular routes use the Angular engine with timeout handling
  app.get('*', async (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;
    
    try {
      // Set a reasonable timeout for SSR rendering to avoid hanging
      const RENDER_TIMEOUT = 5000; // 5 seconds
      
      // Use Promise.race to implement a timeout for the rendering
      const renderPromise = renderApplication(bootstrap, {
        document: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        platformProviders: [
          { provide: APP_BASE_HREF, useValue: baseUrl }
        ]
      });
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('SSR rendering timed out'));
        }, RENDER_TIMEOUT);
      });
      
      // Race between rendering and timeout
      const html = await Promise.race([renderPromise, timeoutPromise])
        .catch(error => {
          console.warn(`SSR rendering failed or timed out: ${error.message}`);
          console.warn('Falling back to client-side rendering');
          return indexHtml; // Fall back to client-side rendering
        });
      
      res.send(html);
    } catch (err) {
      console.error('Server-side rendering error:', err);
      // Fall back to client-side rendering on error
      res.send(indexHtml);
    }
  });

  return app;
}
