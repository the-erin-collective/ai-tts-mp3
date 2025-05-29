// File System Storage Service - Enhanced storage using File System Access API
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { HistoryItem, StorageInfo } from './history-storage.service';
import { TTSResult, TTSSettings, QueryId, TTSResultStatus } from '../domain/tts.entity';

// Polyfill interface for Window with showDirectoryPicker
interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
}

// Polyfill for DirectoryPickerOptions if not present
interface DirectoryPickerOptions {
  mode?: 'read' | 'readwrite';
  startIn?: string;
}

// Polyfill for FileSystemDirectoryHandle.entries()
interface DirectoryHandleWithEntries extends FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;

}

export interface FileSystemStorageState {
  isSupported: boolean;
  isEnabled: boolean;
  directoryHandle: FileSystemDirectoryHandle | null;
  selectedPath: string | null;
}

export interface FolderReconnectionPrompt {
  previousPath: string;
  shouldPrompt: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FileSystemStorageService {
  private readonly STORAGE_KEY = 'tts-history';
  private readonly METADATA_FILE = 'history-metadata.json';
  private readonly FOLDER_STATE_KEY = 'tts-folder-state';
  private readonly MAX_STORAGE_MB = 20; // Still used for localStorage fallback
  
  private fileSystemStateSubject = new BehaviorSubject<FileSystemStorageState>({
    isSupported: this.isFileSystemAccessSupported(),
    isEnabled: false,
    directoryHandle: null,
    selectedPath: null
  });

  private historySubject = new BehaviorSubject<HistoryItem[]>([]);
  private storageInfoSubject = new BehaviorSubject<StorageInfo>(this.calculateStorageInfo());
  private folderReconnectionSubject = new BehaviorSubject<FolderReconnectionPrompt | null>(null);
  constructor(
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.initializeService();
  }

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Observables
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

  // Current state getters
  getFileSystemState(): FileSystemStorageState {
    return this.fileSystemStateSubject.value;
  }

  getHistory(): HistoryItem[] {
    return this.historySubject.value;
  }

  getStorageInfo(): StorageInfo {
    return this.storageInfoSubject.value;
  }

  // Initialize service and check for previous folder state
  private async initializeService(): Promise<void> {
    await this.loadStorageState();
    
    // Check if there was a previously unlocked folder
    const previousFolderState = this.getPreviousFolderState();
    if (previousFolderState && this.isFileSystemAccessSupported()) {
      // Prompt user to reconnect to previous folder
      this.folderReconnectionSubject.next({
        previousPath: previousFolderState.selectedPath,
        shouldPrompt: true
      });
      // Don't load history yet - wait for user's decision
      return;
    }

    // No previous folder or API not supported, load normally
    await this.loadHistory();
  }
  // Check if user wants to reconnect to previous folder
  async handleFolderReconnection(reconnect: boolean): Promise<void> {
    const prompt = this.folderReconnectionSubject.value;
    if (!prompt) return;

    this.folderReconnectionSubject.next(null); // Clear the prompt

    if (reconnect) {
      // Try to reconnect to the folder
      const result = await this.enableFileSystemStorage(true); // Pass true for reconnection
      if (result.success) {
        // Successfully reconnected, history has been loaded from file system
        console.log('Successfully reconnected to folder and loaded history');
        return;
      } else {
        // Failed to reconnect, fall back to localStorage
        console.warn('Failed to reconnect to previous folder, falling back to localStorage');
      }
    } else {
      // User declined, clear the previous folder state
      this.clearPreviousFolderState();
    }

    // Load from localStorage
    await this.loadHistory();
  }

  // Check if File System Access API is supported
  private isFileSystemAccessSupported(): boolean {
    // Check if we're in a browser environment first
    if (typeof window === 'undefined') {
      return false;
    }
    return 'showDirectoryPicker' in window && 'FileSystemDirectoryHandle' in window;
  }
  // Enable file system storage by selecting a directory
  async enableFileSystemStorage(isReconnection = false): Promise<{ success: boolean; error?: string }> {
    try {
      // Clear existing history before switching storage modes
      this.historySubject.next([]);
      this.updateStorageInfo();

      // Prepare directory picker options
      const previousFolderState = this.getPreviousFolderState();
      const pickerOptions: DirectoryPickerOptions = {
        mode: 'readwrite',
        startIn: 'documents'
      };

      // If reconnecting and we have a previous folder path, try to help user find it
      if (isReconnection && previousFolderState?.selectedPath) {
        console.log(`Suggesting reconnection to previous folder: ${previousFolderState.selectedPath}`);
        pickerOptions.startIn = 'documents';
      }
      
      // Show directory picker
      const handle = await (window as unknown as WindowWithDirectoryPicker).showDirectoryPicker(pickerOptions);

      // Test write permissions by attempting to create a test file
      try {
        await handle.getFileHandle('tts-permission-test.tmp', { create: true });
        await handle.removeEntry('tts-permission-test.tmp');
      } catch {
        return { 
          success: false, 
          error: 'Write permission denied for selected folder. Please choose a folder you have write access to.'
        };
      }

      // Store directory handle
      const state = this.fileSystemStateSubject.value;
      const newState: FileSystemStorageState = {
        ...state,
        isEnabled: true,
        directoryHandle: handle,
        selectedPath: handle.name
      };

      this.fileSystemStateSubject.next(newState);
      await this.saveStorageState();
      this.saveFolderState();

      try {
        // First try to load existing history from the selected folder
        console.log('Loading existing history from file system');
        const fileSystemHistory = await this.loadFromFileSystem();
        this.historySubject.next(fileSystemHistory);
        this.updateStorageInfo();

        if (!isReconnection && fileSystemHistory.length === 0) {
          // If this is a new folder and it's empty, try to migrate localStorage history
          console.log('New empty folder selected, attempting to migrate localStorage history');
          await this.migrateFromLocalStorage();
        }
      } catch (error) {
        console.error('Failed to load/migrate history:', error);
        // Keep history empty on error
        this.historySubject.next([]);
        this.updateStorageInfo();
      }

      console.log('File system storage enabled successfully');
      return { success: true };
    } catch (error: Error | unknown) {
      // Reset state on error
      this.historySubject.next([]);
      this.updateStorageInfo();
      
      console.error('Failed to enable file system storage:', error);
        // Handle specific error types
      if (error instanceof DOMException) {
        if (error.name === 'AbortError') {
          // User cancelled folder selection, reload the previous history
          await this.loadHistory();
          return { success: false, error: 'Folder selection was cancelled' };
        } else if (error.name === 'NotAllowedError') {
          return { success: false, error: 'Permission denied to access file system' };
        } else if (error.name === 'SecurityError') {
          return { success: false, error: 'Security restrictions prevent file system access' };
        }
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to select directory' 
      };
    }
  }

  // Disable file system storage and fall back to localStorage
  async disableFileSystemStorage(): Promise<boolean> {
    try {
      // Clear existing history first
      this.historySubject.next([]);
      this.updateStorageInfo();

      const state = this.fileSystemStateSubject.value;
      const newState: FileSystemStorageState = {
        ...state,
        isEnabled: false,
        directoryHandle: null,
        selectedPath: null,
      };
      
      this.fileSystemStateSubject.next(newState);
      await this.clearStorageState();
      this.clearPreviousFolderState();

      // Load history from localStorage
      console.log('Loading history from local storage after disabling file system storage');
      await this.loadHistory();
      
      return true;
    } catch (error: Error | unknown) {
      console.error('Failed to disable file system storage:', error);
      return false;
    }
  }

  // Add item to history (works with both storage types)
  async addToHistory(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }> {
    if (!result.audioData) {
      return { success: false };
    }

    const audioSize = result.audioData.byteLength;
    const itemId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

    // Create the history item
    const historyItem: HistoryItem = {
      id: itemId,
      text: text,
      settings: {
        ...settings,
        apiKey: undefined, // Remove the API key before saving
      },
      result: {
        queryId: result.queryId,
        status: result.status,
        audioData: result.audioData,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
      createdAt: new Date(),
      audioSize: result.audioData.length,
      metadata: metadata,
    };

    const currentHistory = this.getHistory();
    const warnings: string[] = [];
    const removedItems: HistoryItem[] = [];

    // For localStorage mode, check size limits
    if (!this.getFileSystemState().isEnabled) {
      const newItemSizeMB = audioSize / (1024 * 1024);
      
      if (newItemSizeMB > this.MAX_STORAGE_MB) {
        warnings.push(`Item too large (${newItemSizeMB.toFixed(1)}MB). Maximum allowed is ${this.MAX_STORAGE_MB}MB.`);
        return { success: false, warnings };
      }      // Remove old items if needed
      const workingHistory = [...currentHistory];
      let currentUsage = this.calculateStorageInfo().used;

      while (currentUsage + audioSize > this.MAX_STORAGE_MB * 1024 * 1024 && workingHistory.length > 0) {
        const removed = workingHistory.shift()!;
        removedItems.push(removed);
        currentUsage -= removed.audioSize;
      }
    }

    // Add new item
    const newHistory = [historyItem, ...currentHistory.filter(h => !removedItems.some(r => r.id === h.id))];

    try {
      await this.saveHistory(newHistory);
      this.historySubject.next(newHistory);
      this.updateStorageInfo();

      return { 
        success: true, 
        warnings: warnings.length > 0 ? warnings : undefined,
        removed: removedItems.length > 0 ? removedItems : undefined
      };
    } catch (error) {
      console.error('Failed to save history:', error);
      return { success: false, warnings: ['Failed to save history'] };
    }
  }

  // Remove item from history
  async removeFromHistory(itemId: string): Promise<boolean> {
    const currentHistory = this.getHistory();
    const item = currentHistory.find(h => h.id === itemId);
    const newHistory = currentHistory.filter(h => h.id !== itemId);

    try {
      await this.saveHistory(newHistory);
      
      // Also remove the audio file if using file system storage
      if (this.getFileSystemState().isEnabled && item) {
        await this.deleteAudioFile(item.id);
      }

      this.historySubject.next(newHistory);
      this.updateStorageInfo();
      return true;
    } catch (error) {
      console.error('Failed to remove item from history:', error);
      return false;
    }
  }

  // Clear all history
  async clearHistory(): Promise<boolean> {
    try {
      const state = this.getFileSystemState();
        if (state.isEnabled && state.directoryHandle) {        // Clear all files in the directory
        // Use type assertion to access entries() method
        for await (const [name, handle] of (state.directoryHandle as DirectoryHandleWithEntries).entries()) {
          if (handle.kind === 'file') {
            await state.directoryHandle.removeEntry(name);
          }
        }
      }else {
        // Clear localStorage
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(this.STORAGE_KEY);
        }
      }

      this.historySubject.next([]);
      this.updateStorageInfo();
      return true;
    } catch (error) {
      console.error('Failed to clear history:', error);
      return false;
    }
  }

  // Private methods for file system operations
  private async saveHistory(history: HistoryItem[]): Promise<void> {
    const state = this.getFileSystemState();
    if (state.isEnabled && state.directoryHandle) {
      await this.saveToFileSystem(history);
    } else {
      this.saveToLocalStorage(history);
    }
  }

  private async saveToFileSystem(history: HistoryItem[]): Promise<void> {
    const state = this.getFileSystemState();
    if (!state.directoryHandle) throw new Error('No directory handle available');

    // Save metadata file
    const metadata = history.map(item => ({
      id: item.id,
      text: item.text,
      settings: item.settings,
      createdAt: item.createdAt.toISOString(),
      audioSize: item.audioSize,
      metadata: item.metadata
    }));

    const metadataHandle = await state.directoryHandle.getFileHandle(this.METADATA_FILE, { create: true });
    const writable = await metadataHandle.createWritable();
    await writable.write(JSON.stringify(metadata, null, 2));
    await writable.close();

    // Save individual audio files
    for (const item of history) {
      if (item.result.audioData) {
        const audioFileName = `${item.id}.mp3`;
        try {
          const audioHandle = await state.directoryHandle.getFileHandle(audioFileName, { create: true });
          const audioWritable = await audioHandle.createWritable();
          await audioWritable.write(item.result.audioData);
          await audioWritable.close();
        } catch (error) {
          console.warn(`Failed to save audio file ${audioFileName}:`, error);
        }
      }
    }
  }

  private saveToLocalStorage(history: HistoryItem[]): void {
    if (!this.isBrowser) return;

    const key = this.STORAGE_KEY;
    const serializable = history.map(item => ({      id:        item.id,
      text:      item.text,
      settings:  { ...item.settings, apiKey: undefined },  // Don't store API key
      queryId:   item.result.queryId.toString(),     // ← use toString()
      status:    item.result.status,
      audioData: Array.from(item.result.audioData!),
      timestamp: item.result.createdAt.toISOString(),
      title:     item.metadata?.title ?? null,
    }));
    console.debug('[TTS] saving history to localStorage:', serializable);
    localStorage.setItem(key, JSON.stringify(serializable));
  }

  private async loadHistory(): Promise<void> {
    // Clear existing history first
    this.historySubject.next([]);
    this.updateStorageInfo();

    const state = this.getFileSystemState();

    if (state.isEnabled && state.directoryHandle) {
      // Load from file system
      try {
        console.log('Loading history from file system storage');
        const fileSystemHistory = await this.loadFromFileSystem();
        this.historySubject.next(fileSystemHistory);
        console.debug('[TTS] loaded history from file system:', fileSystemHistory);
        this.updateStorageInfo();
        return;
      } catch (error) {
        console.error('[TTS] error loading history from file system:', error);
        // Keep history empty on file system error
        return;
      }
    }

    // Load from localStorage if file system is not enabled
    console.log('Loading history from local storage');
    this.loadFromLocalStorage();
  }
  private async loadFromFileSystem(): Promise<HistoryItem[]> {
    const state = this.getFileSystemState();
    if (!state.directoryHandle) return []; // Return empty array if no directory handle

    try {
      console.log('Loading history from file system...');
      
      // Load metadata
      const metadataHandle = await state.directoryHandle.getFileHandle(this.METADATA_FILE);
      const metadataFile = await metadataHandle.getFile();
      const metadataText = await metadataFile.text();
      const metadata = JSON.parse(metadataText);

      console.log(`Found ${metadata.length} items in metadata file`);

      // Load audio files and reconstruct history
      const history: HistoryItem[] = [];
      for (const meta of metadata) {
        try {
          const audioFileName = `${meta.id}.mp3`;
          const audioHandle = await state.directoryHandle.getFileHandle(audioFileName);
          const audioFile = await audioHandle.getFile();
          const audioData = new Uint8Array(await audioFile.arrayBuffer());

          const item: HistoryItem = {
            ...meta,
            createdAt: new Date(meta.createdAt),
            result: {
              status: 'completed' as const,
              audioData,
              createdAt: new Date(meta.createdAt),
              updatedAt: new Date(meta.createdAt)
            }
          };

          history.push(item);
        } catch (error) {
          console.warn(`Failed to load audio file for item ${meta.id}:`, error);
        }
      }

      console.log(`Successfully loaded ${history.length} items from file system`);
      this.updateStorageInfo(); // Update storage info after loading
      return history; // Return the loaded history
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        // No history file exists yet
        console.log('No history metadata file found, starting with empty history');
        this.updateStorageInfo();
        return []; // Return empty array if no history file
      } else {
        console.error('Error loading from file system:', error);
        throw error;
      }
    }
  }
  private loadFromLocalStorage(): void {
    if (!this.isBrowser) {
      console.info('[TTS] SSR: skipping localStorage history load');
      this.historySubject.next([]);
      this.updateStorageInfo();
      return;
    }

    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      this.historySubject.next([]);
      this.updateStorageInfo();
      return;
    }

