// File System Storage Service - Enhanced storage using File System Access API
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { HistoryItem, StorageInfo } from './history-storage.service';
import { TTSResult, TTSSettings, QueryId, TTSResultStatus } from '../domain/tts.entity';
import { ApiKey } from '../domain/value-objects/api-key';

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
    // Only initialize browser-specific features in the browser
    if (this.isBrowser) {
      this.initializeService();
    } else {
      // For SSR, initialize with default state or a server-appropriate state
      this.fileSystemStateSubject.next({
        isSupported: false,
        isEnabled: false,
        directoryHandle: null,
        selectedPath: null
      });
      this.historySubject.next([]);
      this.storageInfoSubject.next(this.calculateStorageInfo());
      this.folderReconnectionSubject.next(null);
    }
  }

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Observables (these are generally SSR-safe as they just hold/emit data)
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

  // Current state getters (return current state, SSR-safe)
  getFileSystemState(): FileSystemStorageState {
    return this.fileSystemStateSubject.value;
  }

  getHistory(): HistoryItem[] {
    return this.historySubject.value;
  }

  getStorageInfo(): StorageInfo {
    // This method calls calculateStorageInfo which has platform-specific logic,
    // but calculateStorageInfo is now SSR-safe.
    return this.storageInfoSubject.value;
  }

  // Initialize service and check for previous folder state (Browser only)
  private async initializeService(): Promise<void> {
    if (!this.isBrowser) return; // Ensure this only runs in the browser
    
    await this.loadStorageState();
    
    // Check if there was a previously unlocked folder based on the loaded state
    const loadedState = this.fileSystemStateSubject.value; // Check the state loaded by loadStorageState
    
    if (loadedState.isEnabled && loadedState.selectedPath && this.isFileSystemAccessSupported()) {
      // Prompt user to reconnect to previous folder
      this.folderReconnectionSubject.next({
        previousPath: loadedState.selectedPath,
        shouldPrompt: true
      });
      // Don't load history yet - wait for user's decision
      return;
    }

    // No previous folder in loaded state or API not supported, load normally
    await this.loadHistory();
  }

  // Check if user wants to reconnect to previous folder (Browser only)
  async handleFolderReconnection(reconnect: boolean): Promise<void> {
    if (!this.isBrowser) return; // Ensure this only runs in the browser

    const prompt = this.folderReconnectionSubject.value;
    if (!prompt) return;

    this.folderReconnectionSubject.next(null); // Clear the prompt

    if (reconnect) {
      // Try to reconnect to the folder
      const result = await this.enableFileSystemStorage(true);
      if (result.success) {
        // Successfully reconnected, history has been loaded from file system
        return;
      } else {
        // Failed to reconnect, fall back to localStorage
        this.clearPreviousFolderState();
      }
    } else {
      // User declined, clear the previous folder state
      this.clearPreviousFolderState();
    }

    // Load from localStorage
    await this.loadHistory();
  }

  // Check if File System Access API is supported (Browser only)
  private isFileSystemAccessSupported(): boolean {
    if (!this.isBrowser) return false; // Ensure this only runs in the browser
    const isSupported = 'showDirectoryPicker' in window && 'FileSystemDirectoryHandle' in window;
    return isSupported;
  }

  // Enable file system storage by selecting a directory (Browser only)
  async enableFileSystemStorage(isReconnection = false): Promise<{ success: boolean; error?: string }> {
    if (!this.isBrowser) return { success: false, error: 'Not available on server' }; // Ensure this only runs in the browser

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
        pickerOptions.startIn = 'documents';
      }

      // Show directory picker
      const handle = await (window as any).showDirectoryPicker(pickerOptions);

      // Test write permissions by attempting to create a test file
      try {
        const testHandle = await (handle as any).getFileHandle('tts-permission-test.tmp', { create: true });
        await (testHandle as any).remove();
      } catch (permissionError) {
        console.error('[TTS] Write permission test failed:', permissionError);
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
        const fileSystemHistory = await this.loadFromFileSystem();
        this.historySubject.next(fileSystemHistory);
        this.updateStorageInfo();

        if (!isReconnection && fileSystemHistory.length === 0) {
          // If this is a new folder and it's empty, try to migrate localStorage history
          await this.migrateFromLocalStorage();
        }
      } catch (error) {
        // Keep history empty on error
        this.historySubject.next([]);
        this.updateStorageInfo();
      }

      return { success: true };
    } catch (error: any) { // Use any for error type
      // Reset state on error
      this.historySubject.next([]);
      this.updateStorageInfo();

      // If user cancels the picker, this is caught here
      if (error.name === 'AbortError') {
        console.log('Directory picker was cancelled.');
      } else {
        console.error('An unexpected error occurred during file system storage enablement:', error);
      }
      // Revert state if enablement failed
      const state = this.fileSystemStateSubject.value;
       this.fileSystemStateSubject.next({
         ...state,
         isEnabled: false,
         directoryHandle: null,
         selectedPath: null
       });
  
       return {
         success: false,
         error: error.message || 'Unknown error during file system storage enablement'
       };
    }
  }

  async disableFileSystemStorage(): Promise<boolean> {
    if (!this.isBrowser) return false; // Ensure this only runs in the browser

    try {
      // Clear existing history before switching storage modes
      this.historySubject.next([]);
      this.updateStorageInfo();

      // Clear file system state and remove directory handle
      const state = this.fileSystemStateSubject.value;
      const newState: FileSystemStorageState = {
        ...state,
        isEnabled: false,
        directoryHandle: null,
        selectedPath: null
      };
      this.fileSystemStateSubject.next(newState);
      await this.clearStorageState(); // Clear storage state from IndexedDB
      this.clearPreviousFolderState(); // Clear from localStorage as well

      // Load history from localStorage
      await this.loadHistory();

      console.log('File system storage disabled successfully, reverted to localStorage.');
      return true;
    } catch (error) {
      console.error('Failed to disable file system storage:', error);
      return false;
    }
  }

  // Add history item
  async addToHistory(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }> {
    // Ensure history array is immutable when manipulating it
    let currentHistory = [...this.historySubject.value];
    const fileSystemState = this.getFileSystemState();
    let removedItems: HistoryItem[] = [];
    let warnings: string[] = [];

    // Create the new history item
    const newItem = this.createHistoryItem(text, settings, result, metadata);

    // Check storage limits and remove oldest items if necessary (only for localStorage mode)
    if (!fileSystemState.isEnabled) {
       const itemsToBeRemoved = this.getItemsToBeRemoved(newItem.audioSize);
       if (itemsToBeRemoved.length > 0) {
         removedItems = itemsToBeRemoved;
         warnings.push(`Storage limit exceeded. Removed ${removedItems.length} oldest item(s).`);

         // Remove the items from the current history array
         const removedIds = new Set(removedItems.map(item => item.id));
         currentHistory = currentHistory.filter(item => !removedIds.has(item.id));
       }
    }

    // Add the new item to the history (at the beginning for newest first)
    currentHistory.unshift(newItem);

    // Update the observable and save history
    this.historySubject.next(currentHistory);
    await this.saveHistory(currentHistory); // Save to appropriate storage

    this.updateStorageInfo(); // Recalculate and update storage info

    return { success: true, warnings, removed: removedItems };
  }

  async removeFromHistory(itemId: string): Promise<boolean> {
    const currentHistory = this.historySubject.value;
    const initialLength = currentHistory.length;
    const updatedHistory = currentHistory.filter(item => item.id !== itemId);

    if (updatedHistory.length === initialLength) {
      // Item not found
      console.warn(`Item with ID ${itemId} not found in history.`);
      return false;
    }

    // Update observable and save history
    this.historySubject.next(updatedHistory);
    await this.saveHistory(updatedHistory); // Save to appropriate storage

    // If using file system storage, delete the associated audio file
    if (this.getFileSystemState().isEnabled) {
      try {
        await this.deleteAudioFile(itemId);
      } catch (error) {
        console.error(`Failed to delete audio file for item ${itemId}:`, error);
        // Continue even if file deletion fails, as history item is removed
      }
    }

    this.updateStorageInfo(); // Recalculate and update storage info

    console.log(`Item with ID ${itemId} removed from history.`);
    return true;
  }

  async clearHistory(): Promise<boolean> {
    try {
      // Clear history in memory and update observable
      this.historySubject.next([]);

      // Clear from localStorage
      if (this.isBrowser) {
        localStorage.removeItem(this.STORAGE_KEY);
      }

      // If using file system storage, delete all audio files and metadata file
      if (this.getFileSystemState().isEnabled && this.getFileSystemState().directoryHandle) {
        const handle = this.getFileSystemState().directoryHandle;
        if (handle) {
          try {
            // Delete metadata file
            await (handle as any).removeEntry(this.METADATA_FILE).catch((e: any) => {
              if (e.name !== 'NotFoundError') {
                console.error('Error deleting metadata file:', e);
              }
            });

            // Delete all audio files (*.mp3)
            // Note: Iterating entries might be slow for very large directories.
            // A better approach might be to store filenames in metadata.
            // For now, assuming a manageable number of files.
            for await (const entry of (handle as DirectoryHandleWithEntries).entries()) {
              const [name, entryHandle] = entry;
              if (entryHandle.kind === 'file' && name.endsWith('.mp3')) {
                try {
                  await (handle as any).removeEntry(name);
                } catch (error) {
                  console.error(`Failed to delete audio file ${name}:`, error);
                }
              }
            }
          } catch (error) {
            console.error('Error clearing file system storage:', error);
            // Continue even if file system cleanup fails
          }
        }
      }

      this.updateStorageInfo(); // Recalculate and update storage info

      console.log('All history cleared.');
      return true;
    } catch (error) {
      console.error('Failed to clear history:', error);
      return false;
    }
  }

  // Save history to either localStorage or file system (Browser only)
  private async saveHistory(history: HistoryItem[]): Promise<void> {
    if (!this.isBrowser) return; // Skip if not in browser

    if (this.getFileSystemState().isEnabled && this.getFileSystemState().directoryHandle) {
      // Save to file system
      await this.saveToFileSystem(history);
    } else {
      // Save to localStorage (fallback)
      this.saveToLocalStorage(history);
    }
  }

  private async saveToFileSystem(history: HistoryItem[]): Promise<void> {
    if (!this.isBrowser || !this.fileSystemStateSubject.value.directoryHandle) {
      // console.log('Skip saveToFileSystem: not in browser or no directory handle');
      return; // Skip if not in browser or no directory handle
    }

    const handle = this.fileSystemStateSubject.value.directoryHandle;

    try {
      // Save audio files
      for (const item of history) {
        if (item.result?.audioData) {
          try {
            const audioFileName = `${item.id}.mp3`;
            const fileHandle = await (handle as any).getFileHandle(audioFileName, { create: true });
            const writable = await (fileHandle as any).createWritable();
            await writable.write(item.result.audioData);
            await writable.close();
            // console.log(`Saved audio file ${audioFileName}`);
          } catch (error) {
            console.error(`Failed to save audio file for item ${item.id}:`, error);
          }
        }
      }

      // Save metadata file (contains all history items metadata, excluding large audioData)
      const metadata = history.map(item => this.serializeHistoryItemForFileSystemMetadata(item));
      const metadataFileHandle = await (handle as any).getFileHandle(this.METADATA_FILE, { create: true });
      const writable = await (metadataFileHandle as any).createWritable();
      await writable.write(JSON.stringify({ history: metadata }, null, 2)); // Pretty print JSON
      await writable.close();
      // console.log('Saved metadata file.');

    } catch (error) {
      console.error('Error saving history to file system:', error);
    }
  }

  private saveToLocalStorage(history: HistoryItem[]): void {
    if (!this.isBrowser) return; // Skip if not in browser
    try {
      // Only save a limited number of items to localStorage
      const itemsToSave = history.slice(0, 100); // Save latest 100 items
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(itemsToSave.map(this.serializeHistoryItemForLocalStorage)));
    } catch (error) {
      console.error('Error saving history to localStorage:', error);
    }
  }

  // Load history from either localStorage or file system (Browser only)
  private async loadHistory(): Promise<void> {
    if (!this.isBrowser) {
       this.historySubject.next([]);
       this.updateStorageInfo();
       return;
     }

    const state = this.getFileSystemState();

    let history: HistoryItem[] = [];
    if (state.isEnabled && state.directoryHandle) {
      // Load from file system
      history = await this.loadFromFileSystem();
    } else {
      // Load from localStorage (fallback)
      this.loadFromLocalStorage(); // This method directly updates historySubject and storageInfoSubject
      return; // Exit after localStorage load
    }

    // Update observable with loaded history (if from file system)
    this.historySubject.next(history);
    this.updateStorageInfo();
  }

   private async loadFromFileSystem(): Promise<HistoryItem[]> {
     if (!this.isBrowser || !this.fileSystemStateSubject.value.directoryHandle) {
       return []; // Return empty array if not in browser or no handle
     }

     const handle = this.fileSystemStateSubject.value.directoryHandle;
     let metadataFileHandle: FileSystemFileHandle | null = null;
     let history: HistoryItem[] = [];

     try {
       // Get the metadata file handle
       metadataFileHandle = await (handle as any).getFileHandle(this.METADATA_FILE, { create: false }).catch((e: any) => {
         if (e.name === 'NotFoundError') {
           return null; // File not found is expected for a new folder
         }
         throw e; // Re-throw other errors
       });

       if (metadataFileHandle) {
         // Read the metadata file
         const file = await metadataFileHandle.getFile();
         const contents = await file.text();
         const metadata = JSON.parse(contents);

         // Load history items based on metadata
         if (metadata.history && Array.isArray(metadata.history)) {
           // Use a loop to load each item individually
           for (const serializedItem of metadata.history) {
             try {
               const historyItem = await this.deserializeHistoryItemFromFileSystem(serializedItem);
               history.push(historyItem);
             } catch (itemError) {
               console.error('Error deserializing history item from file system:', itemError, serializedItem);
               // Decide whether to skip or include partial item on error
             }
           }
         }
       }
       return history;

     } catch (error) {
       console.error('Error loading history from file system:', error);
       return []; // Return empty array on error
     }
   }

   private loadFromLocalStorage(): void {
     if (!this.isBrowser) {
       return; // Skip if not in browser
     }

     try {
       const storedHistory = localStorage.getItem(this.STORAGE_KEY);
       if (storedHistory) {
         // Ensure we have valid data structure even with old versions
         const history: HistoryItem[] = JSON.parse(storedHistory).map(this.deserializeHistoryItem);
         this.historySubject.next(history);
       } else {
          this.historySubject.next([]);
       }
     } catch (error) {
       console.error('Error loading history from localStorage:', error);
       this.historySubject.next([]); // Load empty history on error
     }
    }

  // Helper function to deserialize a history item from file system metadata
  private async deserializeHistoryItemFromFileSystem(serializedItem: any): Promise<HistoryItem> {
    // This method needs to load the audio file data asynchronously
    if (!this.isBrowser || !this.fileSystemStateSubject.value.directoryHandle) {
      throw new Error('Cannot deserialize history item: not in browser or no directory handle');
    }

    const handle = this.fileSystemStateSubject.value.directoryHandle;
    let audioData: Uint8Array | undefined;

    try {
      const audioFileName = `${serializedItem.id}.mp3`;
      const audioHandle = await (handle as any).getFileHandle(audioFileName).catch((e: any) => {
         if (e.name === 'NotFoundError') {
           // Audio file not found, maybe it was manually deleted
           console.warn(`Audio file not found for item ${serializedItem.id}. History item will be loaded without audio.`);
           return null;
         }
         throw e; // Re-throw other errors
      });

      if (audioHandle) {
         const audioFile = await (audioHandle as any).getFile();
         audioData = new Uint8Array(await audioFile.arrayBuffer());
      }
    } catch (error) {
      console.error(`Error loading audio file for item ${serializedItem.id}:`, error);
      // Continue without audio data on error
    }

    const historyItem: HistoryItem = {
      id: serializedItem.id,
      text: serializedItem.text,
      settings: this.mapLoadedSettings(serializedItem.settings), // Ensure settings are mapped
      result: {
        queryId: serializedItem.result?.queryId ? QueryId.fromString(serializedItem.result.queryId) : QueryId.generate(),
        status: serializedItem.result?.status as TTSResultStatus || 'completed', // Default to completed if status is missing
        audioData: audioData, // Use loaded audio data
        createdAt: new Date(serializedItem.result?.createdAt || serializedItem.createdAt), // Prefer result createdAt, fallback to item createdAt
        updatedAt: new Date(serializedItem.result?.updatedAt || serializedItem.createdAt), // Prefer result updatedAt, fallback to item createdAt
        duration: serializedItem.result?.duration, // Load duration from metadata
        fileSize: serializedItem.result?.fileSize, // Load file size from metadata
        error: serializedItem.result?.error,
        processingTime: serializedItem.result?.processingTime,
      },
      createdAt: new Date(serializedItem.createdAt), // Ensure top-level createdAt is a Date
      audioSize: serializedItem.audioSize, // Use stored audio size
      metadata: serializedItem.metadata,
    };

    return historyItem;
  }

  // Helper function to serialize a history item for file system metadata
  private serializeHistoryItemForFileSystemMetadata(item: HistoryItem): any {
    // Exclude audioData from the metadata file
    const serializedItem: any = {
      id: item.id,
      text: item.text,
      settings: item.settings, // Include settings
      // Include necessary result fields, but not audioData
      result: {
        queryId: item.result?.queryId?.getValue(), // Store QueryId as string
        status: item.result.status,
        createdAt: item.result.createdAt.toISOString(), // Store Date as ISO string
        updatedAt: item.result.updatedAt.toISOString(), // Store Date as ISO string
        duration: item.result?.duration,
        fileSize: item.result?.fileSize,
        error: item.result?.error,
        processingTime: item.result?.processingTime,
      },
      createdAt: item.createdAt.toISOString(), // Store Date as ISO string
      audioSize: item.audioSize,
      metadata: item.metadata,
    };
    // Ensure metadata has a title if available in queryInfo
    if (item.metadata?.title === undefined && (item as any).queryInfo?.title) {
        serializedItem.metadata = { ...serializedItem.metadata, title: (item as any).queryInfo.title };
    }
    return serializedItem;
  }

   // Helper function to serialize a history item for localStorage
   private serializeHistoryItemForLocalStorage(item: HistoryItem): any {
     // Include audioData as number array for localStorage
     const serializedItem: any = {
       id: item.id,
       text: item.text,
       settings: item.settings,
       result: {
         queryId: item.result?.queryId?.getValue(), // Store QueryId as string
         status: item.result.status,
         audioData: item.result.audioData ? Array.from(item.result.audioData) : undefined, // Store audioData as number array
         createdAt: item.result.createdAt.toISOString(), // Store Date as ISO string
         updatedAt: item.result.updatedAt.toISOString(), // Store Date as ISO string
         duration: item.result?.duration,
         fileSize: item.result?.fileSize,
         error: item.result?.error,
         processingTime: item.result?.processingTime,
       },
       createdAt: item.createdAt.toISOString(), // Store Date as ISO string
       audioSize: item.audioSize,
       metadata: item.metadata,
     };
      // Ensure metadata has a title if available in queryInfo
     if (item.metadata?.title === undefined && (item as any).queryInfo?.title) {
         serializedItem.metadata = { ...serializedItem.metadata, title: (item as any).queryInfo.title };
     }
     return serializedItem;
   }

   // Helper function to deserialize a history item from localStorage
   private deserializeHistoryItem(serializedItem: any): HistoryItem {
     const historyItem: HistoryItem = {
       id: serializedItem.id,
       text: serializedItem.text,
       settings: this.mapLoadedSettings(serializedItem.settings), // Ensure settings are mapped
       result: {
         queryId: serializedItem.result?.queryId ? QueryId.fromString(serializedItem.result.queryId) : QueryId.generate(),
         status: serializedItem.result?.status as TTSResultStatus || 'completed', // Default to completed if status is missing
         audioData: serializedItem.result?.audioData ? Uint8Array.from(serializedItem.result.audioData) : undefined, // Convert back to Uint8Array
         createdAt: new Date(serializedItem.result?.createdAt || serializedItem.createdAt), // Prefer result createdAt, fallback to item createdAt
         updatedAt: new Date(serializedItem.result?.updatedAt || serializedItem.createdAt), // Prefer result updatedAt, fallback to item createdAt
         duration: serializedItem.result?.duration,
         fileSize: serializedItem.result?.fileSize,
         error: serializedItem.result?.error,
         processingTime: serializedItem.result?.processingTime,
       },
       createdAt: new Date(serializedItem.createdAt), // Ensure top-level createdAt is a Date
       audioSize: serializedItem.audioSize,
       metadata: serializedItem.metadata,
     };

     return historyItem;
   }

  // Helper to calculate storage info (SSR-safe)
   private calculateStorageInfo(): StorageInfo {
     if (!this.isBrowser) {
        // Return a default or estimated storage info for SSR
        return { used: 0, available: 0, total: 0, usedPercentage: 0, itemCount: 0 };
      }
      
      let used = 0;
      const history = this.historySubject.value;
      const itemCount = history.length;

      if (this.fileSystemStateSubject.value.isEnabled) {
        // For file system storage, we don't have easy access to total space.
        // We could potentially estimate based on item file sizes if they were reliably stored,
        // but for now, we'll just report the item count.
        // A more robust solution would require requesting storage estimates via the Storage API,
        // but that is complex and has limitations.
        // For simplicity, we'll report used space based on item file sizes if available,
        // and total/available will be placeholders or based on a large default.
        used = history.reduce((sum, item) => sum + (item.audioSize || 0), 0);

        // Note: This is a rough estimate. Actual file system usage might differ.
        // We cannot reliably get available/total space for arbitrary directories.
        // Placeholder values:
        const total = used > 0 ? used * 2 : 100 * 1024 * 1024; // Estimate total as double used, or 100MB default
        const available = total - used;
        const usedPercentage = total > 0 ? used / total : 0;

        return {
          used,
          available,
          total,
          usedPercentage,
          itemCount
        };

      } else {
        // Fallback for localStorage or if file system is not enabled/supported
        // We use a fixed max size for localStorage estimation.
        used = history.reduce((sum, item) => sum + (item.audioSize || 0), 0);
        const total = this.MAX_STORAGE_MB * 1024 * 1024; // Convert MB to bytes
        const available = Math.max(0, total - used); // Ensure available is not negative
        const usedPercentage = total > 0 ? used / total : 0; // Avoid division by zero

        return {
          used,
          available,
          total,
          usedPercentage,
          itemCount
        };
      }
    }

   private updateStorageInfo(): void {
     this.storageInfoSubject.next(this.calculateStorageInfo());
   }

   isStorageNearFull(): boolean {
     const info = this.storageInfoSubject.value;
     // Near full if > 80% used, but not critical (>90%)
     return info.usedPercentage > 0.8 && info.usedPercentage <= 0.9;
   }

   isStorageCritical(): boolean {
     const info = this.storageInfoSubject.value;
     // Critical if > 90% used
     return info.usedPercentage > 0.9;
   }

   getItemsToBeRemoved(newItemSize: number): HistoryItem[] {
     const history = this.historySubject.value;
     const storageInfo = this.storageInfoSubject.value;
     let itemsToRemove: HistoryItem[] = [];
     let currentSize = storageInfo.used;
     const totalLimit = this.fileSystemStateSubject.value.isEnabled 
                        ? Infinity // File system has no fixed limit we enforce here
                        : this.MAX_STORAGE_MB * 1024 * 1024; // Local storage limit

     // Only enforce limits for localStorage or if a limit is somehow defined for FS
     if (!this.fileSystemStateSubject.value.isEnabled && totalLimit !== Infinity) {
        // Iterate through history from oldest to newest
        const sortedHistory = [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        for (const item of sortedHistory) {
          // If adding the new item exceeds the limit, mark this item for removal
          // and continue until enough space is freed.
          if (currentSize + newItemSize > totalLimit) {
            itemsToRemove.push(item);
            currentSize -= (item.audioSize || 0);
          } else {
            // Once we find an item that, if kept, would not exceed the limit with the new item,
            // we can stop, assuming older items have already been considered.
            break;
          }
        }
     }

     // Return items to remove (oldest first)
     return itemsToRemove;
   }

  // Get previous folder state from localStorage (Browser only)
  private getPreviousFolderState(): { selectedPath: string } | null {
    if (!this.isBrowser) return null; // Skip if not in browser
    try {
      const storedState = localStorage.getItem(this.FOLDER_STATE_KEY);
      if (storedState) {
        const state = JSON.parse(storedState);
        if (state && state.selectedPath) {
          return { selectedPath: state.selectedPath };
        }
      }
    } catch (error) {
    }
    return null;
  }

  // Clear previous folder state from localStorage (Browser only)
  private clearPreviousFolderState(): void {
    if (!this.isBrowser) return; // Skip if not in browser
    try {
      localStorage.removeItem(this.FOLDER_STATE_KEY);
    } catch (error) {
    }
  }

  // Save current folder state to localStorage (Browser only)
  private saveFolderState(): void {
    if (!this.isBrowser) return; // Skip if not in browser
    try {
      const state = this.fileSystemStateSubject.value;
      if (state.isEnabled && state.selectedPath) {
        localStorage.setItem(this.FOLDER_STATE_KEY, JSON.stringify({ selectedPath: state.selectedPath }));
      }
    } catch (error) {
    }
  }

   // Sanitize settings before saving (e.g., remove API keys)
   private sanitizeSettings(settings: TTSSettings): TTSSettings {
     // Return a new object to avoid modifying the original settings object
     const sanitized = { ...settings };
     // Remove API key before saving or storing in history
     if ('apiKey' in sanitized) {
       delete sanitized.apiKey;
     }
     return sanitized;
   }

  // Helper to create a new HistoryItem instance
  private createHistoryItem(text: string, settings: TTSSettings, result: TTSResult, metadata?: { title?: string; tags?: string[]; duration?: number }): HistoryItem {
    // Ensure a unique ID, use result queryId if available, otherwise generate
    const id = result.queryId?.getValue() || Date.now().toString();
    
    return {
      id,
      text,
      settings: this.sanitizeSettings(settings), // Sanitize settings before storing
      result: result, // Store the full result
      createdAt: new Date(),
      audioSize: result.audioData?.byteLength || 0,
      metadata: metadata,
    };
  }

  // Helper to map loaded settings to the correct type/structure
  private mapLoadedSettings(settings: any): TTSSettings {
     // Perform mapping and type assertions as needed based on your loaded data structure
     // This is a placeholder implementation, adjust based on your actual data.
     const mappedSettings: TTSSettings = {
       provider: settings.provider || '',
       model: settings.model || '',
       voice: settings.voice || '',
       apiKey: settings.apiKey ? ApiKey.fromString(settings.apiKey) : undefined, // Map apiKey if present
       // Map other settings properties as needed
     };
     return mappedSettings;
   }

   // --- Missing methods added back --- //

   private async loadStorageState(): Promise<void> {
     if (!this.isBrowser) return; // Ensure this only runs in the browser
     if (typeof localStorage === 'undefined') return;

     try {
       const stored = localStorage.getItem('tts-storage-state');
       if (stored) {
         const savedState = JSON.parse(stored);
         if (savedState.isEnabled && this.isFileSystemAccessSupported()) {
           const currentState = this.fileSystemStateSubject.value;
           this.fileSystemStateSubject.next({
             ...currentState,
             isEnabled: true,
             selectedPath: savedState.selectedPath
           });
         }
       }
     } catch (error) {
       console.error('Failed to load storage state:', error);
     }
   }

   private async saveStorageState(): Promise<void> {
     if (!this.isBrowser) return; // Ensure this only runs in the browser
     if (typeof localStorage === 'undefined') return;

     const state = this.getFileSystemState();
     const stateToSave = {
       isEnabled: state.isEnabled,
       selectedPath: state.selectedPath
     };

     localStorage.setItem('tts-storage-state', JSON.stringify(stateToSave));
   }

   private async clearStorageState(): Promise<void> {
     if (!this.isBrowser) return; // Ensure this only runs in the browser
     if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(this.FOLDER_STATE_KEY);
      }
   }

   private async deleteAudioFile(itemId: string): Promise<void> {
     if (!this.isBrowser) return; // Ensure this only runs in the browser

     const state = this.getFileSystemState();
     if (!state.isEnabled || !state.directoryHandle) return; // Only proceed if file system is enabled and handle exists

     try {
       const audioFileName = `${itemId}.mp3`;
       await (state.directoryHandle as any).removeEntry(audioFileName);
     } catch (error) {
       console.warn(`Failed to delete audio file for item ${itemId}:`, error);
     }
   }

   private async migrateFromLocalStorage(): Promise<void> {
     if (!this.isBrowser) return; // Ensure this only runs in the browser

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
           createdAt: string; // Store as string
           updatedAt: string; // Store as string
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
         createdAt: string; // Store as string
         audioSize: number;
         metadata?: { title?: string; tags?: string[]; duration?: number };
       }
       const history = (parsed as SerializedHistoryItem[]).map((item) => {
         // Create a new object explicitly listing all properties to avoid duplicates
         const historyItem: HistoryItem = {
           id: item.id,
           text: item.text,
           settings: this.mapLoadedSettings(item.settings), // Use mapped settings
           result: {
             queryId: QueryId.fromString(item.result.queryId),
             status: item.result.status as TTSResultStatus,
             audioData: item.result.audioData ? new Uint8Array(Object.values(item.result.audioData)) : undefined,
             createdAt: new Date(item.result.createdAt), // Convert string to Date
             updatedAt: new Date(item.result.updatedAt), // Convert string to Date
             duration: item.result.duration,
             fileSize: item.result.fileSize,
             error: item.result.error,
             processingTime: item.result.processingTime,
           },
           createdAt: new Date(item.createdAt), // Convert string to Date
           audioSize: item.audioSize,
           metadata: item.metadata,
         };
         return historyItem;
       });

       await this.saveToFileSystem(history);
       this.historySubject.next(history);

       // Clear localStorage after successful migration
       localStorage.removeItem(this.STORAGE_KEY);
     } catch (error) {
       console.error('Failed to migrate from localStorage:', error);
     }
   }

}

// Re-export types for convenience
// FileSystemStorageState and FolderReconnectionPrompt are already exported at the top.
export type { HistoryItem, StorageInfo, TTSResult };
