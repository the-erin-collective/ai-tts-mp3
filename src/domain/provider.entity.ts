
import { ModelProvider, Voice } from './tts.entity';

// Provider-specific configuration interfaces
export interface OpenAIConfig {
  readonly provider: ModelProvider.OPENAI;
  readonly model: 'tts-1' | 'tts-1-hd';
  readonly voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  readonly speed?: number; // 0.25 to 4.0
  readonly responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac';
}

export interface ElevenLabsConfig {
  readonly provider: ModelProvider.ELEVENLABS;
  readonly model: string; // Model ID from ElevenLabs
  readonly voice: string; // Voice ID from ElevenLabs
  readonly stability?: number; // 0 to 1
  readonly similarityBoost?: number; // 0 to 1
  readonly style?: number; // 0 to 1
  readonly useSpeakerBoost?: boolean;
}

export interface AzureConfig {
  readonly provider: ModelProvider.AZURE;
  readonly region: string;
  readonly voice: string;
  readonly outputFormat?: string;
  readonly rate?: string; // Speech rate
  readonly pitch?: string; // Speech pitch
}

export interface GoogleConfig {
  readonly provider: ModelProvider.GOOGLE;
  readonly languageCode: string;
  readonly voice: string;
  readonly ssmlGender?: 'MALE' | 'FEMALE' | 'NEUTRAL';
  readonly audioEncoding?: 'MP3' | 'LINEAR16' | 'OGG_OPUS';
  readonly speakingRate?: number; // 0.25 to 4.0
  readonly pitch?: number; // -20.0 to 20.0
}

export interface AWSConfig {
  readonly provider: ModelProvider.AWS;
  readonly region: string;
  readonly voice: string;
  readonly engine?: 'standard' | 'neural';
  readonly languageCode?: string;
  readonly outputFormat?: 'mp3' | 'ogg_vorbis' | 'pcm';
  readonly sampleRate?: string;
  readonly speechMarkTypes?: string[];
}

// Union type for all provider configurations
export type ProviderConfig = 
  | OpenAIConfig 
  | ElevenLabsConfig 
  | AzureConfig 
  | GoogleConfig 
  | AWSConfig;

// Value Objects for provider-specific data
export class ProviderCapabilities {
  constructor(
    private readonly provider: ModelProvider,
    private readonly supportedFormats: string[],
    private readonly supportedVoices: string[],
    private readonly maxTextLength: number,
    private readonly supportsSSML: boolean,
    private readonly supportsStreaming: boolean
  ) {}

  getProvider(): ModelProvider {
    return this.provider;
  }

  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }

  getSupportedVoices(): string[] {
    return [...this.supportedVoices];
  }

  getMaxTextLength(): number {
    return this.maxTextLength;
  }

  supportsSSMLInput(): boolean {
    return this.supportsSSML;
  }

  supportsAudioStreaming(): boolean {
    return this.supportsStreaming;
  }

  canHandleText(text: string): boolean {
    return text.length <= this.maxTextLength;
  }

  isVoiceSupported(voice: string): boolean {
    return this.supportedVoices.includes(voice);
  }
}

// Provider rate limiting information
export interface ProviderRateLimit {
  readonly provider: ModelProvider;
  readonly requestsPerMinute: number;
  readonly requestsPerDay?: number;
  readonly charactersPerRequest?: number;
  readonly charactersPerMonth?: number;
  readonly resetTime?: Date;
}

// Provider pricing information
export interface ProviderPricing {
  readonly provider: ModelProvider;
  readonly pricePerCharacter?: number;
  readonly pricePerRequest?: number;
  readonly pricePerMinute?: number;
  readonly currency: string;
  readonly hasFreeTier: boolean;
  readonly freeCharactersPerMonth?: number;
}

// Error types specific to providers
export enum ProviderErrorType {
  AUTHENTICATION_FAILED = 'authentication_failed',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  QUOTA_EXCEEDED = 'quota_exceeded',
  INVALID_VOICE = 'invalid_voice',
  INVALID_MODEL = 'invalid_model',
  TEXT_TOO_LONG = 'text_too_long',
  UNSUPPORTED_FORMAT = 'unsupported_format',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  NETWORK_ERROR = 'network_error',
  UNKNOWN_ERROR = 'unknown_error'
}

export class ProviderError extends Error {
  constructor(
    public readonly type: ProviderErrorType,
    public readonly provider: ModelProvider,
    message: string,
    public readonly originalError?: Error,
    public readonly retryAfter?: number // seconds
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  isRetryable(): boolean {
    return [
      ProviderErrorType.RATE_LIMIT_EXCEEDED,
      ProviderErrorType.SERVICE_UNAVAILABLE,
      ProviderErrorType.NETWORK_ERROR
    ].includes(this.type);
  }
}
