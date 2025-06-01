// Azure Cognitive Services TTS provider configuration
import { ModelProvider } from '../../../domain/tts.entity';

export interface AzureConfig {
  baseUrl: string;
  region: string;
  voices: {
    name: string;
    locale: string;
    gender: 'Male' | 'Female';
    style?: string[];
  }[];
  maxCharsPerRequest: number;
  pricing: {
    standardVoices: number; // per character
    neuralVoices: number; // per character
  };
  rateLimit: {
    requestsPerSecond: number;
    charactersPerMinute: number;
  };
  supportedFeatures: {
    ssml: boolean;
    neuralVoices: boolean;
    customVoice: boolean;
    prosody: boolean;
  };
}

export const AZURE_CONFIG: AzureConfig = {
  baseUrl: 'https://{region}.tts.speech.microsoft.com',
  region: 'eastus', // Default region
  voices: [
    { name: 'en-US-JennyNeural', locale: 'en-US', gender: 'Female', style: ['cheerful', 'sad', 'angry'] },
    { name: 'en-US-GuyNeural', locale: 'en-US', gender: 'Male', style: ['newscast', 'cheerful'] },
    { name: 'en-US-AriaNeural', locale: 'en-US', gender: 'Female', style: ['chat', 'customerservice'] },
    { name: 'en-US-DavisNeural', locale: 'en-US', gender: 'Male', style: ['chat'] }
  ],
  maxCharsPerRequest: 1000,
  pricing: {
    standardVoices: 0.000004, // $4 per 1M characters
    neuralVoices: 0.000016 // $16 per 1M characters
  },
  rateLimit: {
    requestsPerSecond: 20,
    charactersPerMinute: 6000
  },
  supportedFeatures: {
    ssml: true,
    neuralVoices: true,
    customVoice: true,
    prosody: true
  }
};

export const AZURE_PROVIDER = ModelProvider.AZURE;
