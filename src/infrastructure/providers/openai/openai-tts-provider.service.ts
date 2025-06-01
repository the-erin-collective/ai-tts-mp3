// Infrastructure implementation of TTS provider service
import { TTSProviderService } from '../../../domain/tts-provider.interface';
import { OpenAITTSService } from './openai-tts.service';
import { TTSSettings, QueryText } from '../../../domain/tts.entity';

export class OpenAITTSProviderService implements TTSProviderService {
  private readonly openAIService = new OpenAITTSService();

  async generateSpeech(text: string, settings: TTSSettings): Promise<Uint8Array> {
    const queryText = QueryText.fromString(text);
    return this.openAIService.generateSpeech(queryText, settings);
  }
}
