import { Component, Input, computed, signal, effect, OnDestroy, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TTSResult } from '../../domain/tts.entity';
import { FormatDatePipe } from '../shared/pipes/format-date.pipe';
import { FormatDurationPipe } from '../shared/pipes/format-duration.pipe';
import { FormatFileSizePipe } from '../shared/pipes/format-file-size.pipe';
import { TruncateTextPipe } from '../shared/pipes/truncate-text.pipe';
import { PlaybackService } from '../../infrastructure/audio/playback.service';
import { AngularTTSService } from '../../integration/angular-tts.service';
import { SettingsService } from '../shared/settings.service';
import { HistoryItem } from '../../integration/history-storage.service';
import { ModelProvider, Voice } from '../../integration/domain-types';

// Define a type for currentQueryInfo
interface CurrentQueryInfo {
  text: string;
  title?: string;
  settings?: { provider: string; model: string; voice: string; };
  estimatedDuration?: number;
  createdAt?: Date;
  id?: string;
}

@Component({
  selector: 'app-audio-player',
  standalone: true,
  imports: [CommonModule, FormatDatePipe, FormatDurationPipe, TruncateTextPipe],
  templateUrl: './audio-player.component.html',
  styleUrl: './audio-player.component.scss'
})
export class AudioPlayerComponent implements OnDestroy {
  // Inject services
  private ttsService = inject(AngularTTSService);
  protected settingsService = inject(SettingsService);
  public playbackService = inject(PlaybackService);

  // Input signal for the current query information
  @Input() currentQueryInfo = signal<CurrentQueryInfo | null>(null);
  @Input() currentResult = signal<TTSResult | null>(null);

  // Output events
  clearResult = output<void>();

  // Computed property for display text - Using pipe
  displayText = computed(() => {
    const info = this.currentQueryInfo();
    if (!info) return '...'; // Or an appropriate placeholder
    // Prioritize title if available, otherwise use truncated text
    const textToDisplay = info.title || info.text;
    // The truncation pipe is applied in the template
    return textToDisplay;
  });

  // Computed property for display creation date - Using pipe
  displayCreatedAt = computed(() => {
    const info = this.currentQueryInfo();
    if (!info?.createdAt) return '-';
    // Rely on template usage of FormatDatePipe
    return info.createdAt.toISOString();
  });

  // Computed properties
  hasAudio = computed(() => {
    const result = this.currentResult();
    return result && result.status === 'completed';
  });
  // Computed property for progress percentage (using PlaybackService state)
  progressPercentage = computed(() => {
    const dur = this.currentResult()?.duration || 0; // Use duration from result or 0
    const curr = this.playbackService.currentTime();
    const isAtEnd = !this.playbackService.isPlaying() && this.playbackService.hasEnded();
    return dur > 0 ? (isAtEnd ? 100 : (curr / dur) * 100) : 0;
  });

  // Computed properties for metadata display
  displayProvider = computed(() => {
    return this.currentQueryInfo()?.settings?.provider || this.settingsService.selectedProvider();
  });

  displayModel = computed(() => {
    return this.currentQueryInfo()?.settings?.model || this.settingsService.selectedModel();
  });
  displayVoice = computed(() => {
    return this.currentQueryInfo()?.settings?.voice || this.settingsService.selectedVoice();
  });

  displayTitle = computed(() => {
    return this.currentQueryInfo()?.title || '';
  });

  displaySize = computed(() => {
    const result = this.currentResult();
    let bytes = 0;
    
    // Try to get file size from the TTSResult
    if (result?.fileSize) {
      bytes = result.fileSize;
    } 
    
    // If we still don't have file size, check the status
    if (bytes === 0) {
      // Show appropriate message based on status
      if (!result || result.status === 'pending' || result.status === 'processing') {
        return 'Processing...';
      } else if (result.status === 'failed') {
        return 'Failed';
      } else {
        return 'Calculating...';
      }
    }
    
    // Format the byte size
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  });

