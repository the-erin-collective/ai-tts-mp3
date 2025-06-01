// Integration layer settings management service
import { Injectable } from '@angular/core';
import { TTSSettings, ModelProvider } from '../domain/tts.entity';
import { ApiKey } from '../domain/value-objects/api-key';
import { ProviderConfigurationService } from './provider-configuration.service';
import { LoggingService } from './logging.service';
import { MonitoringService } from './monitoring.service';
import { Result } from '../common/result';
import { Logger } from '../common/utils';

export interface UserPreferences {
  defaultProvider: ModelProvider;
  defaultModel: string;
  defaultVoice: string;
  autoSaveHistory: boolean;
  maxHistoryItems: number;
  enableNotifications: boolean;
  darkMode: boolean;
}

export interface ProviderConfiguration {
  provider: ModelProvider;
  apiKey?: string;
  customEndpoint?: string;
  timeout?: number;
  maxRetries?: number;
  enabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsManagementService {
  private readonly STORAGE_KEYS = {
    USER_PREFERENCES: 'tts_user_preferences',
    PROVIDER_CONFIGS: 'tts_provider_configs',
    LAST_USED_SETTINGS: 'tts_last_used_settings'
  };

  constructor(
    private providerConfig: ProviderConfigurationService,
    private logging: LoggingService,
    private monitoring: MonitoringService
  ) {
    this.logging.info('SettingsManagementService initialized', 'Settings');
  }
  // User Preferences Management
  async saveUserPreferences(preferences: UserPreferences): Promise<Result<void, string>> {
    return this.logging.trackPerformance(
      'saveUserPreferences',
      async () => {
        try {
          this.logging.info('Saving user preferences', 'Settings', { 
            defaultProvider: preferences.defaultProvider,
            autoSaveHistory: preferences.autoSaveHistory 
          });

          const serialized = JSON.stringify(preferences);
          localStorage.setItem(this.STORAGE_KEYS.USER_PREFERENCES, serialized);
          
          this.logging.info('User preferences saved successfully', 'Settings');
          return Result.success(undefined);
        } catch (error) {
          this.logging.error('Failed to save user preferences', error as Error, 'Settings');
          return Result.failure('Failed to save preferences');
        }
      },
      'Settings'
    );
  }
  async loadUserPreferences(): Promise<Result<UserPreferences, string>> {
    return this.logging.trackPerformance(
      'loadUserPreferences',
      async () => {
        try {
          this.logging.debug('Loading user preferences', 'Settings');

          const stored = localStorage.getItem(this.STORAGE_KEYS.USER_PREFERENCES);
          if (!stored) {
            this.logging.info('No stored preferences found, returning defaults', 'Settings');
            const defaults = this.getDefaultUserPreferences();
            await this.saveUserPreferences(defaults);
            return Result.success(defaults);
          }

          const preferences = JSON.parse(stored) as UserPreferences;
          this.logging.info('User preferences loaded successfully', 'Settings');
          return Result.success(preferences);
        } catch (error) {
          this.logging.error('Failed to load user preferences', error as Error, 'Settings');
          const defaults = this.getDefaultUserPreferences();
          return Result.success(defaults);
        }
      },
      'Settings'
    );
  }

  // Provider Configuration Management
  async saveProviderConfiguration(config: ProviderConfiguration): Promise<Result<void, string>> {
    try {
      // Validate API key if provided
      if (config.apiKey) {
        const validation = this.providerConfig.validateApiKey(config.provider, config.apiKey);
        if (!validation.isSuccess()) {
          return Result.failure(validation.getError());
        }
      }
      
      const configs = await this.loadAllProviderConfigurations();
      const updatedConfigs = configs.isSuccess() ? configs.getValue() : [];
      
      // Update or add configuration
      const existingIndex = updatedConfigs.findIndex(c => c.provider === config.provider);
      if (existingIndex >= 0) {
        updatedConfigs[existingIndex] = config;
      } else {
        updatedConfigs.push(config);
      }

      const serialized = JSON.stringify(updatedConfigs);
      localStorage.setItem(this.STORAGE_KEYS.PROVIDER_CONFIGS, serialized);
      
      Logger.info('Provider configuration saved', { provider: config.provider });
      return Result.success(undefined);
    } catch (error) {
      Logger.error('Failed to save provider configuration', error as Error);
      return Result.failure('Failed to save provider configuration');
    }
  }

  async loadProviderConfiguration(provider: ModelProvider): Promise<Result<ProviderConfiguration | null, string>> {
    try {
      const allConfigs = await this.loadAllProviderConfigurations();
      if (!allConfigs.isSuccess()) {
        return Result.failure(allConfigs.getError());
      }

      const config = allConfigs.getValue().find(c => c.provider === provider);
      return Result.success(config || null);
    } catch (error) {
      Logger.error('Failed to load provider configuration', error as Error);
      return Result.failure('Failed to load provider configuration');
    }
  }

  async loadAllProviderConfigurations(): Promise<Result<ProviderConfiguration[], string>> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.PROVIDER_CONFIGS);
      if (!stored) {
        return Result.success([]);
      }

