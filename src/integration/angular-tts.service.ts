import { Injectable, inject } from '@angular/core';
import { TTSResult, TTSSettings } from './domain-types';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { QueryId, TTSResultStatus } from '../domain/tts.entity'; // Assuming QueryId and TTSResultStatus are in domain/tts.entity

@Injectable({
  providedIn: 'root'
})
export class AngularTTSService {

  private http = inject(HttpClient);

  async downloadAudio(result: TTSResult): Promise<string | undefined> {
    // Placeholder implementation - Audio playback is handled by AudioPlayerComponent
    // This method might not be strictly necessary if audio is played directly from TTSResult
    // If needed, implement logic to create a Blob URL or similar
    return undefined;
  }

  async saveSettings(settings: TTSSettings): Promise<void> {
    // Placeholder implementation - Settings are currently managed by SettingsService
    // This could be extended to save settings to localStorage or an API later.
  }

  async generateSpeech(text: string, settings: TTSSettings): Promise<TTSResult | undefined> {
    // Ensure API key is available
    const apiKey = settings.apiKey?.getValue();
    if (!apiKey) {
      console.error('[TTS] API key is missing for speech generation.');
      return undefined; // Or throw an error, depending on desired error handling flow
    }

    const url = 'https://api.openai.com/v1/audio/speech';
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    });

    const body = {
      model: settings.model || 'tts-1-hd', // Use settings model, fallback to default
      voice: settings.voice || 'shimmer', // Use settings voice, fallback to default
      input: text,
      response_format: 'mp3', // Request MP3 format
    };

    try {
      // Use 'arraybuffer' to get the raw audio data
      const audioBlob = await this.http.post(url, body, { headers, responseType: 'arraybuffer' }).toPromise();

      if (audioBlob) {
        // Convert ArrayBuffer to Uint8Array
        const audioData = new Uint8Array(audioBlob);

        const result: TTSResult = {
          queryId: QueryId.generate(), // Generate a new QueryId for the result
          status: 'completed' as TTSResultStatus,
          audioData: audioData,
          createdAt: new Date(),
          updatedAt: new Date(),
          duration: undefined, // Duration might need to be calculated or obtained from API if available
          fileSize: audioData.length,
          error: undefined,
          processingTime: undefined, // Can calculate if needed
        };
        return result;
      } else {
        console.warn('[TTS] OpenAI API request returned no audio blob');
        return undefined;
      }
    } catch (error: any) {
      console.error('[TTS] Error calling OpenAI API:', error);
      // Return undefined or a result with error status
       return undefined;
    }
  }

  async loadSettings(): Promise<{ settings: TTSSettings } | undefined> {
    // Placeholder implementation - Settings are currently managed by SettingsService
    // Could be extended to load settings from localStorage or an API later.
    // For now, return undefined to signify no saved settings are loaded by this service.
    return undefined;
  }

  estimateCost(characterCount: number, settings: TTSSettings): number {
    // Basic placeholder estimation for OpenAI. Prices can vary.
    // As of late 2023, tts-1 is $0.015 / 1K chars, tts-1-hd is $0.03 / 1K chars.
    // This is a very rough estimate.
    const costPer1kChars = settings.model === 'tts-1-hd' ? 0.03 : 0.015;
    const estimatedCost = (characterCount / 1000) * costPer1kChars;
    return estimatedCost;
  }
}
