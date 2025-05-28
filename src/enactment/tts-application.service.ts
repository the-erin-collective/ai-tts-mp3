// filepath: d:\dev\github\ai-tts-mp3\src\enactment\tts-application.service.ts
import { 
  TTSQuery, 
  TTSResult, 
  TTSSettings, 
  QueryId, 
  QueryText, 
  TTSResultStatus,
  ApiKey 
} from '../domain/tts.entity';
import { 
  TTSQueryRepository, 
  TTSResultRepository, 
  TTSSettingsRepository, 
  TTSDomainService 
} from '../domain/tts.repository';
import { ProviderConfig, ProviderError, ProviderErrorType } from '../domain/provider.entity';
import { AudioMetadata, AudioFormat, AudioQuality } from '../domain/audio.entity';
import { Result } from '../common/result';
import { Logger } from '../common/utils';
import { OpenAITTSService } from '../infrastructure/openai-tts.service';

// Application Service for TTS operations
export class TTSApplicationService {
  private readonly openAITTS: OpenAITTSService;

  constructor(
    private readonly queryRepository: TTSQueryRepository,
    private readonly resultRepository: TTSResultRepository,
    private readonly settingsRepository: TTSSettingsRepository,
    private readonly domainService: TTSDomainService
  ) {
    this.openAITTS = new OpenAITTSService();
  }

  async createTTSQuery(
    text: string, 
    settings: TTSSettings,
    metadata?: { title?: string; tags?: string[] }
  ): Promise<Result<TTSQuery, string>> {
    try {
      Logger.info('Creating TTS query', { textLength: text.length, provider: settings.provider });

      // Validate settings using domain service
      this.domainService.validateSettings(settings);

      // Create value objects
      const queryText = new QueryText(text);
      const queryId = QueryId.generate();

      // Check if query can be processed
      const canProcess = await this.domainService.canProcessQuery({
        id: queryId,
        text: queryText,
        settings,
        createdAt: new Date(),
        metadata
      });

      if (!canProcess) {
        return Result.failure('Text is too long for the selected provider');
      }

      // Create query entity
      const query: TTSQuery = {
        id: queryId,
        text: queryText,
        settings,
        createdAt: new Date(),
        metadata: {
          ...metadata,
          estimatedDuration: this.estimateDuration(text)
        }
      };

      // Save query
      await this.queryRepository.save(query);

      // Create initial result record
      const result: TTSResult = {
        queryId: queryId,
        status: TTSResultStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.resultRepository.save(result);

      Logger.info('TTS query created successfully', { queryId: queryId.getValue() });
      return Result.success(query);

    } catch (error) {
      Logger.error('Failed to create TTS query', error as Error, { textLength: text.length });
      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async processTTSQuery(queryId: string): Promise<Result<TTSResult, string>> {
    try {
      Logger.info('Processing TTS query', { queryId });

      const query = await this.queryRepository.findById(new QueryId(queryId));
      if (!query) {
        return Result.failure('Query not found');
      }      // Update status to processing
      await this.resultRepository.updateStatus(query.id, TTSResultStatus.PROCESSING);

      // Calculate estimated cost
      const estimatedCost = await this.domainService.estimateCost(query);
      Logger.info('Estimated cost for query', { queryId, cost: estimatedCost });

      // Generate speech using OpenAI TTS API
      let audioData: Uint8Array;
      let duration: number;

      if (query.settings.provider === 'openai') {
        try {
          audioData = await this.openAITTS.generateSpeech(query.text, query.settings);
          duration = this.estimateDuration(query.text.getValue());
        } catch (error) {
          Logger.error('OpenAI TTS API failed', error as Error, { queryId });
            if (error instanceof ProviderError) {
            await this.resultRepository.updateWithError(query.id, {
              code: error.type,
              message: error.message,
              details: error
            });
            return Result.failure(error.message);
          }
          
          throw error;
        }
      } else {
        // Fallback for other providers (mock data for now)
        Logger.warn('Using mock data for non-OpenAI provider', { provider: query.settings.provider });
        audioData = new Uint8Array([/* mock MP3 data */]);
        duration = this.estimateDuration(query.text.getValue());
      }

      await this.resultRepository.updateWithAudio(query.id, audioData, duration);

      const result = await this.resultRepository.findByQueryId(query.id);
      if (!result) {
        return Result.failure('Failed to retrieve processing result');
      }

      Logger.info('TTS query processed successfully', { queryId });
      return Result.success(result);

    } catch (error) {
      Logger.error('Failed to process TTS query', error as Error, { queryId });
      
      // Update result with error
      await this.resultRepository.updateWithError(
        new QueryId(queryId),
        {
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        }
      );

      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async getQueryResult(queryId: string): Promise<Result<TTSResult, string>> {
    try {
      Logger.info('Fetching query result', { queryId });
      const result = await this.resultRepository.findByQueryId(new QueryId(queryId));
      
      if (!result) {
        return Result.failure('Result not found');
      }

      return Result.success(result);
    } catch (error) {
      Logger.error('Failed to fetch query result', error as Error, { queryId });
      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async getRecentQueries(limit: number = 10): Promise<Result<TTSQuery[], string>> {
    try {
      Logger.info('Fetching recent queries', { limit });
      const queries = await this.queryRepository.findRecent(limit);
      return Result.success(queries);
    } catch (error) {
      Logger.error('Failed to fetch recent queries', error as Error);
      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async saveSettings(settings: TTSSettings): Promise<Result<void, string>> {
    try {
      Logger.info('Saving TTS settings', { provider: settings.provider });
      this.domainService.validateSettings(settings);
      await this.settingsRepository.save(settings);
      return Result.success(undefined);
    } catch (error) {
      Logger.error('Failed to save settings', error as Error);
      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async loadSettings(): Promise<Result<TTSSettings | null, string>> {
    try {
      Logger.info('Loading TTS settings');
      const settings = await this.settingsRepository.load();
      return Result.success(settings);
    } catch (error) {
      Logger.error('Failed to load settings', error as Error);
      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async deleteQuery(queryId: string): Promise<Result<void, string>> {
    try {
      Logger.info('Deleting query', { queryId });
      const id = new QueryId(queryId);
      
      // Delete both query and result
      await this.queryRepository.delete(id);
      await this.resultRepository.delete(id);
      
      Logger.info('Query deleted successfully', { queryId });
      return Result.success(undefined);
    } catch (error) {
      Logger.error('Failed to delete query', error as Error, { queryId });
      return Result.failure(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private estimateDuration(text: string): number {
    // Rough estimation: average speaking rate is about 150-200 words per minute
    const words = text.trim().split(/\s+/).length;
    const wordsPerMinute = 175; // Average speaking rate
    return Math.ceil((words / wordsPerMinute) * 60); // Duration in seconds
  }
}
