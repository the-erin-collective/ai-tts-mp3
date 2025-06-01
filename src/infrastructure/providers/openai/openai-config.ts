// OpenAI TTS Provider Configuration
import { Voice } from '../../../domain/tts.entity';

export interface OpenAITTSConfig {
  readonly baseUrl: string;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly retryDelay: number;
  readonly supportedModels: readonly string[];
  readonly supportedVoices: readonly string[];
  readonly maxTextLength: number;
  readonly defaultModel: string;
  readonly defaultVoice: string;
}

export const OPENAI_TTS_CONFIG: OpenAITTSConfig = {
  baseUrl: 'https://api.openai.com/v1/audio/speech',
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  supportedModels: ['tts-1', 'tts-1-hd'] as const,
  supportedVoices: [
    Voice.ALLOY,
    Voice.ECHO, 
    Voice.FABLE,
    Voice.ONYX,
    Voice.NOVA,
    Voice.SHIMMER
  ] as const,
  maxTextLength: 4096,
  defaultModel: 'tts-1',
  defaultVoice: Voice.ALLOY
};

export const OPENAI_PRICING = {
  'tts-1': 0.015, // $0.015 per 1K characters
  'tts-1-hd': 0.030 // $0.030 per 1K characters
} as const;

export const OPENAI_RATE_LIMITS = {
  requestsPerMinute: 50,
  requestsPerDay: 500,
  charactersPerRequest: 4096,
  charactersPerMonth: 1000000
} as const;
