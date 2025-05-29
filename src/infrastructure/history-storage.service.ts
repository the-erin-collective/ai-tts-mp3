// History Storage Service - Manages TTS history with localStorage and File System Access API
import { Injectable, PLATFORM_ID } from '@angular/core';
import { Observable } from 'rxjs';
import { TTSResult, TTSSettings } from '../domain/tts.entity';
import { FileSystemStorageService, FileSystemStorageState, FolderReconnectionPrompt } from './file-system-storage.service';

export interface HistoryItem {
  id: string;
  text: string;
  settings: TTSSettings;
  result: TTSResult;
  createdAt: Date;
  audioSize: number; // Size in bytes
  metadata?: {
    title?: string;
    tags?: string[];
    duration?: number;
  };
}

export interface StorageInfo {
  used: number; // bytes
  available: number; // bytes (estimated)
  total: number; // bytes (estimated)
  usedPercentage: number;
  itemCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class HistoryStorageService {
  // Delegate to the enhanced file system storage service
  constructor(private fileSystemStorage: FileSystemStorageService) {}

  // Observables
  get history$(): Observable<HistoryItem[]> {
    return this.fileSystemStorage.history$;
  }

  get storageInfo$(): Observable<StorageInfo> {
    return this.fileSystemStorage.storageInfo$;
  }
  get fileSystemState$(): Observable<FileSystemStorageState> {
    return this.fileSystemStorage.fileSystemState$;
  }

  get folderReconnectionPrompt$(): Observable<FolderReconnectionPrompt | null> {
    return this.fileSystemStorage.folderReconnectionPrompt$;
  }

  // Current state getters
  getHistory(): HistoryItem[] {
    return this.fileSystemStorage.getHistory();
  }

  getStorageInfo(): StorageInfo {
    return this.fileSystemStorage.getStorageInfo();
  }

  getFileSystemState(): FileSystemStorageState {
    return this.fileSystemStorage.getFileSystemState();
  }
  // File system storage methods
  async enableFileSystemStorage(isReconnection = false): Promise<{ success: boolean; error?: string }> {
    return this.fileSystemStorage.enableFileSystemStorage(isReconnection);
  }

  async disableFileSystemStorage(): Promise<boolean> {
    return this.fileSystemStorage.disableFileSystemStorage();
  }

  // Handle folder reconnection prompt
  async handleFolderReconnection(reconnect: boolean): Promise<void> {
    return this.fileSystemStorage.handleFolderReconnection(reconnect);
  }

  // History management methods
  async addToHistory(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }> {
    return this.fileSystemStorage.addToHistory(text, settings, result, metadata);
  }

  async removeFromHistory(itemId: string): Promise<boolean> {
    return this.fileSystemStorage.removeFromHistory(itemId);
  }

  async clearHistory(): Promise<boolean> {
    return this.fileSystemStorage.clearHistory();
  }

  // Storage warning methods (localStorage mode only)
  getItemsToBeRemoved(newItemSize: number): HistoryItem[] {
    return this.fileSystemStorage.getItemsToBeRemoved(newItemSize);
  }

  isStorageNearFull(): boolean {
    return this.fileSystemStorage.isStorageNearFull();
  }

  isStorageCritical(): boolean {
    return this.fileSystemStorage.isStorageCritical();
  }
}
