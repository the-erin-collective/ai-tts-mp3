import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from '../../presentation/app/app.component';
import { appConfig } from './app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
