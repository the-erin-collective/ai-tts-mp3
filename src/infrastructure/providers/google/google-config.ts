// Google Cloud Text-to-Speech provider configuration
import { ModelProvider } from '../../../domain/tts.entity';

export interface GoogleConfig {
  baseUrl: string;
  voices: {
    name: string;
    languageCode: string;
    gender: 'MALE' | 'FEMALE' | 'NEUTRAL';
    type: 'Standard' | 'WaveNet' | 'Neural2';
  }[];
  maxCharsPerRequest: number;
  pricing: {
    standard: number; // per character
    wavenet: number; // per character
    neural2: number; // per character
  };
  rateLimit: {
    requestsPerSecond: number;
    charactersPerMinute: number;
  };
  supportedFeatures: {
    ssml: boolean;
    audioProfiles: boolean;
    speakingRate: boolean;
    pitch: boolean;
  };
}

export const GOOGLE_CONFIG: GoogleConfig = {
  baseUrl: 'https://texttospeech.googleapis.com',
  voices: [
    { name: 'en-US-Standard-A', languageCode: 'en-US', gender: 'FEMALE', type: 'Standard' },
    { name: 'en-US-Standard-B', languageCode: 'en-US', gender: 'MALE', type: 'Standard' },
    { name: 'en-US-Wavenet-A', languageCode: 'en-US', gender: 'FEMALE', type: 'WaveNet' },
    { name: 'en-US-Wavenet-B', languageCode: 'en-US', gender: 'MALE', type: 'WaveNet' },
    { name: 'en-US-Neural2-A', languageCode: 'en-US', gender: 'FEMALE', type: 'Neural2' },
    { name: 'en-US-Neural2-B', languageCode: 'en-US', gender: 'MALE', type: 'Neural2' }
  ],
  maxCharsPerRequest: 5000,
  pricing: {
    standard: 0.000004, // $4 per 1M characters
    wavenet: 0.000016, // $16 per 1M characters
    neural2: 0.000016 // $16 per 1M characters
  },
  rateLimit: {
    requestsPerSecond: 1000,
    charactersPerMinute: 100000
  },
  supportedFeatures: {
    ssml: true,
    audioProfiles: true,
    speakingRate: true,
    pitch: true
  }
};

export const GOOGLE_PROVIDER = ModelProvider.GOOGLE;
