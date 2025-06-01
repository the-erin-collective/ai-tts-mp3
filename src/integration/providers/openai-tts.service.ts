// OpenAI TTS provider implementation
import { Injectable } from '@angular/core';
import { LoggingService } from '../logging.service';
import { MonitoringService } from '../monitoring.service';
import { TTSSettings, TTSResult, QueryId, ModelProvider, TTSResultStatus, QueryText } from '../../domain/tts.entity';
import { Result } from '../../common/result';
import { OpenAITTSService } from '../../infrastructure/providers/openai/openai-tts.service';
import { TTSProvider } from './tts-provider.factory';

export interface OpenAISettings extends TTSSettings {
  speed?: number; // 0.25 to 4.0
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac';
}

export interface OpenAICapabilities {
  name: string;
  provider: ModelProvider;
  maxTextLength: number;
  supportedModels: string[];
  supportedVoices: string[];
  supportedFormats: string[];
  costEstimation: {
    pricePerThousandChars: number;
    currency: string;
  };
  features: {
    customVoices: boolean;
    voiceCloning: boolean;
    emotionalTones: boolean;
    languageDetection: boolean;
    ssmlSupport: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class OpenAITTSProviderService implements TTSProvider {
  private cache = new Map<string, { result: TTSResult; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly capabilities: OpenAICapabilities;
  private readonly openaiService: OpenAITTSService;

  constructor(
    private logging: LoggingService,
    private monitoring: MonitoringService
  ) {
    this.openaiService = new OpenAITTSService();
    this.capabilities = {
      name: 'OpenAI Text-to-Speech',
      provider: ModelProvider.OPENAI,
      maxTextLength: 4096,
      supportedModels: ['tts-1', 'tts-1-hd'],
      supportedVoices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
      supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      costEstimation: {
        pricePerThousandChars: 0.015, // tts-1 base price
        currency: 'USD'
      },
      features: {
        customVoices: false,
        voiceCloning: false,
        emotionalTones: true,
        languageDetection: true,
        ssmlSupport: false
      }
    };

    this.logging.info('OpenAI TTS provider initialized', 'OpenAITTSService');
  }

  /**
   * Synthesize speech using OpenAI TTS API
   */
  async synthesizeSpeech(
    text: string, 
    settings: OpenAISettings, 
    queryId: QueryId
  ): Promise<Result<TTSResult, string>> {
    const startTime = Date.now();
    
    try {
      this.logging.info('Starting OpenAI TTS synthesis', 'OpenAITTSService', {
        queryId: queryId.getValue(),
        textLength: text.length,
        model: settings.model,
        voice: settings.voice
      });

      // Check cache first
      const cacheKey = this.generateCacheKey(text, settings);
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        this.logging.info('Returning cached OpenAI TTS result', 'OpenAITTSService', {
          queryId: queryId.getValue()
        });
        this.monitoring.recordRequest(ModelProvider.OPENAI, true, Date.now() - startTime);
        return Result.success(cachedResult);
      }

      // Validate configuration
      const validationResult = await this.validateConfiguration(settings);
      if (validationResult.isFailure()) {
        this.monitoring.recordRequest(ModelProvider.OPENAI, false, Date.now() - startTime);
        return Result.failure(validationResult.getError());
      }

      // Call OpenAI service
      const queryText = QueryText.fromString(text);
      const audioData = await this.openaiService.generateSpeech(queryText, settings);
      
      const duration = this.estimateDuration(text);
      
      // Create result
      const result: TTSResult = {
        queryId,
        status: TTSResultStatus.COMPLETED,
        audioData,
        duration,
        fileSize: audioData.length,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Cache the result
      this.cacheResult(cacheKey, result);

      this.logging.info('OpenAI TTS synthesis completed successfully', 'OpenAITTSService', {
        queryId: queryId.getValue(),
        audioSize: audioData.length,
        duration
      });

      this.monitoring.recordRequest(ModelProvider.OPENAI, true, Date.now() - startTime);
      return Result.success(result);

    } catch (error) {
      this.logging.error('OpenAI TTS synthesis failed', error as Error, 'OpenAITTSService', {
        queryId: queryId.getValue(),
        textLength: text.length
      });

      this.monitoring.recordRequest(ModelProvider.OPENAI, false, Date.now() - startTime);

      // Create failed result
      const failedResult: TTSResult = {
        queryId,
        status: TTSResultStatus.FAILED,
        error: {
          code: 'SYNTHESIS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return Result.success(failedResult); // Return success with failed status for consistent handling
    }
  }

  /**
   * Validate OpenAI configuration
   */
  async validateConfiguration(settings: OpenAISettings): Promise<Result<boolean, string>> {
    try {
      this.logging.info('Validating OpenAI configuration', 'OpenAITTSService');

      // Check API key
      if (!settings.apiKey?.getValue()) {
        return Result.failure('OpenAI API key is required');
      }

      // Validate model
      if (!this.capabilities.supportedModels.includes(settings.model)) {
        return Result.failure(`Unsupported OpenAI model: ${settings.model}. Supported models: ${this.capabilities.supportedModels.join(', ')}`);
      }

      // Validate voice
      if (!this.capabilities.supportedVoices.includes(settings.voice)) {
        return Result.failure(`Unsupported OpenAI voice: ${settings.voice}. Supported voices: ${this.capabilities.supportedVoices.join(', ')}`);
      }

      // Validate speed if provided
      if (settings.speed !== undefined && (settings.speed < 0.25 || settings.speed > 4.0)) {
        return Result.failure('OpenAI speed must be between 0.25 and 4.0');
      }

      // Test API key validity
      const isValidKey = await this.openaiService.validateApiKey(settings.apiKey.getValue());
      if (!isValidKey) {
        return Result.failure('Invalid OpenAI API key or insufficient permissions');
      }

      this.logging.info('OpenAI configuration validation successful', 'OpenAITTSService');
      return Result.success(true);

    } catch (error) {
      this.logging.error('OpenAI configuration validation failed', error as Error, 'OpenAITTSService');
      return Result.failure(`Configuration validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): OpenAICapabilities {
    return this.capabilities;
  }

  /**
   * Clear provider cache
   */
  clearCache(): void {
    this.logging.info('Clearing OpenAI TTS cache', 'OpenAITTSService', {
      cachedItems: this.cache.size
    });
    this.cache.clear();
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(cacheKey: string): TTSResult | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }

    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
    if (isExpired) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache synthesis result
   */
  private cacheResult(cacheKey: string, result: TTSResult): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Generate cache key for text and settings
   */
  private generateCacheKey(text: string, settings: OpenAISettings): string {
    const settingsHash = `${settings.model}:${settings.voice}:${settings.speed || 1.0}:${settings.responseFormat || 'mp3'}`;
    return `openai:${Buffer.from(text).toString('base64')}:${settingsHash}`;
  }
  /**
   * Estimate audio duration based on text length
   */
  private estimateDuration(text: string): number {
    // Rough estimation: ~150 words per minute, ~5 characters per word
    const wordsPerMinute = 150;
    const charactersPerWord = 5;
    const words = text.length / charactersPerWord;
    return Math.max(1, Math.round((words / wordsPerMinute) * 60));
  }
}
