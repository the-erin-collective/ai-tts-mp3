// No-op implementation of FileSystemStorageService for Server-Side Rendering
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { HistoryItem, StorageInfo } from './history-storage.service';
import { FileSystemStorageState, FolderReconnectionPrompt } from './file-system-storage.service';
import { QueryId } from '../domain/value-objects/query-id';

@Injectable()
export class NoOpFileSystemStorageService {
  private readonly defaultStorageInfo: StorageInfo = {
    used: 0,
    available: Infinity,
    total: Infinity,
    usedPercentage: 0,
    itemCount: 0,
  };

  private readonly defaultFileSystemState: FileSystemStorageState = {
    isSupported: false,
    isEnabled: false,
    directoryHandle: null,
    selectedPath: null
  };

  private fileSystemStateSubject = new BehaviorSubject<FileSystemStorageState>(this.defaultFileSystemState);
  private historySubject = new BehaviorSubject<HistoryItem[]>([]);
  private storageInfoSubject = new BehaviorSubject<StorageInfo>(this.defaultStorageInfo);
  private folderReconnectionSubject = new BehaviorSubject<FolderReconnectionPrompt | null>(null);

  // Observables (return subjects as observables)
  get fileSystemState$(): Observable<FileSystemStorageState> {
    return this.fileSystemStateSubject.asObservable();
  }

  get history$(): Observable<HistoryItem[]> {
    return this.historySubject.asObservable();
  }

  get storageInfo$(): Observable<StorageInfo> {
    return this.storageInfoSubject.asObservable();
  }

  get folderReconnectionPrompt$(): Observable<FolderReconnectionPrompt | null> {
    return this.folderReconnectionSubject.asObservable();
  }

  // Current state getters (return default values)
  getFileSystemState(): FileSystemStorageState {
    return this.defaultFileSystemState;
  }

  getHistory(): HistoryItem[] {
    return [];
  }

  getStorageInfo(): StorageInfo {
    return this.defaultStorageInfo;
  }

  // No-op implementations for methods that interact with browser APIs
  // These methods should not be called during SSR, but are provided for interface compatibility.
  async handleFolderReconnection(reconnect: boolean): Promise<void> {
    console.warn('NoOpFileSystemStorageService: handleFolderReconnection called during SSR');
    return Promise.resolve();
  }

  async enableFileSystemStorage(isReconnection = false): Promise<{ success: boolean; error?: string }> {
    console.warn('NoOpFileSystemStorageService: enableFileSystemStorage called during SSR');
    return Promise.resolve({ success: false, error: 'Not supported on server' });
  }

  async disableFileSystemStorage(): Promise<boolean> {
    console.warn('NoOpFileSystemStorageService: disableFileSystemStorage called during SSR');
    return Promise.resolve(false);
  }

  async addToHistory(
    text: string,
    settings: any, // Use any for simplified no-op
    result: any,
    metadata?: any
  ): Promise<{ success: boolean; warnings?: string[]; removed?: any[] }> {
    console.warn('NoOpFileSystemStorageService: addToHistory called during SSR');
    return Promise.resolve({ success: false, warnings: ['Not supported on server'] });
  }

  async removeFromHistory(itemId: string): Promise<boolean> {
    console.warn('NoOpFileSystemStorageService: removeFromHistory called during SSR');
    return Promise.resolve(false);
  }

  async clearHistory(): Promise<boolean> {
    console.warn('NoOpFileSystemStorageService: clearHistory called during SSR');
    return Promise.resolve(false);
  }

  // No-op for private methods that might be called internally (though they shouldn't be during SSR with proper guards)
  private async saveHistory(history: HistoryItem[]): Promise<void> {
     console.warn('NoOpFileSystemStorageService: saveHistory called during SSR');
     return Promise.resolve();
  }

  private async saveToFileSystem(history: HistoryItem[]): Promise<void> {
    console.warn('NoOpFileSystemStorageService: saveToFileSystem called during SSR');
    return Promise.resolve();
  }

  private saveToLocalStorage(history: HistoryItem[]): void {
     console.warn('NoOpFileSystemStorageService: saveToLocalStorage called during SSR');
  }

