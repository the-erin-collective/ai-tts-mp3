// filepath: d:\dev\github\ai-tts-mp3\src\domain\tts.entity.ts

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

// Value Objects
export class ApiKey {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('API key cannot be empty');
    }
    if (value.length < 10) {
      throw new Error('API key appears to be invalid (too short)');
    }
  }

  getValue(): string {
    return this.value;
  }

  getMasked(): string {
    const visible = this.value.slice(0, 4);
    const masked = '*'.repeat(Math.max(0, this.value.length - 8));
    const ending = this.value.slice(-4);
    return `${visible}${masked}${ending}`;
  }

  equals(other: ApiKey): boolean {
    return this.value === other.value;
  }
}

export class QueryText {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Query text cannot be empty');
    }
    if (value.length > 4000) {
      throw new Error('Query text cannot exceed 4000 characters');
    }
  }

  getValue(): string {
    return this.value;
  }

  getWordCount(): number {
    return this.value.trim().split(/\s+/).length;
  }

  equals(other: QueryText): boolean {
    return this.value === other.value;
  }
}

export class QueryId {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Query ID cannot be empty');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: QueryId): boolean {
    return this.value === other.value;
  }

  static generate(): QueryId {
    return new QueryId(crypto.randomUUID());
  }
}

// Domain Entities
export interface TTSSettings {
  readonly provider: ModelProvider;
  readonly model: string; // Union of OpenAIModel | ElevenLabsModel | string for extensibility
  readonly voice: Voice | string; // Allow custom voices
  readonly apiKey: ApiKey;
  readonly speed?: number; // 0.25 to 4.0 for OpenAI
  readonly pitch?: number; // Provider-specific
  readonly stability?: number; // ElevenLabs specific
  readonly similarityBoost?: number; // ElevenLabs specific
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
    readonly details?: any;
  };
  readonly processingTime?: number; // Time taken in milliseconds
}
