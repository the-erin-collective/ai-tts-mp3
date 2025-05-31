import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../shared/settings.service';
import { ModelProvider } from '../../integration/domain-types';

@Component({
  selector: 'app-settings-panel',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-panel.component.html',
  styleUrl: './settings-panel.component.scss'
})
export class SettingsPanelComponent {
  // Inject the settings service
  settingsService = inject(SettingsService);

  // Expose ModelProvider enum for template
  ModelProvider = ModelProvider;

  constructor() {
    this.settingsService.loadSavedSettings();
  }

  onProviderChange() {
    this.settingsService.onProviderChange();
  }
}