    interface SerializedHistoryItemBase {
      id: string;
      text: string;
      settings: TTSSettings;
      queryId: string;
      status: string;
      audioData: number[];
      timestamp: string;
      title?: string;
    }

    let parsed: SerializedHistoryItemBase[];
    try {
      parsed = JSON.parse(raw);
      console.debug('[TTS] loaded history from localStorage:', parsed);
    } catch {
      console.error('[TTS] corrupt localStorage, clearing history');
      localStorage.removeItem(this.STORAGE_KEY);
      this.historySubject.next([]);
      this.updateStorageInfo();
      return;
    }

    const items: HistoryItem[] = parsed.map(r => ({
      id:        r.id,
      text:      r.text,
      settings:  r.settings as TTSSettings,          // ← restore full settings
      result:    {
        queryId:   new QueryId(r.queryId),
        status:    r.status as TTSResultStatus,
        audioData: Uint8Array.from(r.audioData),
        createdAt: new Date(r.timestamp),
        updatedAt: new Date(r.timestamp),
      },
      createdAt: new Date(r.timestamp),
      audioSize: r.audioData.length,
      metadata:  { title: r.title },
    }));

    this.historySubject.next(items);
    this.updateStorageInfo();
  }

  private async deleteAudioFile(itemId: string): Promise<void> {
    const state = this.getFileSystemState();
    if (!state.directoryHandle) return;

    try {
      const audioFileName = `${itemId}.mp3`;
      await state.directoryHandle.removeEntry(audioFileName);
    } catch (error) {
      console.warn(`Failed to delete audio file for item ${itemId}:`, error);
    }
  }  private async migrateFromLocalStorage(): Promise<void> {
    // Load from localStorage and save to file system
    if (typeof localStorage === 'undefined') return;

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      interface SerializedHistoryItem {
        id: string;
        text: string;
        settings: TTSSettings;
        result: {
          queryId: string;
          status: string;
          audioData?: number[];
          createdAt: string;
          updatedAt: string;
          duration?: number;
          fileSize?: number;
          error?: {
            code: string;
            message: string;
            details?: unknown;
          };
          processingTime?: number;
          [key: string]: unknown;
        };
        createdAt: string;
        audioSize: number;        metadata?: { title?: string; tags?: string[]; duration?: number };
      }      const history = (parsed as SerializedHistoryItem[]).map((item) => ({
        ...item,
        createdAt: new Date(item.createdAt),
        result: {
          ...item.result,
          queryId: new QueryId(item.result.queryId),
          status: item.result.status as TTSResultStatus,
          createdAt: new Date(item.result.createdAt),
          updatedAt: new Date(item.result.updatedAt),
          audioData: item.result.audioData ? new Uint8Array(Object.values(item.result.audioData)) : undefined
        }
      }));

      await this.saveToFileSystem(history);
      this.historySubject.next(history);

      // Clear localStorage after successful migration
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to migrate from localStorage:', error);
    }
  }

  private async migrateToLocalStorage(): Promise<void> {
    // Save current file system history to localStorage
    const currentHistory = this.getHistory();
    await this.saveToLocalStorage(currentHistory);
  }

  private async saveStorageState(): Promise<void> {
    // Save the storage state configuration (but not the directory handle itself)
    if (typeof localStorage === 'undefined') return;

    const state = this.getFileSystemState();
    const stateToSave = {
      isEnabled: state.isEnabled,
      selectedPath: state.selectedPath
    };

    localStorage.setItem('tts-storage-state', JSON.stringify(stateToSave));
  }
  private async loadStorageState(): Promise<void> {
    // Check if we're in a browser environment first
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem('tts-storage-state');
      if (stored) {
        const savedState = JSON.parse(stored);
        
        // If file system was previously enabled, we need to prompt user to re-select
        if (savedState.isEnabled && this.isFileSystemAccessSupported()) {
          const currentState = this.getFileSystemState();
          this.fileSystemStateSubject.next({
            ...currentState,
            selectedPath: savedState.selectedPath
          });
        }
      }
    } catch (error) {
      console.error('Failed to load storage state:', error);
    }
  }

  private async clearStorageState(): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('tts-storage-state');
    }
  }

  private calculateStorageInfo(): StorageInfo {
    const history = this.historySubject.value;
    const state = this.getFileSystemState();

    if (state.isEnabled) {
      // For file system storage, we don't have strict limits
      const used = history.reduce((total, item) => total + item.audioSize, 0);
      return {
        used,
        available: Infinity,
        total: Infinity,
        usedPercentage: 0, // No percentage for unlimited storage
        itemCount: history.length
      };
    } else {
      // For localStorage, use the original calculation
      const used = history.reduce((total, item) => total + item.audioSize, 0);
      const total = this.MAX_STORAGE_MB * 1024 * 1024;
      const available = total - used;
      const usedPercentage = used / total;

      return {
        used,
        available,
        total,
        usedPercentage,
        itemCount: history.length
      };
    }
  }

  private updateStorageInfo(): void {
    this.storageInfoSubject.next(this.calculateStorageInfo());
  }

  // Storage warning methods for localStorage mode
  isStorageNearFull(): boolean {
    const state = this.getFileSystemState();
    if (state.isEnabled) return false;
    
    return this.getStorageInfo().usedPercentage > 0.8;
  }

  isStorageCritical(): boolean {
    const state = this.getFileSystemState();
    if (state.isEnabled) return false;
    
    return this.getStorageInfo().usedPercentage > 0.9;
  }

  // Get items that would be removed if we add a new item (localStorage mode only)
  getItemsToBeRemoved(newItemSize: number): HistoryItem[] {
    const state = this.getFileSystemState();
    if (state.isEnabled) return []; // No limits in file system mode

    const currentHistory = this.getHistory();
    const storageInfo = this.getStorageInfo();
    const maxBytes = this.MAX_STORAGE_MB * 1024 * 1024;
    
    if (storageInfo.used + newItemSize <= maxBytes) {
      return [];
    }

    const toRemove: HistoryItem[] = [];
    let totalSizeToRemove = (storageInfo.used + newItemSize) - maxBytes;
    
    for (let i = currentHistory.length - 1; i >= 0 && totalSizeToRemove > 0; i--) {
      toRemove.unshift(currentHistory[i]);
      totalSizeToRemove -= currentHistory[i].audioSize;
    }
    
    return toRemove;
  }

  // Get previously saved folder state from localStorage
  private getPreviousFolderState(): { selectedPath: string } | null {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const stored = localStorage.getItem(this.FOLDER_STATE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        if (state.wasEnabled && state.selectedPath) {
          return { selectedPath: state.selectedPath };
        }
      }
    } catch (error) {
      console.error('Failed to load previous folder state:', error);
    }

    return null;
  }

  // Clear previously saved folder state
  private clearPreviousFolderState(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(this.FOLDER_STATE_KEY);
    } catch (error) {
      console.error('Failed to clear previous folder state:', error);
    }
  }

  // Save folder state to localStorage (separate from the temp storage state)
  private saveFolderState(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const state = this.getFileSystemState();
      const stateToSave = {
        wasEnabled: state.isEnabled,
        selectedPath: state.selectedPath
      };

      localStorage.setItem(this.FOLDER_STATE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Failed to save folder state:', error);
    }
  }
}
