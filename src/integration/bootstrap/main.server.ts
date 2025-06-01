import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationRef, importProvidersFrom, PLATFORM_ID, Inject } from '@angular/core';
import { config } from './app.config.server';
import { AppComponent } from '../../presentation/app/app.component';
import { createNodeRequestHandler } from '@angular/ssr/node';
import { FileSystemStorageService } from '../../infrastructure/file-system-storage.service';
import { NoOpFileSystemStorageService } from '../../infrastructure/file-system-storage.server.service';
import { isPlatformServer, isPlatformBrowser } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpClientModule } from '@angular/common/http';

const bootstrap = (): Promise<ApplicationRef> => bootstrapApplication(AppComponent, {
  providers: [
    ...config.providers, // Include existing providers from app.config.server
    provideHttpClient(withFetch()), // Provide HttpClient for SSR with fetch APIs
    {
      provide: FileSystemStorageService,
      useFactory: (platformId: Object) => {
        if (isPlatformServer(platformId)) {
          console.log('Using NoOpFileSystemStorageService for SSR');
          return new NoOpFileSystemStorageService();
        } else {
          console.log('Using FileSystemStorageService for Browser');
          // Note: The browser version of FileSystemStorageService already handles isPlatformBrowser internally.
          // This factory is primarily to ensure the NoOp version is used on the server.
          return new FileSystemStorageService(platformId);
        }
      },
      deps: [PLATFORM_ID] // Inject PLATFORM_ID into the factory
    }
  ]
});

// createNodeRequestHandler expects a function that returns Promise<void>
export const reqHandler = createNodeRequestHandler(() => 
  bootstrap().then(() => {})
);

// The default export can also be the bootstrap function
export default bootstrap;
