import { Injectable, OnDestroy } from '@angular/core';
import { TTSResult } from '../domain/tts.entity';
import { HistoryItem } from './history-storage.service';
import { PlaybackService as InfraPlaybackService } from '../infrastructure/audio/playback.service';

@Injectable({
  providedIn: 'root'
})
export class PlaybackService implements OnDestroy {  // Expose readonly signals
  readonly playingItemId;
  readonly isPlaying;
  readonly currentTime;
  readonly totalDuration;
  readonly hasEnded;

  constructor(private playbackService: InfraPlaybackService) {
    this.playingItemId = this.playbackService.playingItemId;
    this.isPlaying = this.playbackService.isPlaying;
    this.currentTime = this.playbackService.currentTime;
    this.totalDuration = this.playbackService.totalDuration;
    this.hasEnded = this.playbackService.hasEnded;
  }

  // Proxy all methods
  loadAudio(result: TTSResult, itemId?: string): Promise<void> {
    return this.playbackService.loadAudio(result, itemId);
  }

  playResult(result: TTSResult, itemId?: string): Promise<void> {
    return this.playbackService.playResult(result, itemId);
  }

  pause(): void {
    this.playbackService.pause();
  }

  stop(cleanup = true): void {
    this.playbackService.stop(cleanup);
  }

  togglePlayPause(itemOrResult?: HistoryItem | TTSResult | null, itemId?: string): Promise<void> {
    return this.playbackService.togglePlayPause(itemOrResult, itemId);
  }

  seek(timeInSeconds: number): Promise<void> {
    return this.playbackService.seek(timeInSeconds);
  }

  seekToPercentage(percentage: number, shouldPlay?: boolean): Promise<void> {
    return this.playbackService.seekToPercentage(percentage, shouldPlay);
  }

  ngOnDestroy(): void {
    this.playbackService.stop();
  }
}
