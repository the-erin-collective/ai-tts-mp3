import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from '../../presentation/app/app.component';
import { appConfig } from './app.config';
import { provideHttpClient, withFetch } from '@angular/common/http';

bootstrapApplication(AppComponent, appConfig)
  .then(() => console.log('Client bootstrap successful'))
  .catch(err => console.error(err));
