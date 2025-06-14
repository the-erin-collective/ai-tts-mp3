import { Component, signal, computed, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntegratedHistoryStorageService, HistoryItem, StorageInfo, FileSystemStorageState, FolderReconnectionPrompt } from '../../integration/history-storage.service';
import { PlaybackService } from '../../integration/playback.service'; // Corrected path
import { FormatDatePipe } from '../shared/pipes/format-date.pipe'; // Corrected path
import { FormatFileSizePipe } from '../shared/pipes/format-file-size.pipe'; // Corrected path
import { FormatDurationPipe } from '../shared/pipes/format-duration.pipe'; // Corrected path
import { TruncateTextPipe } from '../shared/pipes/truncate-text.pipe'; // Corrected path

@Component({
  selector: 'app-history-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, FormatDatePipe, FormatFileSizePipe, FormatDurationPipe, TruncateTextPipe],
  templateUrl: './history-panel.component.html',
  styleUrl: './history-panel.component.scss'
})
export class HistoryPanelComponent {
  @Output() historyItemSelected = new EventEmitter<HistoryItem | null>();
  @Output() playItem = new EventEmitter<HistoryItem>();
  // State - removed collapsible functionality
  searchQuery = signal('');
  selectedItemId = signal<string | null>(null);
  showClearModal = signal(false);
  showDeleteModal = signal(false);
  itemToDelete = signal<HistoryItem | null>(null);
  // Data
  history = signal<HistoryItem[]>([]);
  storageInfo = signal<StorageInfo>({ used: 0, available: 0, total: 0, usedPercentage: 0, itemCount: 0 });
  fileSystemState = signal<FileSystemStorageState>({ 
    isSupported: false, 
    isEnabled: false, 
    directoryHandle: null, 
    selectedPath: null 
  });
  folderReconnectionPrompt = signal<FolderReconnectionPrompt | null>(null);

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

  // File system storage computed properties
  showStorageBar = computed(() => {
    return !this.fileSystemState().isEnabled;
  });

  showFolderPath = computed(() => {
    return this.fileSystemState().isEnabled && this.fileSystemState().selectedPath;
  });
  lockIconSrc = computed(() => {
    return this.fileSystemState().isEnabled 
      ? 'assets/icons/outline/archive.svg'  // Unlocked/open storage
      : 'assets/icons/outline/bookmark.svg'; // Locked/limited storage
  });

  lockIconTooltip = computed(() => {
    const state = this.fileSystemState();
    if (!state.isSupported) {
      return 'File System Access API not supported in this browser';
    }
    return state.isEnabled 
      ? 'Disable unlimited file system storage'
      : 'Enable unlimited file system storage';
  });

  canClickLock = computed(() => {
    return this.fileSystemState().isSupported;
  });
  constructor(private historyService: IntegratedHistoryStorageService,
              public playbackService: PlaybackService,
              public cdr: ChangeDetectorRef) {
    // Subscribe to history changes
    this.historyService.history$.subscribe(history => {
      console.log(`[HistoryPanel] Received history update: ${history.length} items`);
      // Sort history by creation date (newest first)
      const sortedHistory = [...history].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      this.history.set(sortedHistory);
      
      // Automatically select the latest item when the history list is updated
      if (sortedHistory.length > 0) {
        const latestItem = sortedHistory[0]; // Latest item is now the first after sorting
        // Only select if no item is currently selected or if the latest item is different
        if (!this.selectedItemId() || this.selectedItemId() !== latestItem.id) {
          this.selectItem(latestItem);
          // Manually trigger change detection to ensure the UI updates after selection
          this.cdr.detectChanges();
        }
      }
    });

    // Subscribe to storage info changes
    this.historyService.storageInfo$.subscribe(storageInfo => {
      this.storageInfo.set(storageInfo);
    });
    // Subscribe to file system state changes
    this.historyService.fileSystemState$.subscribe(state => {
      this.fileSystemState.set(state);
    });

    // Subscribe to folder reconnection prompts
    this.historyService.folderReconnectionPrompt$.subscribe(prompt => {
      this.folderReconnectionPrompt.set(prompt);
    });
  }