  // Effect to react to changes in currentQueryInfo and potentially trigger playback
  // Note: Actual playback initiation is now handled by PlaybackService, often triggered by user action (clicking play)
  // This effect might be used for other state updates in the AudioPlayerComponent based on the selected item.
  private queryInfoEffect = effect(() => {
    const info = this.currentQueryInfo();
    // Add any logic needed when the selected history item changes
    // Example: if you wanted to auto-play when selecting a new item:
    // if (info?.id) { this.playbackService.playItemById(info.id); }
    // However, based on user feedback, playback is triggered by clicking the play button in the history item list.
  });

  constructor() { }

  ngOnDestroy(): void {
    // Clean up any resources if needed (e.g., subscriptions)
    // PlaybackService should handle audio cleanup
  }

  async downloadAudio() {
    const result = this.currentResult();
    if (!result) return;

    try {
      const audioUrl = await this.ttsService.downloadAudio(result);
      if (audioUrl) {
        const queryInfo = this.currentQueryInfo();
        const title = queryInfo?.title || 'audio';
        const timestamp = Date.now();
        
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = `tts-${title}-${timestamp}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      console.error('Failed to download audio:', error);
    }
  }
  onClearResult() {
    this.clearResult.emit();
  }

  async onProgressBarClick(event: MouseEvent) {
    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const offsetX = Math.min(Math.max(0, event.clientX - rect.left), rect.width); // Clamp value
    const percentage = offsetX / rect.width;
    
    // Always load the audio first if not loaded
    if (!this.playbackService.totalDuration()) {
      await this.playbackService.loadAudio(this.currentResult()!, this.currentQueryInfo()?.id);
    }

    // Always play when seeking to a new position, unless the seek is to 100%
    const isSeekingToEnd = Math.abs(percentage * 100 - 100) < 0.1;
    const shouldPlay = !isSeekingToEnd;
    await this.playbackService.seekToPercentage(percentage * 100, shouldPlay);
  }

  onProgressBarKeydown(event: KeyboardEvent) {
      const seekPercentage = 5; // Seek by 5% of total duration
      const currentPercentage = (this.playbackService.currentTime() / this.playbackService.totalDuration()) * 100;      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          const prevPercentage = Math.max(0, currentPercentage - seekPercentage);
          // Always play when seeking to a new position, unless seeking to 100%
          const isSeekingToEnd = Math.abs(prevPercentage - 100) < 0.1;
          const shouldPlay = !isSeekingToEnd;
          this.playbackService.seekToPercentage(prevPercentage, shouldPlay);
          break;
        case 'ArrowRight':
          event.preventDefault();
          const nextPercentage = Math.min(100, currentPercentage + seekPercentage);
          // Always play when seeking to a new position, unless seeking to 100%
          const isSeekingToEndNext = Math.abs(nextPercentage - 100) < 0.1;
          const shouldPlayNext = !isSeekingToEndNext;
          this.playbackService.seekToPercentage(nextPercentage, shouldPlayNext);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          this.playbackService.togglePlayPause(this.currentResult(), this.currentQueryInfo()?.id); // Toggle play/pause
          break;
      }
    }

    // Helper method to construct HistoryItem for playback
    private constructHistoryItem(): HistoryItem | null {
      const info = this.currentQueryInfo();
      const result = this.currentResult();
      
      if (!info || !result) return null;

      return {
        id: info.id || result.queryId?.getValue() || 'current',
        text: info.text,
        settings: {
          provider: (info.settings?.provider || this.settingsService.selectedProvider()) as ModelProvider,
          model: info.settings?.model || this.settingsService.selectedModel(),
          voice: (info.settings?.voice || this.settingsService.selectedVoice()) as Voice,
          apiKey: undefined // Not needed for playback
        },
        result: result,
        createdAt: info.createdAt || result.createdAt || new Date(),
        audioSize: result.fileSize || 0,
        metadata: info.title ? { title: info.title } : undefined
      };
    }

    // Handle play/pause click
    onPlayPauseClick(): void {
      const historyItem = this.constructHistoryItem();
      if (historyItem) {
        this.playbackService.togglePlayPause(historyItem);
      }
    }
  }