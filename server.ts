import { APP_BASE_HREF } from '@angular/common';
import { renderApplication } from '@angular/platform-server';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import bootstrap from './src/integration/bootstrap/main.server';

// The Express server
const app = express();
const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = readFileSync(join(browserDistFolder, 'index.html'), 'utf-8');

// Serve static files from /browser
app.get('*.*', express.static(browserDistFolder, {
  maxAge: '1y'
}));

// All regular routes use the Angular engine
app.get('*', async (req, res, next) => {
  const { protocol, originalUrl, baseUrl, headers } = req;
  
  try {
    const html = await renderApplication(bootstrap, {
      document: indexHtml,
      url: `${protocol}://${headers.host}${originalUrl}`,
      platformProviders: [
        { provide: APP_BASE_HREF, useValue: baseUrl }
      ],
    });
    
    res.send(html);
  } catch (err: any) {
    next(err);
  }
});

const port = process.env['PORT'] || 4000;

app.listen(port, () => {
  console.log(`Node Express server listening on http://localhost:${port}`);
});
