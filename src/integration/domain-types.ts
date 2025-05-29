// Integration layer re-exports for domain entities
// This allows the presentation layer to access domain entities through the integration layer

export type { 
  TTSSettings, 
  TTSResult, 
  TTSQuery
} from '../domain/tts.entity';

export { 
  ModelProvider,
  Voice,
  ApiKey,
  TTSResultStatus,
  QueryId,
  QueryText
} from '../domain/tts.entity';

export { 
  ProviderError 
} from '../domain/provider.entity';
