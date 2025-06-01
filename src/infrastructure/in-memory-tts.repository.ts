import { Injectable } from '@angular/core';
import { 
  TTSQuery, 
  TTSResult, 
  TTSSettings, 
  QueryId, 
  TTSResultStatus
} from '../domain/tts.entity';
import { 
  TTSQueryRepository, 
  TTSResultRepository, 
  TTSSettingsRepository 
} from '../domain/tts.repository';
import { Logger } from '../common/utils';

// Infrastructure implementation of TTS Query Repository
@Injectable({
  providedIn: 'root'
})
export class InMemoryTTSQueryRepository extends TTSQueryRepository {
  private queries: TTSQuery[] = [];

  async save(query: TTSQuery): Promise<void> {
    Logger.info('Saving TTS query to in-memory store', { queryId: query.id.getValue() });
    
    const existingIndex = this.queries.findIndex(q => q.id.getValue() === query.id.getValue());
    if (existingIndex >= 0) {
      this.queries[existingIndex] = query;
      Logger.info('TTS query updated in store');
    } else {
      this.queries.push(query);
      Logger.info('TTS query added to store');
    }
  }

  async findById(id: QueryId): Promise<TTSQuery | null> {
    Logger.info('Searching for TTS query by ID', { id: id.getValue() });
    const query = this.queries.find(q => q.id.getValue() === id.getValue()) || null;
    Logger.info('TTS query search result', { found: !!query });
    return query;
  }

  async findRecent(limit = 10): Promise<TTSQuery[]> {
    Logger.info('Fetching recent TTS queries', { limit, totalCount: this.queries.length });
    return [...this.queries]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async delete(id: QueryId): Promise<void> {
    Logger.info('Deleting TTS query from in-memory store', { id: id.getValue() });
    
    const initialLength = this.queries.length;
    this.queries = this.queries.filter(q => q.id.getValue() !== id.getValue());
    
    if (this.queries.length < initialLength) {
      Logger.info('TTS query deleted from store');
    } else {
      Logger.warn('TTS query not found for deletion', { id: id.getValue() });
    }
  }
}

// Infrastructure implementation of TTS Result Repository
@Injectable({
  providedIn: 'root'
})
export class InMemoryTTSResultRepository extends TTSResultRepository {
  private results: TTSResult[] = [];

  async save(result: TTSResult): Promise<void> {
    Logger.info('Saving TTS result to in-memory store', { queryId: result.queryId.getValue() });
    
    const existingIndex = this.results.findIndex(r => r.queryId.getValue() === result.queryId.getValue());
    if (existingIndex >= 0) {
      this.results[existingIndex] = { ...result, updatedAt: new Date() };
      Logger.info('TTS result updated in store');
    } else {
      this.results.push(result);
      Logger.info('TTS result added to store');
    }
  }

  async findByQueryId(queryId: QueryId): Promise<TTSResult | null> {
    Logger.info('Searching for TTS result by query ID', { queryId: queryId.getValue() });
    const result = this.results.find(r => r.queryId.getValue() === queryId.getValue()) || null;
    Logger.info('TTS result search result', { found: !!result });
    return result;
  }

  async updateStatus(queryId: QueryId, status: TTSResultStatus): Promise<void> {
    Logger.info('Updating TTS result status', { queryId: queryId.getValue(), status });
    
    const existingIndex = this.results.findIndex(r => r.queryId.getValue() === queryId.getValue());
    if (existingIndex >= 0) {
      this.results[existingIndex] = {
        ...this.results[existingIndex],
        status,
        updatedAt: new Date()
      };
      Logger.info('TTS result status updated');
    } else {
      Logger.warn('TTS result not found for status update', { queryId: queryId.getValue() });
    }
  }

  async updateWithAudio(queryId: QueryId, audioData: Uint8Array, duration: number): Promise<void> {
    Logger.info('Updating TTS result with audio data', { 
      queryId: queryId.getValue(), 
      audioSize: audioData.length,
      duration 
    });
    
    const existingIndex = this.results.findIndex(r => r.queryId.getValue() === queryId.getValue());
    if (existingIndex >= 0) {
      this.results[existingIndex] = {
        ...this.results[existingIndex],
        status: TTSResultStatus.COMPLETED,
        audioData,
        duration,
        fileSize: audioData.length,
        updatedAt: new Date()
      };
      Logger.info('TTS result updated with audio data');
    } else {
      Logger.warn('TTS result not found for audio update', { queryId: queryId.getValue() });
    }
  }

  async updateWithError(queryId: QueryId, error: TTSResult['error']): Promise<void> {
    Logger.info('Updating TTS result with error', { queryId: queryId.getValue(), error });
    
    const existingIndex = this.results.findIndex(r => r.queryId.getValue() === queryId.getValue());
    if (existingIndex >= 0) {
      this.results[existingIndex] = {
        ...this.results[existingIndex],
        status: TTSResultStatus.FAILED,
        error,
        updatedAt: new Date()
      };
      Logger.info('TTS result updated with error');
    } else {
      Logger.warn('TTS result not found for error update', { queryId: queryId.getValue() });
    }
  }

  async delete(queryId: QueryId): Promise<void> {
    Logger.info('Deleting TTS result from in-memory store', { queryId: queryId.getValue() });
    
    const initialLength = this.results.length;
    this.results = this.results.filter(r => r.queryId.getValue() !== queryId.getValue());
    
    if (this.results.length < initialLength) {
      Logger.info('TTS result deleted from store');
    } else {
      Logger.warn('TTS result not found for deletion', { queryId: queryId.getValue() });
    }
  }
}

// Infrastructure implementation of TTS Settings Repository (Local Storage)
@Injectable({
  providedIn: 'root'
})
export class LocalStorageTTSSettingsRepository extends TTSSettingsRepository {
  private readonly SETTINGS_KEY = 'ai-tts-mp3-settings';

  async save(settings: TTSSettings): Promise<void> {
    try {
      Logger.info('Saving TTS settings to local storage', { provider: settings.provider });
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        Logger.info('localStorage not available, skipping save');
        return;
      }
      
      // Serialize settings for storage - don't include API key
      const storageData = {
        provider: settings.provider,
        model: settings.model,
        voice: settings.voice
      };

      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(storageData));
      Logger.info('TTS settings saved to local storage');
    } catch (error: unknown) {
      Logger.error('Failed to save TTS settings to local storage', error as Error);
      throw error;
    }
  }

  async load(): Promise<TTSSettings | null> {
    try {
      Logger.info('Loading TTS settings from local storage');
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        Logger.info('localStorage not available, returning null');
        return null;
      }
      
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (!stored) {
        Logger.info('No TTS settings found in local storage');
        return null;
      }

      const data = JSON.parse(stored);      const settings: TTSSettings = {
        provider: data.provider,
        model: data.model,
        voice: data.voice
      };

      Logger.info('TTS settings loaded from local storage', { 
        provider: settings.provider || 'none',
        model: settings.model || 'none',
        voice: settings.voice || 'none'
      });
      return settings;
    } catch (error: unknown) {
      Logger.error('Failed to load TTS settings from local storage', error as Error);
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      Logger.info('Clearing TTS settings from local storage');
      
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        Logger.info('localStorage not available, skipping clear');
        return;
      }
      
      localStorage.removeItem(this.SETTINGS_KEY);
      Logger.info('TTS settings cleared from local storage');
    } catch (error: unknown) {
      Logger.error('Failed to clear TTS settings from local storage', error as Error);
      throw error;
    }
  }
}
