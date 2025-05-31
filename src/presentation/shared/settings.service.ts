import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ModelProvider, Voice } from '../../integration/domain-types';
import { PROVIDER_FLAGS } from '../../integration/provider-flags';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private isBrowser: boolean;
  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // Settings state using signals
  selectedProvider = signal<ModelProvider>(ModelProvider.OPENAI);
  selectedModel = signal('tts-1');
  selectedVoice = signal<Voice>(Voice.ALLOY);
  apiKey = signal('');
  saveToHistory = signal(true);
  historyTitle = signal('');

  // Available options for dropdowns
  providers = Object.values(ModelProvider).filter(p => PROVIDER_FLAGS[p as ModelProvider]);

  openAIVoices = [
    'nova', 'shimmer', 'echo', 'onyx', 'fable', 'alloy', 'ash', 'sage', 'coral'
  ];

  elevenLabsVoices = [
    // Add valid ElevenLabs voices here when ready
    'rachel', 'drew', 'clyde'
  ];

  voices = computed(() => {
    switch (this.selectedProvider()) {
      case ModelProvider.OPENAI:
        return this.openAIVoices;
      case ModelProvider.ELEVENLABS:
        return this.elevenLabsVoices;
      default:
        return [];
    }
  });
  
  models = computed(() => {
    switch (this.selectedProvider()) {
      case ModelProvider.OPENAI:
        return ['tts-1', 'tts-1-hd'];
      case ModelProvider.ELEVENLABS:
        return ['eleven_multilingual_v2', 'eleven_turbo_v2_5'];
      default:
        return ['default'];
    }
  });

  canGenerate = computed(() => {
    return this.apiKey().trim().length > 0;
  });

  onProviderChange() {
    // Reset model and voice when provider changes
    const models = this.models();
    const voices = this.voices();
    
    if (models.length > 0) {
      this.selectedModel.set(models[0]);
    }
    
    if (voices.length > 0) {
      this.selectedVoice.set(voices[0] as Voice);
    }
    
    this.saveSettings();
  }
  private saveSettings() {
    const settings = {
      provider: this.selectedProvider(),
      model: this.selectedModel(),
      voice: this.selectedVoice(),
      saveToHistory: this.saveToHistory()
    };
    if (this.isBrowser) {
      localStorage.setItem('tts_settings', JSON.stringify(settings));
    }
  }

  loadSavedSettings() {
    try {
      let saved = null;
      if (this.isBrowser) {
        saved = localStorage.getItem('tts_settings');
      }
      if (saved) {
        const settings = JSON.parse(saved);        this.selectedProvider.set(settings.provider || ModelProvider.OPENAI);
        this.selectedModel.set(settings.model || 'tts-1');
        this.selectedVoice.set(settings.voice || Voice.ALLOY);
        this.saveToHistory.set(settings.saveToHistory ?? true);
      }
    } catch (error) {
      console.warn('Failed to load saved settings:', error);
    }
  }

  // Methods to update settings and auto-save
  updateProvider(provider: ModelProvider) {
    this.selectedProvider.set(provider);
    this.onProviderChange();
  }

  updateModel(model: string) {
    this.selectedModel.set(model);
    this.saveSettings();
  }

  updateVoice(voice: Voice) {
    this.selectedVoice.set(voice);
    this.saveSettings();
  }

  updateApiKey(apiKey: string) {
    // Set the API key in memory only, do not save to storage
    this.apiKey.set(apiKey);
  }

  updateSaveToHistory(saveToHistory: boolean) {
    this.saveToHistory.set(saveToHistory);
    this.saveSettings();
  }

  updateHistoryTitle(title: string) {
    this.historyTitle.set(title);
  }
}
