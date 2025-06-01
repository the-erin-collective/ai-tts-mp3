// ElevenLabs TTS provider configuration
import { ModelProvider } from '../../../domain/tts.entity';

export interface ElevenLabsConfig {
  baseUrl: string;
  version: string;
  models: string[];
  voices: string[];
  maxCharsPerRequest: number;
  pricing: {
    charactersPerCredit: number;
    creditsPerMonth: number;
  };
  rateLimit: {
    requestsPerSecond: number;
    charactersPerMinute: number;
  };
  supportedFeatures: {
    voiceCloning: boolean;
    emotionalRange: boolean;
    multiLanguage: boolean;
    ssml: boolean;
  };
}

export const ELEVENLABS_CONFIG: ElevenLabsConfig = {
  baseUrl: 'https://api.elevenlabs.io',
  version: 'v1',
  models: [
    'eleven_monolingual_v1',
    'eleven_multilingual_v1',
    'eleven_multilingual_v2'
  ],
  voices: [
    'Rachel',
    'Domi',
    'Bella',
    'Antoni',
    'Elli',
    'Josh',
    'Arnold',
    'Adam',
    'Sam'
  ],
  maxCharsPerRequest: 5000,
  pricing: {
    charactersPerCredit: 1000,
    creditsPerMonth: 10000 // Free tier
  },
  rateLimit: {
    requestsPerSecond: 2,
    charactersPerMinute: 1000
  },
  supportedFeatures: {
    voiceCloning: true,
    emotionalRange: true,
    multiLanguage: true,
    ssml: false
  }
};

export const ELEVENLABS_PROVIDER = ModelProvider.ELEVENLABS;
