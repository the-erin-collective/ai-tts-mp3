// Infrastructure implementation of TTS Query Repository
import { Injectable } from '@angular/core';
import { TTSQuery, QueryId } from '../../domain/tts.entity';
import { TTSQueryRepository } from '../../domain/tts.repository';
import { Logger } from '../../common/utils';

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
