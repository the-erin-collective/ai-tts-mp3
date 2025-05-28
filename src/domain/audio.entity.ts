
// Audio format and quality enums
export enum AudioFormat {
  MP3 = 'mp3',
  WAV = 'wav',
  OGG = 'ogg',
  AAC = 'aac'
}

export enum AudioQuality {
  LOW = 'low',      // 64kbps
  MEDIUM = 'medium', // 128kbps
  HIGH = 'high',    // 192kbps
  PREMIUM = 'premium' // 320kbps
}

// Value Objects
export class AudioMetadata {
  constructor(
    private readonly format: AudioFormat,
    private readonly quality: AudioQuality,
    private readonly sampleRate: number,
    private readonly bitRate: number,
    private readonly channels: number = 1 // Mono by default for TTS
  ) {
    if (sampleRate <= 0) {
      throw new Error('Sample rate must be positive');
    }
    if (bitRate <= 0) {
      throw new Error('Bit rate must be positive');
    }
    if (channels < 1 || channels > 2) {
      throw new Error('Channels must be 1 (mono) or 2 (stereo)');
    }
  }

  getFormat(): AudioFormat {
    return this.format;
  }

  getQuality(): AudioQuality {
    return this.quality;
  }

  getSampleRate(): number {
    return this.sampleRate;
  }

  getBitRate(): number {
    return this.bitRate;
  }

  getChannels(): number {
    return this.channels;
  }

  getEstimatedFileSize(durationSeconds: number): number {
    // Rough estimation: bitRate * duration / 8 (convert bits to bytes)
    return Math.ceil((this.bitRate * 1000 * durationSeconds) / 8);
  }
}

export class AudioChunk {
  constructor(
    private readonly data: Uint8Array,
    private readonly sequenceNumber: number,
    private readonly isLast: boolean = false
  ) {
    if (data.length === 0) {
      throw new Error('Audio chunk cannot be empty');
    }
    if (sequenceNumber < 0) {
      throw new Error('Sequence number must be non-negative');
    }
  }

  getData(): Uint8Array {
    return this.data;
  }

  getSequenceNumber(): number {
    return this.sequenceNumber;
  }

  isLastChunk(): boolean {
    return this.isLast;
  }

  getSize(): number {
    return this.data.length;
  }
}

// Domain Entity for streaming audio
export interface AudioStream {
  readonly queryId: string;
  readonly metadata: AudioMetadata;
  readonly totalChunks?: number;
  readonly estimatedDuration?: number;
  readonly createdAt: Date;
}

// Domain Entity for processed audio file
export interface AudioFile {
  readonly id: string;
  readonly queryId: string;
  readonly filename: string;
  readonly metadata: AudioMetadata;
  readonly data: Uint8Array;
  readonly duration: number; // in seconds
  readonly fileSize: number; // in bytes
  readonly checksum?: string; // MD5 or SHA-256 hash
  readonly createdAt: Date;
}

// Audio processing configuration
export interface AudioProcessingConfig {
  readonly targetFormat: AudioFormat;
  readonly targetQuality: AudioQuality;
  readonly normalize: boolean; // Normalize audio levels
  readonly removesilence: boolean; // Remove leading/trailing silence
  readonly fadeIn?: number; // Fade in duration in milliseconds
  readonly fadeOut?: number; // Fade out duration in milliseconds
}
