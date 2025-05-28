// filepath: d:\dev\github\ai-tts-mp3\src\integration\angular-tts.service.ts
import { Injectable } from '@angular/core';
import { TTSApplicationService } from '../enactment/tts-application.service';
import { 
  TTSQueryRepository, 
  TTSResultRepository, 
  TTSSettingsRepository, 
  TTSDomainService 
} from '../domain/tts.repository';
import { 
  InMemoryTTSQueryRepository, 
  InMemoryTTSResultRepository, 
  LocalStorageTTSSettingsRepository 
} from '../infrastructure/in-memory-tts.repository';
import { TTSSettings, TTSQuery, TTSResult } from '../domain/tts.entity';

// Integration layer - Dependency Injection configuration
@Injectable({
  providedIn: 'root'
})
export class TTSServiceFactory {
  private static ttsApplicationService: TTSApplicationService | null = null;

  static createTTSApplicationService(): TTSApplicationService {
    if (!this.ttsApplicationService) {
      const queryRepository: TTSQueryRepository = new InMemoryTTSQueryRepository();
      const resultRepository: TTSResultRepository = new InMemoryTTSResultRepository();
      const settingsRepository: TTSSettingsRepository = new LocalStorageTTSSettingsRepository();
      const domainService = new TTSDomainService(queryRepository, resultRepository);
      
      this.ttsApplicationService = new TTSApplicationService(
        queryRepository,
        resultRepository,
        settingsRepository,
        domainService
      );
    }
    return this.ttsApplicationService;
  }
}

// Angular service wrapper for the TTS application service
@Injectable({
  providedIn: 'root'
})
export class AngularTTSService {
  private readonly ttsApplicationService: TTSApplicationService;

  constructor() {
    this.ttsApplicationService = TTSServiceFactory.createTTSApplicationService();
  }

  // TTS Query operations
  async createTTSQuery(
    text: string, 
    settings: TTSSettings,
    metadata?: { title?: string; tags?: string[] }
  ) {
    return this.ttsApplicationService.createTTSQuery(text, settings, metadata);
  }

  async processTTSQuery(queryId: string) {
    return this.ttsApplicationService.processTTSQuery(queryId);
  }

  async getQueryResult(queryId: string) {
    return this.ttsApplicationService.getQueryResult(queryId);
  }

  async getRecentQueries(limit?: number) {
    return this.ttsApplicationService.getRecentQueries(limit);
  }

  async deleteQuery(queryId: string) {
    return this.ttsApplicationService.deleteQuery(queryId);
  }

  // Settings operations
  async saveSettings(settings: TTSSettings) {
    return this.ttsApplicationService.saveSettings(settings);
  }

  async loadSettings() {
    return this.ttsApplicationService.loadSettings();
  }

  // Utility methods for the presentation layer
  async generateSpeech(text: string, settings: TTSSettings): Promise<TTSResult | null> {
    const queryResult = await this.createTTSQuery(text, settings);
    if (!queryResult.isSuccess) {
      return null;
    }

    const processResult = await this.processTTSQuery(queryResult.getValue().id.getValue());
    if (!processResult.isSuccess) {
      return null;
    }

    return processResult.getValue() || null;
  }

  async downloadAudio(result: TTSResult): Promise<string | null> {
    if (!result.audioData) {
      return null;
    }

    // Create blob URL for download
    const blob = new Blob([result.audioData], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  }

  async playAudio(result: TTSResult): Promise<HTMLAudioElement | null> {
    const audioUrl = await this.downloadAudio(result);
    if (!audioUrl) {
      return null;
    }

    const audio = new Audio(audioUrl);
    return audio;
  }
}
