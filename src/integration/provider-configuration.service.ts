// Integration layer service for managing provider configurations
import { Injectable } from '@angular/core';
import { TTSProviderFactory } from '../infrastructure/providers/tts-provider.factory';
import { ModelProvider, TTSSettings } from '../domain/tts.entity';
import { 
  OPENAI_TTS_CONFIG, 
  OPENAI_PRICING, 
  OPENAI_RATE_LIMITS 
} from '../infrastructure/providers/openai/openai-config';
import { ELEVENLABS_CONFIG } from '../infrastructure/providers/elevenlabs/elevenlabs-config';
import { AZURE_CONFIG } from '../infrastructure/providers/azure/azure-config';
import { GOOGLE_CONFIG } from '../infrastructure/providers/google/google-config';
import { AWS_CONFIG } from '../infrastructure/providers/aws/aws-config';
import { ApiKey } from '../domain/value-objects/api-key';
import { Result } from '../common/result';
import { Logger } from '../common/utils';

export interface ProviderCapabilities {
  provider: ModelProvider;
  models: string[];
  voices: string[];
  maxTextLength: number;
  supportedFormats: string[];
  pricing: {
    model: string;
    pricePerThousandChars: number;
  }[];
  rateLimit: {
    requestsPerMinute: number;
    charactersPerMinute: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProviderConfigurationService {
  
  getAvailableProviders(): ModelProvider[] {
    return TTSProviderFactory.getSupportedProviders();
  }  getProviderCapabilities(provider: ModelProvider): ProviderCapabilities {
    switch (provider) {
      case ModelProvider.OPENAI:
        return {
          provider: ModelProvider.OPENAI,
          models: Array.from(OPENAI_TTS_CONFIG.supportedModels),
          voices: Array.from(OPENAI_TTS_CONFIG.supportedVoices),
          maxTextLength: OPENAI_TTS_CONFIG.maxTextLength,
          supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
          pricing: [
            { model: 'tts-1', pricePerThousandChars: OPENAI_PRICING['tts-1'] },
            { model: 'tts-1-hd', pricePerThousandChars: OPENAI_PRICING['tts-1-hd'] }
          ],
          rateLimit: {
            requestsPerMinute: OPENAI_RATE_LIMITS.requestsPerMinute,
            charactersPerMinute: OPENAI_RATE_LIMITS.charactersPerRequest * OPENAI_RATE_LIMITS.requestsPerMinute
          }
        };
      
      case ModelProvider.ELEVENLABS:
        return {
          provider: ModelProvider.ELEVENLABS,
          models: ELEVENLABS_CONFIG.models,
          voices: ELEVENLABS_CONFIG.voices,
          maxTextLength: ELEVENLABS_CONFIG.maxCharsPerRequest,
          supportedFormats: ['mp3', 'wav'],
          pricing: [
            { model: 'eleven_multilingual_v2', pricePerThousandChars: 1000 / ELEVENLABS_CONFIG.pricing.charactersPerCredit }
          ],
          rateLimit: {
            requestsPerMinute: ELEVENLABS_CONFIG.rateLimit.requestsPerSecond * 60,
            charactersPerMinute: ELEVENLABS_CONFIG.rateLimit.charactersPerMinute
          }
        };
      
      case ModelProvider.AZURE:
        return {
          provider: ModelProvider.AZURE,
          models: ['standard', 'neural'],
          voices: AZURE_CONFIG.voices.map(v => v.name),
          maxTextLength: AZURE_CONFIG.maxCharsPerRequest,
          supportedFormats: ['mp3', 'wav', 'ogg'],
          pricing: [
            { model: 'standard', pricePerThousandChars: AZURE_CONFIG.pricing.standardVoices * 1000 },
            { model: 'neural', pricePerThousandChars: AZURE_CONFIG.pricing.neuralVoices * 1000 }
          ],
          rateLimit: {
            requestsPerMinute: AZURE_CONFIG.rateLimit.requestsPerSecond * 60,
            charactersPerMinute: AZURE_CONFIG.rateLimit.charactersPerMinute
          }
        };
      
      case ModelProvider.GOOGLE:
        return {
          provider: ModelProvider.GOOGLE,
          models: ['Standard', 'WaveNet', 'Neural2'],
          voices: GOOGLE_CONFIG.voices.map(v => v.name),
          maxTextLength: GOOGLE_CONFIG.maxCharsPerRequest,
          supportedFormats: ['mp3', 'wav', 'ogg'],
          pricing: [
            { model: 'Standard', pricePerThousandChars: GOOGLE_CONFIG.pricing.standard * 1000 },
            { model: 'WaveNet', pricePerThousandChars: GOOGLE_CONFIG.pricing.wavenet * 1000 },
            { model: 'Neural2', pricePerThousandChars: GOOGLE_CONFIG.pricing.neural2 * 1000 }
          ],
          rateLimit: {
            requestsPerMinute: GOOGLE_CONFIG.rateLimit.requestsPerSecond * 60,
            charactersPerMinute: GOOGLE_CONFIG.rateLimit.charactersPerMinute
          }
        };
      
      case ModelProvider.AWS:
        return {
          provider: ModelProvider.AWS,
          models: ['standard', 'neural'],
          voices: AWS_CONFIG.voices.map(v => v.name),
          maxTextLength: AWS_CONFIG.maxCharsPerRequest,
          supportedFormats: ['mp3', 'ogg', 'pcm'],
          pricing: [
            { model: 'standard', pricePerThousandChars: AWS_CONFIG.pricing.standard * 1000 },
            { model: 'neural', pricePerThousandChars: AWS_CONFIG.pricing.neural * 1000 }
          ],
          rateLimit: {
            requestsPerMinute: AWS_CONFIG.rateLimit.requestsPerSecond * 60,
            charactersPerMinute: AWS_CONFIG.rateLimit.charactersPerMinute
          }
        };
      
      default:
        throw new Error(`Provider ${provider} not yet implemented`);
    }
  }  validateApiKey(provider: ModelProvider, apiKey: string): Result<boolean, string> {
    try {
      ApiKey.fromString(apiKey);
      return Result.success(true);
    } catch (error) {
      Logger.warn('Invalid API key provided', { provider, error: error instanceof Error ? error.message : 'Unknown error' });
      return Result.failure(error instanceof Error ? error.message : 'Invalid API key');
    }
  }
  validateSettings(settings: TTSSettings): Result<boolean, string> {
    try {
      const capabilities = this.getProviderCapabilities(settings.provider);
      
      // Validate model
      if (!capabilities.models.includes(settings.model)) {
        return Result.failure(`Model ${settings.model} is not supported by ${settings.provider}`);
      }
      
      // Validate voice
      if (!capabilities.voices.includes(settings.voice)) {
        return Result.failure(`Voice ${settings.voice} is not supported by ${settings.provider}`);
      }
        // Validate API key if provided
      if (settings.apiKey) {
        const keyValidation = this.validateApiKey(settings.provider, settings.apiKey.getValue());
        if (!keyValidation.isSuccess()) {
          return keyValidation;
        }
      }
      
      return Result.success(true);
    } catch (error) {
      Logger.error('Settings validation failed', error as Error);
      return Result.failure(error instanceof Error ? error.message : 'Invalid settings');
    }
  }

  estimateCost(textLength: number, settings: TTSSettings): number {
    try {
      const capabilities = this.getProviderCapabilities(settings.provider);
      const pricing = capabilities.pricing.find(p => p.model === settings.model);
      
      if (!pricing) {
        Logger.warn('No pricing information available for model', { model: settings.model, provider: settings.provider });
        return 0;
      }
      
      return (textLength / 1000) * pricing.pricePerThousandChars;
    } catch (error) {
      Logger.error('Cost estimation failed', error as Error);
      return 0;
    }
  }

  checkRateLimit(textLength: number, settings: TTSSettings): Result<boolean, string> {
    try {
      const capabilities = this.getProviderCapabilities(settings.provider);
      
      if (textLength > capabilities.rateLimit.charactersPerMinute) {
        return Result.failure(
          `Text length (${textLength} characters) exceeds rate limit of ${capabilities.rateLimit.charactersPerMinute} characters per minute`
        );
      }
      
      return Result.success(true);
    } catch (error) {
      Logger.error('Rate limit check failed', error as Error);
      return Result.failure('Unable to check rate limits');
    }
  }
  getDefaultSettings(provider: ModelProvider): TTSSettings {
    const capabilities = this.getProviderCapabilities(provider);
    
    return {
      provider,
      model: capabilities.models[0], // Use first available model as default
      voice: capabilities.voices[0] // Use first available voice as default
    };
  }
}
