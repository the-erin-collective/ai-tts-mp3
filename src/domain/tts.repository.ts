// filepath: d:\dev\github\ai-tts-mp3\src\domain\tts.repository.ts
import { TTSQuery, TTSResult, TTSSettings, QueryId, ModelProvider } from './tts.entity';

// Domain Repository Contracts (Interfaces)
export abstract class TTSQueryRepository {
  abstract save(query: TTSQuery): Promise<void>;
  abstract findById(id: QueryId): Promise<TTSQuery | null>;
  abstract findRecent(limit?: number): Promise<TTSQuery[]>;
  abstract delete(id: QueryId): Promise<void>;
}

export abstract class TTSResultRepository {
  abstract save(result: TTSResult): Promise<void>;
  abstract findByQueryId(queryId: QueryId): Promise<TTSResult | null>;
  abstract updateStatus(queryId: QueryId, status: TTSResult['status']): Promise<void>;
  abstract updateWithAudio(queryId: QueryId, audioData: Uint8Array, duration: number): Promise<void>;
  abstract updateWithError(queryId: QueryId, error: TTSResult['error']): Promise<void>;
  abstract delete(queryId: QueryId): Promise<void>;
}

// Settings Repository for local storage (optional persistence)
export abstract class TTSSettingsRepository {
  abstract save(settings: TTSSettings): Promise<void>;
  abstract load(): Promise<TTSSettings | null>;
  abstract clear(): Promise<void>;
}

// Domain Services
export class TTSDomainService {
  constructor(
    private queryRepository: TTSQueryRepository,
    private resultRepository: TTSResultRepository
  ) {}

  validateSettings(settings: TTSSettings): void {
    if (!settings.provider) {
      throw new Error('Provider is required');
    }

    if (!settings.model) {
      throw new Error('Model is required');
    }

    if (!settings.voice) {
      throw new Error('Voice is required');
    }    // Provider-specific validations can be added here when needed
  }

  async estimateCost(query: TTSQuery): Promise<number> {
    const wordCount = query.text.getWordCount();
    
    // Rough cost estimation based on provider
    switch (query.settings.provider) {
      case ModelProvider.OPENAI:
        return wordCount * 0.000015; // $15 per 1M characters, rough conversion
      case ModelProvider.ELEVENLABS:
        return Math.ceil(wordCount / 100) * 0.0003; // Character-based pricing
      default:
        return 0; // Unknown pricing
    }
  }

  async canProcessQuery(query: TTSQuery): Promise<boolean> {
    // Check if query text is within limits
    const textLength = query.text.getValue().length;
    
    switch (query.settings.provider) {
      case ModelProvider.OPENAI:
        return textLength <= 4096;
      case ModelProvider.ELEVENLABS:
        return textLength <= 5000;
      default:
        return textLength <= 4000;
    }
  }
}
