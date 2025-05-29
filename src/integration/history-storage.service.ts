// Integration layer wrapper for history storage
import { Injectable } from '@angular/core';
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

@Injectable({
  providedIn: 'root'
})
export class IntegratedHistoryStorageService {
  private readonly historyStorage: InfraHistoryStorage;

  constructor() {
    // Infrastructure service requires FileSystemStorageService as dependency
    const fileSystemStorage = new FileSystemStorageService();
    this.historyStorage = new InfraHistoryStorage(fileSystemStorage);
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
    return this.historyStorage.getHistory();
  }

  async deleteHistoryItem(id: string): Promise<void> {
    await this.historyStorage.removeFromHistory(id);
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
}

// Re-export types for convenience
export type { HistoryItem, StorageInfo, FileSystemStorageState, FolderReconnectionPrompt };
