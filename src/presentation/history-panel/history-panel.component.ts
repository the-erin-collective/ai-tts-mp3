import { Component, signal, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryStorageService, HistoryItem, StorageInfo } from '../../infrastructure/history-storage.service';
import { TTSResult } from '../../domain/tts.entity';
import { TablerIconComponent } from '../shared/tabler-icon.component';

@Component({
  selector: 'app-history-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconComponent],
  templateUrl: './history-panel.component.html',
  styleUrl: './history-panel.component.scss'
})
export class HistoryPanelComponent {  @Output() historyItemSelected = new EventEmitter<HistoryItem>();
  
  // State - removed collapsible functionality
  searchQuery = signal('');
  selectedItemId = signal<string | null>(null);
  showClearModal = signal(false);
  
  // Data
  history = signal<HistoryItem[]>([]);
  storageInfo = signal<StorageInfo>({ used: 0, available: 0, total: 0, usedPercentage: 0, itemCount: 0 });

  // Computed properties
  filteredHistory = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.history();
    
    return this.history().filter(item => 
      item.text.toLowerCase().includes(query) ||
      item.metadata?.title?.toLowerCase().includes(query) ||
      item.metadata?.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  storageWarningLevel = computed(() => {
    const percentage = this.storageInfo().usedPercentage;
    if (percentage > 0.9) return 'critical';
    if (percentage > 0.8) return 'warning';
    return 'normal';
  });

  storageDisplayPercentage = computed(() => {
    return Math.round(this.storageInfo().usedPercentage * 100);
  });

  constructor(private historyService: HistoryStorageService) {
    // Subscribe to history changes
    this.historyService.history$.subscribe(history => {
      this.history.set(history);
    });

    // Subscribe to storage info changes
    this.historyService.storageInfo$.subscribe(storageInfo => {
      this.storageInfo.set(storageInfo);
    });
  }

  // Actions
  selectItem(item: HistoryItem): void {
    this.selectedItemId.set(item.id);
    this.historyItemSelected.emit(item);
  }

  async deleteItem(item: HistoryItem, event: Event): Promise<void> {
    event.stopPropagation();
    const confirmed = confirm(`Delete this TTS item?\n\n"${this.truncateText(item.text, 60)}"`);
    if (confirmed) {
      await this.historyService.removeFromHistory(item.id);
      if (this.selectedItemId() === item.id) {
        this.selectedItemId.set(null);
      }
    }
  }
  async clearAllHistory(): Promise<void> {
    this.showClearModal.set(true);
  }

  async confirmClearAll(): Promise<void> {
    await this.historyService.clearHistory();
    this.selectedItemId.set(null);
    this.showClearModal.set(false);
  }

  cancelClearAll(): void {
    this.showClearModal.set(false);
  }

  // Panel control methods removed - panel is always open

  // Utility methods
  formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  getProviderIcon(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'openai': return 'robot';
      case 'elevenlabs': return 'music';
      case 'azure': return 'cloud';
      case 'google': return 'search';
      case 'aws': return 'package';
      default: return 'microphone';
    }
  }
  getVoiceIcon(voice: string): string {
    // Map each voice to unique mood icons that aren't used elsewhere in the app
    const voiceIcons: { [key: string]: string } = {
      'alloy': 'mood-happy',
      'echo': 'mood-smile', 
      'fable': 'mood-neutral',
      'onyx': 'mood-crazy-happy',
      'nova': 'mood-sing',
      'shimmer': 'mood-nerd',
      'rachel': 'mood-wink',
      'drew': 'mood-tongue',
      'clyde': 'mood-kid'
    };
    return voiceIcons[voice.toLowerCase()] || 'masks-theater';
  }

  async playHistoryItem(item: HistoryItem, event: Event): Promise<void> {
    event.stopPropagation();
    
    if (!item.result.audioData) return;

    try {
      const blob = new Blob([item.result.audioData], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }

  async downloadHistoryItem(item: HistoryItem, event: Event): Promise<void> {
    event.stopPropagation();
    
    if (!item.result.audioData) return;

    try {
      const blob = new Blob([item.result.audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `tts-${item.metadata?.title || 'audio'}-${item.createdAt.getTime()}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download audio:', error);
    }
  }
}
