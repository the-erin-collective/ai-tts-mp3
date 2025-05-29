// Domain interface for TTS provider services
import { TTSSettings } from './tts.entity';

export interface TTSProviderService {
  generateSpeech(text: string, settings: TTSSettings): Promise<Uint8Array>;
}
