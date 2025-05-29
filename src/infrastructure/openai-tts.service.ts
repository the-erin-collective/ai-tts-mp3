import { Injectable } from '@angular/core';
import { TTSSettings, QueryText, ModelProvider } from '../domain/tts.entity';
import { ProviderError, ProviderErrorType } from '../domain/provider.entity';
import { Logger } from '../common/utils';

export interface OpenAITTSRequest {
  model: string;
  input: string;
  voice: string;
  response_format?: string;
  speed?: number;
}

export interface OpenAITTSResponse {
  audio: ArrayBuffer;
}

@Injectable({
  providedIn: 'root'
})
export class OpenAITTSService {
  private readonly baseUrl = 'https://api.openai.com/v1/audio/speech';

  async generateSpeech(
    text: QueryText, 
    settings: TTSSettings
  ): Promise<Uint8Array> {
    try {
      Logger.info('Calling OpenAI TTS API', { 
        textLength: text.getValue().length,
        model: settings.model,
        voice: settings.voice 
      });      if (!settings.apiKey?.getValue()) {
        throw new ProviderError(
          ProviderErrorType.AUTHENTICATION_FAILED,
          ModelProvider.OPENAI,
          'OpenAI API key is required'
        );
      }

      const request: OpenAITTSRequest = {
        model: settings.model || 'tts-1',
        input: text.getValue(),
        voice: settings.voice || 'alloy',
        response_format: 'mp3',
        speed: settings.speed || 1.0
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.apiKey.getValue()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error('OpenAI API request failed', new Error(errorText), {
          status: response.status,
          statusText: response.statusText
        });
          if (response.status === 401) {
          throw new ProviderError(
            ProviderErrorType.AUTHENTICATION_FAILED,
            ModelProvider.OPENAI,
            'Invalid API key'
          );
        } else if (response.status === 429) {
          throw new ProviderError(
            ProviderErrorType.RATE_LIMIT_EXCEEDED,
            ModelProvider.OPENAI,
            'Rate limit exceeded'
          );
        } else if (response.status >= 500) {
          throw new ProviderError(
            ProviderErrorType.SERVICE_UNAVAILABLE,
            ModelProvider.OPENAI,
            'OpenAI server error'
          );
        } else {
          throw new ProviderError(
            ProviderErrorType.UNKNOWN_ERROR,
            ModelProvider.OPENAI,
            `API request failed: ${errorText}`
          );
        }
      }

      const audioBuffer = await response.arrayBuffer();
      const audioData = new Uint8Array(audioBuffer);

      Logger.info('OpenAI TTS API call successful', { 
        audioSize: audioData.length,
        textLength: text.getValue().length 
      });

      return audioData;

    } catch (error) {
      Logger.error('OpenAI TTS service error', error as Error);
      
      if (error instanceof ProviderError) {
        throw error;
      }
        throw new ProviderError(
        ProviderErrorType.UNKNOWN_ERROR,
        ModelProvider.OPENAI,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      // Test with a minimal request
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: 'test',
          voice: 'alloy'
        })
      });

      return response.status !== 401;
    } catch {
      return false;
    }
  }

  estimateCost(textLength: number, model = 'tts-1'): number {
    // OpenAI TTS pricing (as of 2024):
    // tts-1: $0.015 per 1K characters
    // tts-1-hd: $0.030 per 1K characters
    const pricePerThousandChars = model === 'tts-1-hd' ? 0.030 : 0.015;
    return (textLength / 1000) * pricePerThousandChars;
  }
}
