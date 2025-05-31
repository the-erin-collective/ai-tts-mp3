import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TTSResult } from '../../domain/tts.entity'; // Corrected path to domain layer
import { HistoryItem } from '../history-storage.service'; // Import HistoryItem from infrastructure

@Injectable({
  providedIn: 'root'
})
export class PlaybackService {
  private audio: HTMLAudioElement | undefined;
  private currentAudioUrl: string | null = null;
  private currentAudioData: ArrayBuffer | null = null;

  // State signals
  private _playingItemId = signal<string | null>(null);
  private _isPlaying = signal<boolean>(false);
  private _currentTime = signal<number>(0);
  private _totalDuration = signal<number>(0);
  private _hasEnded = signal<boolean>(false);

  // Public signals (computed for read-only access)
  readonly playingItemId = this._playingItemId.asReadonly();
  readonly isPlaying = this._isPlaying.asReadonly();
  readonly currentTime = this._currentTime.asReadonly();
  readonly totalDuration = this._totalDuration.asReadonly();
  readonly hasEnded = this._hasEnded.asReadonly();

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if (isPlatformBrowser(this.platformId)) {
      this.audio = new Audio();

      // Listen for time updates to update progress
      this.audio.ontimeupdate = () => {
        if (this.audio) {
          this._currentTime.set(this.audio.currentTime);
        }
      };
      
      // Listen for loadedmetadata to get duration
      this.audio.onloadedmetadata = () => {
        if (this.audio) {
          this._totalDuration.set(this.audio.duration);
        }
      };
      
      // Handle audio end
      this.audio.onended = () => {
        if (this.audio) {
          this.audio.pause();
          this._isPlaying.set(false);
          this._hasEnded.set(true);
        }
      };

      // Update playing state
      this.audio.onplay = () => this._isPlaying.set(true);
      this.audio.onpause = () => this._isPlaying.set(false);
    }
  }

  /**
   * Loads audio from a TTS result but does not play it.
   * Returns a promise that resolves when the audio is loaded and ready to play.
   */
  loadAudio(result: TTSResult, itemId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!result.audioData) {
        reject(new Error('No audio data'));
        return;
      }

      if (!isPlatformBrowser(this.platformId) || !this.audio) {
        reject(new Error('Audio not available'));
        return;
      }

      // Check if we're already playing this exact audio data
      if (this.currentAudioData && result.audioData === this.currentAudioData) {
        // Keep current state and resolve
        resolve();
        return;
      }

      // Stop currently playing audio if any
      if (this.currentAudioUrl) {
        this.audio.pause();
        URL.revokeObjectURL(this.currentAudioUrl);
        this.currentAudioUrl = null;
      }

      // Save audio data reference
      this.currentAudioData = result.audioData;

      // Create object URL and set source
      const blob = new Blob([result.audioData], { type: 'audio/mpeg' });
      this.currentAudioUrl = URL.createObjectURL(blob);
      this.audio.src = this.currentAudioUrl;

      // Reset states
      this._hasEnded.set(false);
      this._playingItemId.set(itemId || null);

      // Wait for audio to be loaded
      const onCanPlay = () => {
        this.audio!.removeEventListener('canplay', onCanPlay);
        resolve();
      };
      this.audio.addEventListener('canplay', onCanPlay);

      const onError = (e: Event) => {
        this.audio!.removeEventListener('error', onError);
        if (this.currentAudioUrl) {
          URL.revokeObjectURL(this.currentAudioUrl);
          this.currentAudioUrl = null;
        }
        this.currentAudioData = null;
        this._playingItemId.set(null);
        this._isPlaying.set(false);
        reject(new Error('Failed to load audio'));
      };
      this.audio.addEventListener('error', onError);
    });
  }

  /**
   * Plays the audio for a given TTS result.
   * Stops any currently playing audio first.
   */
  async playResult(result: TTSResult, itemId?: string): Promise<void> {
    try {
      await this.loadAudio(result, itemId);
      if (this.audio) {
        await this.audio.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  /**
   * Pauses the currently playing audio.
   */
  pause(): void {
    if (isPlatformBrowser(this.platformId) && this.audio) {
        this.audio.pause();
    }
  }

  /**
   * Stops the currently playing audio and cleans up.
   * @param cleanup If true, cleans up resources. If false, just stops playback.
   */  
  stop(cleanup: boolean = true): void {
    if (isPlatformBrowser(this.platformId) && this.audio) {
        this.audio.pause();
        this._isPlaying.set(false);

        if (cleanup) {
          // Reset everything and clean up resources
          this.audio.currentTime = 0;
          this._currentTime.set(0);
          this._totalDuration.set(0);
          this._hasEnded.set(false);
          this._playingItemId.set(null);
          
          if (this.currentAudioUrl) {
            URL.revokeObjectURL(this.currentAudioUrl);
            this.currentAudioUrl = null;
          }
          this.currentAudioData = null;
        }
    }
  }

  /**
   * Toggles play/pause for a specific TTS result or HistoryItem.
   */  
  async togglePlayPause(itemOrResult?: HistoryItem | TTSResult | null, itemId?: string): Promise<void> {
    let result: TTSResult | null = null;
    let currentItemId = itemId;

    // Extract the result and ID from the input
    if (itemOrResult && 'result' in itemOrResult) { // Check if it's a HistoryItem
      result = itemOrResult.result;
      currentItemId = itemOrResult.id;
    } else if (itemOrResult && 'queryId' in itemOrResult) { // Check if it's a TTSResult
      result = itemOrResult;
      if (result?.queryId) {
         currentItemId = itemId || result.queryId.getValue();
      }
    }

    // If we're currently playing, always pause first
    if (this._isPlaying()) {
      this.pause();
      return;
    }

    // Early exit if we don't have what we need
    if (!isPlatformBrowser(this.platformId) || !this.audio || !result?.audioData) {
      if (!result?.audioData) {
        console.warn('togglePlayPause called with no audio data available.');
      }
      return;
    }

    // Check if we're dealing with the same audio content by comparing the actual data
    const isSameAudio = this.currentAudioData === result.audioData;

    if (isSameAudio) {
      // This is the same audio content we already have loaded
      if (this._hasEnded()) {
        this.audio.currentTime = 0;
        this._hasEnded.set(false);
      }
      try {
        await this.audio.play();
      } catch (error) {
        console.error('Error resuming audio:', error);
        this._isPlaying.set(false);
      }
    } else {
      // This is different audio content, load and play it
      await this.loadAudio(result, currentItemId);
      try {
        await this.audio.play();
      } catch (error) {
        console.error('Error playing audio:', error);
        this._isPlaying.set(false);
      }
    }
  }

  /**
   * Seeks to a specific time in the currently playing audio.
   */
  seek(timeInSeconds: number): Promise<void> {
    return new Promise((resolve) => {
      if (!isPlatformBrowser(this.platformId) || !this.audio) {
        resolve();
        return;
      }

      const onCanPlay = () => {
        this.audio!.removeEventListener('canplay', onCanPlay);
        this.audio!.currentTime = timeInSeconds;
        resolve();
      };

      if (this.audio.readyState >= 3) { // HAVE_FUTURE_DATA
        this.audio.currentTime = timeInSeconds;
        resolve();
      } else {
        this.audio.addEventListener('canplay', onCanPlay);
      }
    });
  }

  /**
   * Seeks to a specific percentage of the audio duration.
   * @param percentage Number between 0 and 100
   */  async seekToPercentage(percentage: number, shouldPlay?: boolean): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.audio) return;
    
    // Clamp percentage to valid range
    const clampedPercentage = Math.min(Math.max(0, percentage), 100);
    
    // Remember playing state
    const wasPlaying = this._isPlaying();
    
    // Pause while seeking to avoid audio glitches
    if (wasPlaying) {
      this.audio.pause();
    }
    
    // Wait for both metadata and enough data to be loaded
    const waitForLoad = async () => {
      if (this.audio!.readyState < 1 || !this.audio!.duration) {
        await new Promise(resolve => {
          const onLoadedMetadata = () => {
            this.audio!.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve(void 0);
          };
          this.audio!.addEventListener('loadedmetadata', onLoadedMetadata);
        });
      }
      
      if (this.audio!.readyState < 3) { // HAVE_FUTURE_DATA
        await new Promise(resolve => {
          const onCanPlay = () => {
            this.audio!.removeEventListener('canplay', onCanPlay);
            resolve(void 0);
          };
          this.audio!.addEventListener('canplay', onCanPlay);
        });
      }
    };

    await waitForLoad();
    
    // Calculate target time and clamp it to valid range
    const duration = this.audio.duration || 0;
    const targetTime = Math.min(Math.max(0, (clampedPercentage / 100) * duration), duration);
    
    // Apply the seek
    this.audio.currentTime = targetTime;
    this._currentTime.set(targetTime);
    
    // Update state and handle playback
    this._hasEnded.set(false);
    
    // Resume or start playback if requested or if it was already playing
    if (shouldPlay || wasPlaying) {
      try {
        await this.audio.play();
      } catch (error) {
        console.error('Error resuming after seek:', error);
      }
    }
  }

  // Clean up object URL when the service is destroyed
  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
        this.stop();
    }
  }
}