  // Actions
  selectItem(item: HistoryItem): void {
    // Use a small timeout to ensure the history list has potentially rendered the new item
    // setTimeout(() => {
      this.selectedItemId.set(item.id);
      this.historyItemSelected.emit(item);
    // }, 0); // Zero delay timeout
  }

  clearSelection(): void {
    this.selectedItemId.set(null);
    this.historyItemSelected.emit(null);
  }

  // Add new method to handle play/pause click on a history item
  onHistoryItemPlayPauseClick(item: HistoryItem, event: Event): void {
    event.stopPropagation(); // Prevent the default item selection behavior

    // Check if the event was triggered by a user interaction
    if (!event.isTrusted) {
      return; // Ignore programmatic clicks
    }

    // Check if the clicked item is currently playing
    if (this.playbackService.playingItemId() === item.id && this.playbackService.isPlaying()) {
      this.playbackService.pause(); // Pause if this item is currently playing
    } else {
      // Select the item before toggling playback
      this.selectItem(item);
      // Then call PlaybackService to toggle playback for this item
      this.playbackService.togglePlayPause(item); 
    }
  }

  async deleteItem(item: HistoryItem, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.playbackService.playingItemId() === item.id) {
        this.playbackService.stop();
    }
    this.itemToDelete.set(item);
    this.showDeleteModal.set(true);
  }

  async confirmDeleteItem(): Promise<void> {
    const item = this.itemToDelete();
    if (item) {
      await this.historyService.removeFromHistory(item.id);
      if (this.selectedItemId() === item.id) {
        this.selectedItemId.set(null);
      }
    }
    this.showDeleteModal.set(false);
    this.itemToDelete.set(null);
  }

  cancelDeleteItem(): void {
    this.showDeleteModal.set(false);
    this.itemToDelete.set(null);
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

  // File system storage methods
  async toggleFileSystemStorage(): Promise<void> {
    const state = this.fileSystemState();
    
    if (!state.isSupported) return;

    try {
      if (state.isEnabled) {
        await this.historyService.disableFileSystemStorage();
      } else {
        await this.historyService.enableFileSystemStorage();
      }
    } catch (error) {
      console.error('Failed to toggle file system storage:', error);
    }
  }

  // Folder reconnection methods
  async reconnectToFolder(): Promise<void> {
    await this.historyService.handleFolderReconnection(true);
  }

  async declineReconnection(): Promise<void> {
    await this.historyService.handleFolderReconnection(false);
  }

  // Change folder method
  async changeFolder(): Promise<void> {
    await this.historyService.enableFileSystemStorage();
  }

  // Panel control methods removed - panel is always open

  // Utility methods
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
    // For OpenAI voices, use actual icon names
    const openAIVoiceIcons: Record<string, string> = {
      'alloy': 'ghost-3',      
      'echo': 'moon',          
      'fable': 'clover',       
      'onyx': 'carambola',     
      'nova': 'flower',        
      'shimmer': 'sunglasses',      
      'coral': 'seedling',     // Use seedling for coral
      'ash': 'ghost-3',        // fallback for new voices
      'sage': 'ghost-3',       // fallback for new voices
      'rachel': 'ghost-3',     
      'drew': 'moon',          
      'clyde': 'clover'        
    };
    return openAIVoiceIcons[voice.toLowerCase()] || 'microphone';
  }

  // Helper method to get voice display text for non-OpenAI providers
  getVoiceDisplayText(voice: string, provider: string): string {
    // For Azure, AWS, and Google voices, extract language code or return voice name
    if (['azure', 'aws', 'google'].includes(provider.toLowerCase())) {
      // Try to extract language code from voice name (e.g., 'en-US-AriaNeural' -> 'en-US')
      const langMatch = voice.match(/^([a-z]{2}-[A-Z]{2})/);
      if (langMatch) {
        return langMatch[1];
      }
      // Fallback to first part of voice name
      const parts = voice.split('-');
      return parts.length > 1 ? parts[0].toUpperCase() : voice.substring(0, 3).toUpperCase();
    }
    return voice;
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
