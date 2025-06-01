// Infrastructure implementation of TTS Settings Repository (Local Storage)
import { Injectable } from '@angular/core';
import { TTSSettings } from '../../domain/tts.entity';
import { TTSSettingsRepository } from '../../domain/tts.repository';
import { Logger } from '../../common/utils';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageTTSSettingsRepository extends TTSSettingsRepository {
  private readonly SETTINGS_KEY = 'ai-tts-mp3-settings';

  async save(settings: TTSSettings): Promise<void> {
    try {
      Logger.info('Saving TTS settings to local storage', { provider: settings.provider });
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        Logger.info('localStorage not available, skipping save');
        return;
      }
      
      // Serialize settings for storage - don't include API key
      const storageData = {
        provider: settings.provider,
        model: settings.model,
        voice: settings.voice
      };

      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(storageData));
      Logger.info('TTS settings saved to local storage');
    } catch (error: unknown) {
      Logger.error('Failed to save TTS settings to local storage', error as Error);
      throw error;
    }
  }

  async load(): Promise<TTSSettings | null> {
    try {
      Logger.info('Loading TTS settings from local storage');
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        Logger.info('localStorage not available, returning null');
        return null;
      }
      
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (!stored) {
        Logger.info('No TTS settings found in local storage');
        return null;
      }

      const data = JSON.parse(stored);      const settings: TTSSettings = {
        provider: data.provider,
        model: data.model,
        voice: data.voice
      };

      Logger.info('TTS settings loaded from local storage', { 
        provider: settings.provider || 'none',
        model: settings.model || 'none',
        voice: settings.voice || 'none'
      });
      return settings;
    } catch (error: unknown) {
      Logger.error('Failed to load TTS settings from local storage', error as Error);
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      Logger.info('Clearing TTS settings from local storage');
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        Logger.info('localStorage not available, skipping clear');
        return;
      }
      
      localStorage.removeItem(this.SETTINGS_KEY);
      Logger.info('TTS settings cleared from local storage');
    } catch (error: unknown) {
      Logger.error('Failed to clear TTS settings from local storage', error as Error);
      throw error;
    }
  }
}
