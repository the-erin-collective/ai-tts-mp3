// Azure Cognitive Services TTS provider implementation
import { Injectable } from '@angular/core';
import { LoggingService } from '../logging.service';
import { MonitoringService } from '../monitoring.service';
import { TTSSettings, TTSResult, QueryId, ModelProvider, TTSResultStatus } from '../../domain/tts.entity';
import { Result } from '../../common/result';

export interface AzureVoice {
  name: string;
  displayName: string;
  localName: string;
  shortName: string;
  gender: 'Male' | 'Female';
  locale: string;
  localeName: string;
  sampleRateHertz: string;
  voiceType: 'Standard' | 'Neural';
  status: string;
  wordCount?: number;
  characterCount?: number;
  styleList?: string[];
  secondaryLocales?: string[];
}

export interface AzureSSMLOptions {
  rate?: string; // x-slow, slow, medium, fast, x-fast, or percentage
  pitch?: string; // x-low, low, medium, high, x-high, or percentage
  volume?: string; // silent, x-soft, soft, medium, loud, x-loud, or percentage
  emphasis?: 'strong' | 'moderate' | 'reduced';
  prosody?: {
    rate?: string;
    pitch?: string;
    volume?: string;
    contour?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AzureTTSService {
  private readonly tokenUrl = 'https://{{region}}.api.cognitive.microsoft.com/sts/v1.0/issueToken';
  private readonly ttsUrl = 'https://{{region}}.tts.speech.microsoft.com/cognitiveservices/v1';
  private readonly voicesUrl = 'https://{{region}}.tts.speech.microsoft.com/cognitiveservices/voices/list';
  
  private cachedVoices: AzureVoice[] | null = null;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(
    private logging: LoggingService,
    private monitoring: MonitoringService
  ) {
    this.logging.info('AzureTTSService initialized', 'Azure');
  }

  // Core TTS functionality
  async synthesizeSpeech(
    text: string,
    settings: TTSSettings,
    queryId: QueryId
  ): Promise<Result<TTSResult, string>> {
    if (!settings.apiKey) {
      return Result.failure('Azure API key is required');
    }    const region = this.extractRegionFromSettings(settings);
    if (!region) {
      return Result.failure('Azure region could not be determined from voice name');
    }

    return this.logging.trackPerformance(
      'azureSynthesize',
      async () => {
        const startTime = Date.now();
        
        this.logging.info('Starting Azure synthesis', 'Azure', {
          textLength: text.length,
          voice: settings.voice,
          region
        });

        try {
          const audioData = await this.makeTextToSpeechRequest(text, settings, region);
          const processingTime = Date.now() - startTime;

          this.monitoring.recordRequest(ModelProvider.AZURE, true, processingTime);          const result: TTSResult = {
            queryId,
            status: TTSResultStatus.COMPLETED,
            createdAt: new Date(),
            updatedAt: new Date(),
            audioData,
            duration: this.estimateAudioDuration(audioData),
            fileSize: audioData.byteLength,
            processingTime
          };

          this.logging.info('Azure synthesis completed successfully', 'Azure', {
            fileSize: audioData.byteLength,
            duration: result.duration,
            processingTime
          });

          return Result.success(result);

        } catch (error) {
          const processingTime = Date.now() - startTime;
          this.monitoring.recordRequest(ModelProvider.AZURE, false, processingTime);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          this.logging.error('Azure synthesis failed', error as Error, 'Azure');          const result: TTSResult = {
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
      'Azure'
    );
  }

  // Voice management
  async getAvailableVoices(apiKey: string, region: string): Promise<Result<AzureVoice[], string>> {
    if (this.cachedVoices) {
      return Result.success(this.cachedVoices);
    }

    return this.logging.trackPerformance(
      'azureGetVoices',
      async () => {
        try {
          const token = await this.getAccessToken(apiKey, region);          if (token.isFailure()) {
            return Result.failure(token.getError());
          }

          const url = this.voicesUrl.replace('{{region}}', region);
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token.getValue()}`,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
          }

          this.cachedVoices = await response.json();

          this.logging.info(`Retrieved ${this.cachedVoices!.length} Azure voices`, 'Azure');
          return Result.success(this.cachedVoices!);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch voices';
          this.logging.error('Failed to fetch Azure voices', error as Error, 'Azure');
          return Result.failure(errorMessage);
        }
      },
      'Azure'
    );
  }

  // Token management
  async getAccessToken(apiKey: string, region: string): Promise<Result<string, string>> {
    // Check if we have a valid cached token
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return Result.success(this.cachedToken.token);
    }

    return this.logging.trackPerformance(
      'azureGetToken',
      async () => {
        try {
          const url = this.tokenUrl.replace('{{region}}', region);
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Ocp-Apim-Subscription-Key': apiKey,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
          }

          const token = await response.text();
          
          // Cache token for 9 minutes (Azure tokens expire in 10 minutes)
          this.cachedToken = {
            token,
            expiresAt: Date.now() + (9 * 60 * 1000)
          };

          this.logging.info('Azure access token obtained successfully', 'Azure');
          return Result.success(token);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to get access token';
          this.logging.error('Failed to get Azure access token', error as Error, 'Azure');
          return Result.failure(errorMessage);
        }
      },
      'Azure'
    );
  }

  // SSML generation
  generateSSML(text: string, voice: string, options?: AzureSSMLOptions): string {
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">`;
    ssml += `<voice name="${voice}">`;

    if (options?.prosody) {
      ssml += '<prosody';
      if (options.prosody.rate) ssml += ` rate="${options.prosody.rate}"`;
      if (options.prosody.pitch) ssml += ` pitch="${options.prosody.pitch}"`;
      if (options.prosody.volume) ssml += ` volume="${options.prosody.volume}"`;
      if (options.prosody.contour) ssml += ` contour="${options.prosody.contour}"`;
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

    ssml += '</voice></speak>';
    return ssml;
  }

  // Validation and capabilities
  async validateConfiguration(settings: TTSSettings): Promise<Result<boolean, string>> {
    if (!settings.apiKey) {
      return Result.failure('API key is required');
    }    const region = this.extractRegionFromSettings(settings);
    if (!region) {
      return Result.failure('Region could not be determined from voice name');
    }// Test API key by getting access token
    const tokenResult = await this.getAccessToken(settings.apiKey.getValue(), region);
    if (tokenResult.isFailure()) {
      return Result.failure(`Invalid API key or region: ${tokenResult.getError()}`);
    }

    this.logging.info('Azure configuration validated successfully', 'Azure');
    return Result.success(true);
  }

  getCapabilities() {
    return {
      maxTextLength: 10000, // Azure limit for SSML
      supportedFormats: ['mp3', 'wav', 'ogg'],
      supportsSSML: true,
      supportsStreaming: false,
      defaultModel: 'Neural', // Azure uses voice types instead of models
      defaultVoice: 'en-US-JennyNeural',
      requiresApiKey: true,
      requiresRegion: true
    };
  }

  // Supported regions
  getSupportedRegions(): string[] {
    return [
      'eastus', 'eastus2', 'westus', 'westus2', 'westus3', 'centralus',
      'northcentralus', 'southcentralus', 'westcentralus', 'canadacentral',
      'canadaeast', 'brazilsouth', 'northeurope', 'westeurope', 'uksouth',
      'ukwest', 'francecentral', 'francesouth', 'switzerlandnorth',
      'switzerlandwest', 'germanywestcentral', 'norwayeast', 'norwaywest',
      'swedencentral', 'eastasia', 'southeastasia', 'australiaeast',
      'australiasoutheast', 'centralindia', 'southindia', 'westindia',
      'japaneast', 'japanwest', 'koreacentral', 'koreasouth', 'southafricanorth',
      'uaenorth'
    ];
  }

  // Clear caches
  clearCache(): void {
    this.cachedVoices = null;
    this.cachedToken = null;
    this.logging.info('Azure cache cleared', 'Azure');
  }
  // Private helper methods
  private async makeTextToSpeechRequest(
    text: string, 
    settings: TTSSettings, 
    region: string
  ): Promise<Uint8Array> {
    const token = await this.getAccessToken(settings.apiKey!.getValue(), region);
    if (token.isFailure()) {
      throw new Error(`Failed to get access token: ${token.getError()}`);
    }

    const voice = settings.voice || 'en-US-JennyNeural';
    const ssml = this.generateSSML(text, voice);

    const url = this.ttsUrl.replace('{{region}}', region);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.getValue()}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'ai-tts-mp3'
      },
      body: ssml
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
  private extractRegionFromSettings(settings: TTSSettings): string | null {
    // Since TTSSettings doesn't have customEndpoint, we'll need to infer the region
    // from the voice name or use a default region
    
    // Try to extract from voice name (many Azure voices include region)
    if (settings.voice) {
      const voiceRegionMatch = settings.voice.match(/^([a-z]{2}-[A-Z]{2})-/);
      if (voiceRegionMatch) {
        // Map locale to common regions (this is a simplified mapping)
        const localeToRegion: Record<string, string> = {
          'en-US': 'eastus',
          'en-GB': 'uksouth',
          'fr-FR': 'francecentral',
          'de-DE': 'germanywestcentral',
          'ja-JP': 'japaneast',
          'ko-KR': 'koreacentral',
          'zh-CN': 'eastasia'
        };
        const locale = voiceRegionMatch[1];
        return localeToRegion[locale] || 'eastus';
      }
    }

    // Default to eastus if no region found
    return 'eastus';
  }

  private estimateAudioDuration(audioData: Uint8Array): number {
    // Rough estimation for MP3: assumes 48kbps bitrate (Azure default)
    const bytesPerSecond = 48 * 1024 / 8; // 48kbps in bytes per second
    return audioData.byteLength / bytesPerSecond;
  }
}
