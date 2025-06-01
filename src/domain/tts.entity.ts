// Domain entities and types for TTS functionality

// Import value objects
export { QueryId } from './value-objects/query-id';
export { QueryText } from './value-objects/query-text';
export { ApiKey } from './value-objects/api-key';

// Enums for supported providers, models, and voices
export enum ModelProvider {
  OPENAI = 'openai',
  ELEVENLABS = 'elevenlabs',
  AZURE = 'azure',
  GOOGLE = 'google',
  AWS = 'aws'
}

export enum OpenAIModel {
  TTS_1 = 'tts-1',
  TTS_1_HD = 'tts-1-hd'
}

export enum ElevenLabsModel {
  ELEVEN_MULTILINGUAL_V2 = 'eleven_multilingual_v2',
  ELEVEN_TURBO_V2 = 'eleven_turbo_v2_5'
}

export enum Voice {
  // OpenAI voices
  ALLOY = 'alloy',
  ECHO = 'echo',
  FABLE = 'fable',
  ONYX = 'onyx',
  NOVA = 'nova',
  SHIMMER = 'shimmer',
  // ElevenLabs voices (examples - would be dynamically loaded)
  RACHEL = 'rachel',
  DREW = 'drew',
  CLYDE = 'clyde'
}

// Import types for re-export
import type { QueryId } from './value-objects/query-id';
import type { QueryText } from './value-objects/query-text';
import type { ApiKey } from './value-objects/api-key';

// Domain Entities
export interface TTSSettings {
  readonly provider: ModelProvider;
  readonly model: string;
  readonly voice: string;
  readonly apiKey?: ApiKey; // Make apiKey optional
}

export interface TTSQuery {
  readonly id: QueryId;
  readonly text: QueryText;
  readonly settings: TTSSettings;
  readonly createdAt: Date;
  readonly metadata?: {
    readonly title?: string;
    readonly tags?: string[];
    readonly estimatedDuration?: number; // in seconds
  };
}

export enum TTSResultStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface TTSResult {
  readonly queryId: QueryId;
  readonly status: TTSResultStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly audioData?: Uint8Array; // MP3 binary data
  readonly audioUrl?: string; // Temporary URL if streaming
  readonly duration?: number; // Duration in seconds
  readonly fileSize?: number; // Size in bytes
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
  readonly processingTime?: number; // Time taken in milliseconds
}
