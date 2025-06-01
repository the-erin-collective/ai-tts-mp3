// Integration layer wrapper for history storage
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { 
  HistoryStorageService as InfraHistoryStorage, 
  HistoryItem, 
  StorageInfo 
} from '../infrastructure/history-storage.service';
import { 
  FileSystemStorageService,
  FileSystemStorageState, 
  FolderReconnectionPrompt 
} from '../infrastructure/file-system-storage.service';
import { TTSSettings, TTSResult } from '../domain/tts.entity';
import { LoggingService } from './logging.service';
import { MonitoringService } from './monitoring.service';

@Injectable({
  providedIn: 'root'
})
export class IntegratedHistoryStorageService {
  private readonly historyStorage: InfraHistoryStorage;
  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private logging: LoggingService,
    private monitoring: MonitoringService,
    private fileSystemStorage: FileSystemStorageService
  ) {
    // Infrastructure service requires FileSystemStorageService as dependency
    this.historyStorage = new InfraHistoryStorage(this.fileSystemStorage);
    
    this.logging.info('IntegratedHistoryStorageService initialized', 'History');
  }

  // Observables
  get history$() {
    return this.historyStorage.history$;
  }

  get storageInfo$() {
    return this.historyStorage.storageInfo$;
  }

  get fileSystemState$() {
    return this.historyStorage.fileSystemState$;
  }

  get folderReconnectionPrompt$() {
    return this.historyStorage.folderReconnectionPrompt$;
  }
  // History operations - map to correct infrastructure method names
  async getHistoryItems(): Promise<HistoryItem[]> {
    return this.logging.trackPerformance(
      'getHistoryItems',
      async () => {
        this.logging.debug('Retrieving history items', 'History');
        const items = await this.historyStorage.getHistory();
        this.logging.info(`Retrieved ${items.length} history items`, 'History');

        return items;
      },
      'History'
    );
  }

  async deleteHistoryItem(id: string): Promise<void> {
    return this.logging.trackPerformance(
      'deleteHistoryItem',
      async () => {
        this.logging.info('Deleting history item', 'History', { itemId: id });
        await this.historyStorage.removeFromHistory(id);
        this.logging.info('History item deleted successfully', 'History', { itemId: id });
        this.updateStorageMetrics();
      },
      'History'
    );
  }

  // Method aliases for backward compatibility
  async removeFromHistory(id: string): Promise<void> {
    await this.historyStorage.removeFromHistory(id);
  }

  async clearHistory(): Promise<void> {
    await this.historyStorage.clearHistory();
  }

  async clearAllHistory(): Promise<void> {
    await this.historyStorage.clearHistory();
  }

  getStorageInfo(): StorageInfo {
    return this.historyStorage.getStorageInfo();
  }

  // File system operations
  getFileSystemState(): FileSystemStorageState {
    return this.historyStorage.getFileSystemState();
  }

  async enableFileSystemStorage(): Promise<{ success: boolean; error?: string }> {
    return this.historyStorage.enableFileSystemStorage();
  }

  async disableFileSystemStorage(): Promise<boolean> {
    return this.historyStorage.disableFileSystemStorage();
  }

  async handleFolderReconnection(reconnect: boolean): Promise<void> {
    return this.historyStorage.handleFolderReconnection(reconnect);
  }

  // Additional history management methods
  async addToHistory(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }> {
    return this.historyStorage.addToHistory(text, settings, result, metadata);
  }

  getItemsToBeRemoved(newItemSize: number): HistoryItem[] {
    return this.historyStorage.getItemsToBeRemoved(newItemSize);
  }
  // Private utility methods
  private updateStorageMetrics(): void {
    try {
      const storageInfo = this.getStorageInfo();
      const used = storageInfo.used;
      const available = storageInfo.available;
      const total = storageInfo.total;
      const percentageUsed = storageInfo.usedPercentage;
      
      this.monitoring.updateStorageMetrics(used, available);
      this.logging.debug('Storage metrics updated', 'History', { 
        used, 
        available, 
        total,
        percentageUsed: percentageUsed * 100, // Convert to percentage for display
        itemCount: storageInfo.itemCount
      });
    } catch (error) {
      this.logging.warn('Failed to update storage metrics', 'History', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Enhanced history operations with monitoring
  async addToHistoryWithMonitoring(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }> {
    return this.logging.trackPerformance(
      'addToHistory',
      async () => {
        this.logging.info('Adding item to history', 'History', { 
          textLength: text.length, 
          provider: settings.provider,
          hasMetadata: !!metadata 
        });

        const historyResult = await this.addToHistory(text, settings, result, metadata);
        
        if (historyResult.success) {
          this.logging.info('Item added to history successfully', 'History', {
            warningsCount: historyResult.warnings?.length || 0,
            removedCount: historyResult.removed?.length || 0
          });
          this.updateStorageMetrics();
        } else {
          this.logging.warn('Failed to add item to history', 'History');
        }

        return historyResult;
      },
      'History'
    );
  }
}

// Re-export types for convenience
export type { HistoryItem, StorageInfo, FileSystemStorageState, FolderReconnectionPrompt, TTSResult };
