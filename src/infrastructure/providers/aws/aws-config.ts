// AWS Polly TTS provider configuration
import { ModelProvider } from '../../../domain/tts.entity';

export interface AWSConfig {
  baseUrl: string;
  region: string;
  voices: {
    id: string;
    name: string;
    languageCode: string;
    gender: 'Male' | 'Female';
    engine: 'standard' | 'neural';
  }[];
  maxCharsPerRequest: number;
  pricing: {
    standard: number; // per character
    neural: number; // per character
  };
  rateLimit: {
    requestsPerSecond: number;
    charactersPerMinute: number;
  };
  supportedFeatures: {
    ssml: boolean;
    lexicons: boolean;
    speechMarks: boolean;
    neuralVoices: boolean;
  };
}

export const AWS_CONFIG: AWSConfig = {
  baseUrl: 'https://polly.{region}.amazonaws.com',
  region: 'us-east-1', // Default region
  voices: [
    { id: 'Joanna', name: 'Joanna', languageCode: 'en-US', gender: 'Female', engine: 'standard' },
    { id: 'Matthew', name: 'Matthew', languageCode: 'en-US', gender: 'Male', engine: 'standard' },
    { id: 'Ivy', name: 'Ivy', languageCode: 'en-US', gender: 'Female', engine: 'neural' },
    { id: 'Justin', name: 'Justin', languageCode: 'en-US', gender: 'Male', engine: 'neural' },
    { id: 'Kendra', name: 'Kendra', languageCode: 'en-US', gender: 'Female', engine: 'neural' },
    { id: 'Kevin', name: 'Kevin', languageCode: 'en-US', gender: 'Male', engine: 'neural' }
  ],
  maxCharsPerRequest: 3000,
  pricing: {
    standard: 0.000004, // $4 per 1M characters
    neural: 0.000016 // $16 per 1M characters
  },
  rateLimit: {
    requestsPerSecond: 100,
    charactersPerMinute: 10000
  },
  supportedFeatures: {
    ssml: true,
    lexicons: true,
    speechMarks: true,
    neuralVoices: true
  }
};

export const AWS_PROVIDER = ModelProvider.AWS;
