import { Routes } from '@angular/router';
import { HomeComponent } from '../../presentation/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Home - AI-TTS-MP3 App'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
