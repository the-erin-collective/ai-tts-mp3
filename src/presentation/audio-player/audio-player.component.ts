import { Component, signal, computed, inject, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularTTSService } from '../../integration/angular-tts.service';
import { TTSResult } from '../../integration/domain-types';
import { SettingsService } from '../shared/settings.service';
import { TruncateTextPipe } from '../../app/pipes/truncate-text.pipe';
import { FormatDatePipe } from '../../app/pipes/format-date.pipe';

@Component({
  selector: 'app-audio-player',
  standalone: true,
  imports: [CommonModule, TruncateTextPipe, FormatDatePipe],
  templateUrl: './audio-player.component.html',
  styleUrl: './audio-player.component.scss'
})
export class AudioPlayerComponent {
  // Inject services
  private ttsService = inject(AngularTTSService);
  protected settingsService = inject(SettingsService);  // Input properties
  currentResult = input<TTSResult | null>(null);
  currentQueryInfo = input<{
    text: string;
    title?: string;
    settings?: {
      provider: string;
      model: string;
      voice: string;
    };
    estimatedDuration?: number; // in seconds
    createdAt?: Date;
  } | null>(null);

  // Output events
  clearResult = output<void>();

  // Local state
  isPlaying = signal(false);
  currentAudio = signal<HTMLAudioElement | null>(null);
  currentTime = signal(0);
  duration = signal(0);

  // Computed properties
  hasAudio = computed(() => {
    const result = this.currentResult();
    return result && result.status === 'completed';
  });

  progressPercentage = computed(() => {
    const dur = this.duration();
    const curr = this.currentTime();
    return dur > 0 ? (curr / dur) * 100 : 0;
  });

  formattedCurrentTime = computed(() => {
    return this.formatTime(this.currentTime());
  });
  formattedDuration = computed(() => {
    return this.formatTime(this.duration());
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
  displayEstimatedDuration = computed(() => {
    const duration = this.currentQueryInfo()?.estimatedDuration;
    return duration ? this.formatTime(duration) : '';
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

  // New computed property for display text (title or truncated text)
  displayText = computed(() => {
    const info = this.currentQueryInfo();
    if (!info) return '';
    const title = info.title;
    const text = info.text;
    
    // Use title if available, otherwise truncate text using the pipe directly in template
    return title || (text ? text : '');
  });

  // New computed property for display creation date
  displayCreatedAt = computed(() => {
    const info = this.currentQueryInfo();
    if (!info?.createdAt) return '';
    // Will apply pipe in template
    return info.createdAt;
  });

  // Effect to update duration signal
  private updateDurationEffect = effect(() => {
    const result = this.currentResult();
    const info = this.currentQueryInfo();

    // Prioritize actual duration from result if available (from generation or history)
    if (result?.duration !== undefined) {
      this.duration.set(result.duration);
    } else if (info?.estimatedDuration !== undefined) {
      // Fallback to estimated duration from query info if actual duration is not available
      this.duration.set(info.estimatedDuration);
    } else {
      // Default to 0 if no duration is available
      this.duration.set(0);
    }
  });

  async playAudio() {
    const result = this.currentResult();
    if (!result) return;

    try {
      // Stop current audio if playing
      const currentAudio = this.currentAudio();
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const audio = await this.ttsService.playAudio(result);
      if (audio) {
        this.currentAudio.set(audio);
        this.setupAudioListeners(audio);
        await audio.play();
        this.isPlaying.set(true);
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }

  pauseAudio() {
    const audio = this.currentAudio();
    if (audio) {
      audio.pause();
      this.isPlaying.set(false);
    }
  }

  stopAudio() {
    const audio = this.currentAudio();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      this.isPlaying.set(false);
      this.currentTime.set(0);
    }
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
    this.stopAudio();
    this.currentAudio.set(null);
    this.duration.set(0);
    this.currentTime.set(0);
    this.clearResult.emit();
  }

  seekTo(event: Event) {
    const audio = this.currentAudio();
    const target = event.target as HTMLInputElement;
    if (audio && this.duration() > 0) {
      const seekTime = (parseFloat(target.value) / 100) * this.duration();
      audio.currentTime = seekTime;
      this.currentTime.set(seekTime);
    }
  }
  onProgressKeydown(event: KeyboardEvent) {
    const audio = this.currentAudio();
    if (!audio) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 5);
        break;
      case 'ArrowRight':
        event.preventDefault();
        audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.isPlaying()) {
          this.pauseAudio();
        } else {
          this.playAudio();
        }
        break;
    }
  }

  private setupAudioListeners(audio: HTMLAudioElement) {
    audio.addEventListener('loadedmetadata', () => {
      this.duration.set(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      this.currentTime.set(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      this.isPlaying.set(false);
      this.currentTime.set(0);
    });

    audio.addEventListener('pause', () => {
      this.isPlaying.set(false);
    });

    audio.addEventListener('play', () => {
      this.isPlaying.set(true);
    });
  }

  private formatTime(seconds: number): string {
    // Ensure we have at least 1 second for display
    const totalSeconds = Math.max(1, Math.round(seconds));
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
