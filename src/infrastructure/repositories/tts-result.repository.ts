// Infrastructure implementation of TTS Result Repository
import { Injectable } from '@angular/core';
import { TTSResult, QueryId, TTSResultStatus } from '../../domain/tts.entity';
import { TTSResultRepository } from '../../domain/tts.repository';
import { Logger } from '../../common/utils';

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