  private async loadHistory(): Promise<void> {
    console.warn('NoOpFileSystemStorageService: loadHistory called during SSR');
    this.historySubject.next([]);
    this.storageInfoSubject.next(this.defaultStorageInfo);
    return Promise.resolve();
  }

  private async loadFromFileSystem(): Promise<HistoryItem[]> {
     console.warn('NoOpFileSystemStorageService: loadFromFileSystem called during SSR');
     return Promise.resolve([]);
  }

  private loadFromLocalStorage(): void {
     console.warn('NoOpFileSystemStorageService: loadFromLocalStorage called during SSR');
     this.historySubject.next([]);
     this.storageInfoSubject.next(this.defaultStorageInfo);
  }

  private async deleteAudioFile(itemId: string): Promise<void> {
     console.warn('NoOpFileSystemStorageService: deleteAudioFile called during SSR');
     return Promise.resolve();
  }

  private async migrateFromLocalStorage(): Promise<void> {
     console.warn('NoOpFileSystemStorageService: migrateFromLocalStorage called during SSR');
     return Promise.resolve();
  }

  private async migrateToLocalStorage(): Promise<void> {
     console.warn('NoOpFileSystemStorageService: migrateToLocalStorage called during SSR');
     return Promise.resolve();
  }

  private async saveStorageState(): Promise<void> {
     console.warn('NoOpFileSystemStorageService: saveStorageState called during SSR');
     return Promise.resolve();
  }

  private async loadStorageState(): Promise<void> {
     console.warn('NoOpFileSystemStorageService: loadStorageState called during SSR');
     return Promise.resolve();
  }

  private async clearStorageState(): Promise<void> {
     console.warn('NoOpFileSystemStorageService: clearStorageState called during SSR');
     return Promise.resolve();
  }

  private calculateStorageInfo(): StorageInfo {
     console.warn('NoOpFileSystemStorageService: calculateStorageInfo called during SSR');
     return this.defaultStorageInfo;
  }

  private updateStorageInfo(): void {
     console.warn('NoOpFileSystemStorageService: updateStorageInfo called during SSR');
     this.storageInfoSubject.next(this.defaultStorageInfo);
  }

  isStorageNearFull(): boolean {
     console.warn('NoOpFileSystemStorageService: isStorageNearFull called during SSR');
     return false;
  }

  isStorageCritical(): boolean {
     console.warn('NoOpFileSystemStorageService: isStorageCritical called during SSR');
     return false;
  }

  getItemsToBeRemoved(newItemSize: number): HistoryItem[] {
     console.warn('NoOpFileSystemStorageService: getItemsToBeRemoved called during SSR');
     return [];
  }

  private getPreviousFolderState(): { selectedPath: string } | null {
     console.warn('NoOpFileSystemStorageService: getPreviousFolderState called during SSR');
     return null;
  }

  private clearPreviousFolderState(): void {
     console.warn('NoOpFileSystemStorageService: clearPreviousFolderState called during SSR');
  }

  private saveFolderState(): void {
     console.warn('NoOpFileSystemStorageService: saveFolderState called during SSR');
  }

  private sanitizeSettings(settings: any): any {
     console.warn('NoOpFileSystemStorageService: sanitizeSettings called during SSR');
     return {};
  }

   private createHistoryItem(text: string, settings: any, result: any, metadata?: any): HistoryItem {
     console.warn('NoOpFileSystemStorageService: createHistoryItem called during SSR');
     // Return a minimal HistoryItem to satisfy the return type, adjust if needed
     return { 
       id: '', 
       text: '', 
       settings: { provider: '' as any, model: '', voice: '' }, // Provide dummy values for TTSSettings
       result: { 
         queryId: QueryId.fromString(''), // Use static fromString
         status: 'COMPLETED' as any, // Use a valid enum value, cast as any to avoid strict type check errors in no-op
         createdAt: new Date(), 
         updatedAt: new Date(),
         // Add other required properties with default/dummy values
         audioData: undefined,
         duration: undefined,
       }, 
       createdAt: new Date(), 
       audioSize: 0 
     };
  }
} 