      const configs = JSON.parse(stored) as ProviderConfiguration[];
      return Result.success(configs);
    } catch (error) {
      Logger.error('Failed to load provider configurations', error as Error);
      return Result.success([]);
    }
  }

  // TTS Settings Management
  async saveLastUsedSettings(settings: TTSSettings): Promise<Result<void, string>> {
    try {
      // Convert ApiKey to string for storage
      const storableSettings = {
        ...settings,
        apiKey: settings.apiKey?.getValue()
      };
      
      const serialized = JSON.stringify(storableSettings);
      localStorage.setItem(this.STORAGE_KEYS.LAST_USED_SETTINGS, serialized);
      Logger.info('Last used settings saved');
      return Result.success(undefined);
    } catch (error) {
      Logger.error('Failed to save last used settings', error as Error);
      return Result.failure('Failed to save settings');
    }
  }

  async loadLastUsedSettings(): Promise<Result<TTSSettings | null, string>> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.LAST_USED_SETTINGS);
      if (!stored) {
        return Result.success(null);
      }

      const parsed = JSON.parse(stored);
      
      // Convert string apiKey back to ApiKey value object
      const settings: TTSSettings = {
        ...parsed,
        apiKey: parsed.apiKey ? ApiKey.fromString(parsed.apiKey) : undefined
      };

      return Result.success(settings);
    } catch (error) {
      Logger.error('Failed to load last used settings', error as Error);
      return Result.success(null);
    }
  }

  // Utility Methods
  async getEffectiveSettings(provider?: ModelProvider): Promise<Result<TTSSettings, string>> {
    try {
      // Try to load last used settings first
      const lastUsed = await this.loadLastUsedSettings();
      if (lastUsed.isSuccess() && lastUsed.getValue()) {
        const settings = lastUsed.getValue()!;
        if (!provider || settings.provider === provider) {
          return Result.success(settings);
        }
      }

      // Fall back to default settings for the provider
      const targetProvider = provider || ModelProvider.OPENAI;
      const defaultSettings = this.providerConfig.getDefaultSettings(targetProvider);
      
      // Try to load API key from provider configuration
      const providerConfig = await this.loadProviderConfiguration(targetProvider);
      if (providerConfig.isSuccess() && providerConfig.getValue()?.apiKey) {
        const apiKey = ApiKey.fromString(providerConfig.getValue()!.apiKey!);
        return Result.success({
          ...defaultSettings,
          apiKey
        });
      }

      return Result.success(defaultSettings);
    } catch (error) {
      Logger.error('Failed to get effective settings', error as Error);
      return Result.failure('Failed to load settings');
    }
  }

  private getDefaultUserPreferences(): UserPreferences {
    return {
      defaultProvider: ModelProvider.OPENAI,
      defaultModel: 'tts-1',
      defaultVoice: 'alloy',
      autoSaveHistory: true,
      maxHistoryItems: 100,
      enableNotifications: true,
      darkMode: false
    };
  }

  // Provider Setup Helpers
  async isProviderConfigured(provider: ModelProvider): Promise<boolean> {
    const config = await this.loadProviderConfiguration(provider);
    return config.isSuccess() && 
           config.getValue() !== null && 
           config.getValue()!.enabled &&
           !!config.getValue()!.apiKey;
  }

  async getConfiguredProviders(): Promise<ModelProvider[]> {
    const allConfigs = await this.loadAllProviderConfigurations();
    if (!allConfigs.isSuccess()) {
      return [];
    }

    return allConfigs.getValue()
      .filter(config => config.enabled && config.apiKey)
      .map(config => config.provider);
  }

  // Clear all stored data
  async clearAllSettings(): Promise<Result<void, string>> {
    try {
      Object.values(this.STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      
      Logger.info('All settings cleared');
      return Result.success(undefined);
    } catch (error) {
      Logger.error('Failed to clear settings', error as Error);
      return Result.failure('Failed to clear settings');
    }
  }
}
