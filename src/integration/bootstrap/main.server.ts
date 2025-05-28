import { bootstrapApplication } from '@angular/platform-browser';
import { config } from './app.config.server';
import { AppComponent } from '../../presentation/app/app.component';

const bootstrap = () => bootstrapApplication(AppComponent, config);

export default bootstrap;
