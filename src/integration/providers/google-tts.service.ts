// Google Cloud Text-to-Speech provider implementation
import { Injectable } from '@angular/core';
import { LoggingService } from '../logging.service';
import { MonitoringService } from '../monitoring.service';
import { TTSSettings, TTSResult, QueryId, ModelProvider, TTSResultStatus } from '../../domain/tts.entity';
import { Result } from '../../common/result';

export interface GoogleVoice {
  languageCodes: string[];
  name: string;
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  naturalSampleRateHertz: number;
}

export interface GoogleAudioConfig {
  audioEncoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS' | 'MULAW' | 'ALAW';
  speakingRate?: number; // 0.25 to 4.0
  pitch?: number; // -20.0 to 20.0
  volumeGainDb?: number; // -96.0 to 16.0
  sampleRateHertz?: number;
  effectsProfileId?: string[];
}

export interface GoogleSynthesisInput {
  text?: string;
  ssml?: string;
}

export interface GoogleVoiceSelectionParams {
  languageCode: string;
  name?: string;
  ssmlGender?: 'MALE' | 'FEMALE' | 'NEUTRAL';
}

export interface GoogleTTSRequest {
  input: GoogleSynthesisInput;
  voice: GoogleVoiceSelectionParams;
  audioConfig: GoogleAudioConfig;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleTTSService {
  private readonly baseUrl = 'https://texttospeech.googleapis.com/v1';
  private cachedVoices: GoogleVoice[] | null = null;

  constructor(
    private logging: LoggingService,
    private monitoring: MonitoringService
  ) {
    this.logging.info('GoogleTTSService initialized', 'Google');
  }

  // Core TTS functionality
  async synthesizeSpeech(
    text: string,
    settings: TTSSettings,
    queryId: QueryId
  ): Promise<Result<TTSResult, string>> {
    if (!settings.apiKey) {
      return Result.failure('Google Cloud API key is required');
    }

    return this.logging.trackPerformance(
      'googleSynthesize',
      async () => {
        const startTime = Date.now();
        
        this.logging.info('Starting Google synthesis', 'Google', {
          textLength: text.length,
          voice: settings.voice,
          languageCode: this.extractLanguageFromVoice(settings.voice)
        });

        try {
          const audioData = await this.makeTextToSpeechRequest(text, settings);
          const processingTime = Date.now() - startTime;

          this.monitoring.recordRequest(ModelProvider.GOOGLE, true, processingTime);          const result: TTSResult = {
            queryId,
            status: TTSResultStatus.COMPLETED,
            createdAt: new Date(),
            updatedAt: new Date(),
            audioData,
            duration: this.estimateAudioDuration(audioData),
            fileSize: audioData.byteLength,
            processingTime
          };

          this.logging.info('Google synthesis completed successfully', 'Google', {
            fileSize: audioData.byteLength,
            duration: result.duration,
            processingTime
          });

          return Result.success(result);

        } catch (error) {
          const processingTime = Date.now() - startTime;
          this.monitoring.recordRequest(ModelProvider.GOOGLE, false, processingTime);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          this.logging.error('Google synthesis failed', error as Error, 'Google');          const result: TTSResult = {
            queryId,
            status: TTSResultStatus.FAILED,
            createdAt: new Date(),
            updatedAt: new Date(),
            error: {
              code: 'SYNTHESIS_ERROR',
              message: errorMessage,
              details: error
            },
            processingTime
          };

          return Result.success(result);
        }
      },
      'Google'
    );
  }

  // Voice management
  async getAvailableVoices(apiKey: string): Promise<Result<GoogleVoice[], string>> {
    if (this.cachedVoices) {
      return Result.success(this.cachedVoices);
    }

    return this.logging.trackPerformance(
      'googleGetVoices',
      async () => {
        try {
          const response = await fetch(`${this.baseUrl}/voices?key=${apiKey}`, {
            headers: {
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          this.cachedVoices = data.voices;

          this.logging.info(`Retrieved ${this.cachedVoices!.length} Google voices`, 'Google');
          return Result.success(this.cachedVoices!);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch voices';
          this.logging.error('Failed to fetch Google voices', error as Error, 'Google');
          return Result.failure(errorMessage);
        }
      },
      'Google'
    );
  }

  // SSML generation
  generateSSML(text: string, options?: {
    speakingRate?: number;
    pitch?: string;
    volume?: string;
    emphasis?: 'strong' | 'moderate' | 'reduced';
    prosody?: {
      rate?: string;
      pitch?: string;
      volume?: string;
    };
  }): string {
    let ssml = '<speak>';

    if (options?.prosody) {
      ssml += '<prosody';
      if (options.prosody.rate) ssml += ` rate="${options.prosody.rate}"`;
      if (options.prosody.pitch) ssml += ` pitch="${options.prosody.pitch}"`;
      if (options.prosody.volume) ssml += ` volume="${options.prosody.volume}"`;
      ssml += '>';
    }

    if (options?.emphasis) {
      ssml += `<emphasis level="${options.emphasis}">`;
    }

    ssml += text;

    if (options?.emphasis) {
      ssml += '</emphasis>';
    }

    if (options?.prosody) {
      ssml += '</prosody>';
    }

    ssml += '</speak>';
    return ssml;
  }

  // Audio effects and customization
  getAudioEffectsProfiles(): string[] {
    return [
      'wearable-class-device',
      'handset-class-device',
      'headphone-class-device',
      'small-bluetooth-speaker-class-device',
      'medium-bluetooth-speaker-class-device',
      'large-home-entertainment-class-device',
      'large-automotive-class-device',
      'telephony-class-application'
    ];
  }

  // Validation and capabilities
  async validateConfiguration(settings: TTSSettings): Promise<Result<boolean, string>> {
    if (!settings.apiKey) {
      return Result.failure('API key is required');
    }    // Test API key by fetching voices
    const voicesResult = await this.getAvailableVoices(settings.apiKey.getValue());
    if (voicesResult.isFailure()) {
      return Result.failure(`Invalid API key: ${voicesResult.getError()}`);
    }

    this.logging.info('Google configuration validated successfully', 'Google');
    return Result.success(true);
  }

  getCapabilities() {
    return {
      maxTextLength: 5000, // Google Cloud TTS limit
      supportedFormats: ['mp3', 'wav', 'ogg'],
      supportsSSML: true,
      supportsStreaming: false,
      defaultModel: 'Standard', // Google uses voice types instead of models
      defaultVoice: 'en-US-Standard-J',
      requiresApiKey: true,
      supportedLanguages: this.getSupportedLanguages()
    };
  }

  // Language support
  getSupportedLanguages(): string[] {
    return [
      'ar-XA', 'bn-IN', 'bg-BG', 'ca-ES', 'yue-HK', 'cs-CZ', 'da-DK',
      'nl-BE', 'nl-NL', 'en-AU', 'en-IN', 'en-GB', 'en-US', 'et-EE',
      'fi-FI', 'fr-CA', 'fr-FR', 'de-DE', 'el-GR', 'gu-IN', 'he-IL',
      'hi-IN', 'hu-HU', 'is-IS', 'id-ID', 'it-IT', 'ja-JP', 'kn-IN',
      'ko-KR', 'lv-LV', 'lt-LT', 'ms-MY', 'ml-IN', 'cmn-CN', 'cmn-TW',
      'mr-IN', 'nb-NO', 'pl-PL', 'pt-BR', 'pt-PT', 'pa-IN', 'ro-RO',
      'ru-RU', 'sr-RS', 'sk-SK', 'sl-SI', 'es-ES', 'es-MX', 'es-US',
      'sv-SE', 'ta-IN', 'te-IN', 'th-TH', 'tr-TR', 'uk-UA', 'vi-VN'
    ];
  }

  // Voice filtering helpers
  getVoicesByLanguage(voices: GoogleVoice[], languageCode: string): GoogleVoice[] {
    return voices.filter(voice => voice.languageCodes.includes(languageCode));
  }

  getVoicesByGender(voices: GoogleVoice[], gender: 'MALE' | 'FEMALE' | 'NEUTRAL'): GoogleVoice[] {
    return voices.filter(voice => voice.ssmlGender === gender);
  }

  // Clear caches
  clearCache(): void {
    this.cachedVoices = null;
    this.logging.info('Google cache cleared', 'Google');
  }

  // Private helper methods
  private async makeTextToSpeechRequest(text: string, settings: TTSSettings): Promise<Uint8Array> {
    const voice = settings.voice || 'en-US-Standard-J';
    const languageCode = this.extractLanguageFromVoice(voice);

    const requestBody: GoogleTTSRequest = {
      input: { text },
      voice: {
        languageCode,
        name: voice
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0
      }
    };

    const response = await fetch(`${this.baseUrl}/text:synthesize?key=${settings.apiKey!.getValue()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (!data.audioContent) {
      throw new Error('No audio content received from Google API');
    }

    // Google returns base64 encoded audio
    const audioData = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0));
    return audioData;
  }

  private extractLanguageFromVoice(voice?: string): string {
    if (!voice) {
      return 'en-US';
    }

    // Extract language code from voice name (e.g., "en-US-Standard-J" -> "en-US")
    const match = voice.match(/^([a-z]{2,3}-[A-Z]{2})/);
    return match ? match[1] : 'en-US';
  }

  private estimateAudioDuration(audioData: Uint8Array): number {
    // Rough estimation for MP3: assumes 64kbps bitrate (Google default)
    const bytesPerSecond = 64 * 1024 / 8; // 64kbps in bytes per second
    return audioData.byteLength / bytesPerSecond;
  }
}
