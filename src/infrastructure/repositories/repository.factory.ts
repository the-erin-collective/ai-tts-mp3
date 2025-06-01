// Repository Factory for TTS Domain
import { Injectable } from '@angular/core';
import { TTSQueryRepository, TTSResultRepository, TTSSettingsRepository } from '../../domain/tts.repository';
import { InMemoryTTSQueryRepository } from './tts-query.repository';
import { InMemoryTTSResultRepository } from './tts-result.repository';
import { LocalStorageTTSSettingsRepository } from './tts-settings.repository';

export enum RepositoryType {
  IN_MEMORY = 'in-memory',
  LOCAL_STORAGE = 'local-storage',
  INDEXED_DB = 'indexed-db',
  REMOTE = 'remote'
}

export interface RepositoryConfig {
  queryRepository?: RepositoryType;
  resultRepository?: RepositoryType;
  settingsRepository?: RepositoryType;
}

@Injectable({
  providedIn: 'root'
})
export class TTSRepositoryFactory {
  private readonly defaultConfig: RepositoryConfig = {
    queryRepository: RepositoryType.IN_MEMORY,
    resultRepository: RepositoryType.IN_MEMORY,
    settingsRepository: RepositoryType.LOCAL_STORAGE
  };

  createQueryRepository(type: RepositoryType = this.defaultConfig.queryRepository!): TTSQueryRepository {
    switch (type) {
      case RepositoryType.IN_MEMORY:
        return new InMemoryTTSQueryRepository();
      case RepositoryType.INDEXED_DB:
        // TODO: Implement IndexedDB repository
        throw new Error('IndexedDB repository not yet implemented');
      case RepositoryType.REMOTE:
        // TODO: Implement remote repository
        throw new Error('Remote repository not yet implemented');
      default:
        throw new Error(`Unsupported repository type: ${type}`);
    }
  }

  createResultRepository(type: RepositoryType = this.defaultConfig.resultRepository!): TTSResultRepository {
    switch (type) {
      case RepositoryType.IN_MEMORY:
        return new InMemoryTTSResultRepository();
      case RepositoryType.INDEXED_DB:
        // TODO: Implement IndexedDB repository
        throw new Error('IndexedDB repository not yet implemented');
      case RepositoryType.REMOTE:
        // TODO: Implement remote repository
        throw new Error('Remote repository not yet implemented');
      default:
        throw new Error(`Unsupported repository type: ${type}`);
    }
  }

  createSettingsRepository(type: RepositoryType = this.defaultConfig.settingsRepository!): TTSSettingsRepository {
    switch (type) {
      case RepositoryType.LOCAL_STORAGE:
        return new LocalStorageTTSSettingsRepository();
      case RepositoryType.IN_MEMORY:
        // For settings, fallback to localStorage implementation since it handles in-memory gracefully
        return new LocalStorageTTSSettingsRepository();
      case RepositoryType.INDEXED_DB:
        // TODO: Implement IndexedDB repository
        throw new Error('IndexedDB repository not yet implemented');
      case RepositoryType.REMOTE:
        // TODO: Implement remote repository
        throw new Error('Remote repository not yet implemented');
      default:
        throw new Error(`Unsupported repository type: ${type}`);
    }
  }

  createRepositorySet(config: RepositoryConfig = {}): {
    queryRepository: TTSQueryRepository;
    resultRepository: TTSResultRepository;
    settingsRepository: TTSSettingsRepository;
  } {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    return {
      queryRepository: this.createQueryRepository(finalConfig.queryRepository),
      resultRepository: this.createResultRepository(finalConfig.resultRepository),
      settingsRepository: this.createSettingsRepository(finalConfig.settingsRepository)
    };
  }
}
