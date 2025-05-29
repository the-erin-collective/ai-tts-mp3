// History Storage Service - Manages TTS history in localStorage with capacity monitoring
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TTSResult, TTSSettings } from '../domain/tts.entity';

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
export class HistoryStorageService {  private readonly STORAGE_KEY = 'tts-history';
  private readonly STORAGE_INFO_KEY = 'tts-storage-info';
  private readonly MAX_STORAGE_MB = 20; // 20MB limit for TTS history (localStorage is domain-shared)
  private readonly WARNING_THRESHOLD = 0.8; // 80%
  private readonly CRITICAL_THRESHOLD = 0.9; // 90%

  private historySubject = new BehaviorSubject<HistoryItem[]>([]);
  private storageInfoSubject = new BehaviorSubject<StorageInfo>(this.calculateStorageInfo());

  constructor() {
    this.loadHistory();
  }

  // Observables for reactive updates
  get history$(): Observable<HistoryItem[]> {
    return this.historySubject.asObservable();
  }

  get storageInfo$(): Observable<StorageInfo> {
    return this.storageInfoSubject.asObservable();
  }

  // Get current history items
  getHistory(): HistoryItem[] {
    return this.historySubject.value;
  }

  // Get current storage info
  getStorageInfo(): StorageInfo {
    return this.storageInfoSubject.value;
  }

  // Add new item to history
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
    const item: HistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      text,
      settings,
      result,
      createdAt: new Date(),
      audioSize,
      metadata
    };

    const currentHistory = this.getHistory();
    const storageInfo = this.calculateStorageInfo();
    const newItemSizeMB = audioSize / (1024 * 1024);
    
    const warnings: string[] = [];
    const removedItems: HistoryItem[] = [];

    // Check if single item is too large
    if (newItemSizeMB > this.MAX_STORAGE_MB) {
      warnings.push(`Item too large (${newItemSizeMB.toFixed(1)}MB). Maximum allowed is ${this.MAX_STORAGE_MB}MB.`);
      return { success: false, warnings };
    }

    // Calculate what would happen if we add this item
    const projectedUsage = storageInfo.used + audioSize;
    const projectedPercentage = projectedUsage / (this.MAX_STORAGE_MB * 1024 * 1024);

    // If adding this item would exceed capacity, remove oldest items
    let workingHistory = [...currentHistory];
    let currentUsage = storageInfo.used;

    while (currentUsage + audioSize > this.MAX_STORAGE_MB * 1024 * 1024 && workingHistory.length > 0) {
      const removed = workingHistory.shift()!;
      removedItems.push(removed);
      currentUsage -= removed.audioSize;
    }

    // Add warnings based on projected usage
    if (projectedPercentage > this.CRITICAL_THRESHOLD) {
      warnings.push(`Storage critically full (${(projectedPercentage * 100).toFixed(1)}%). Consider removing old items.`);
    } else if (projectedPercentage > this.WARNING_THRESHOLD) {
      warnings.push(`Storage ${(projectedPercentage * 100).toFixed(1)}% full. Approaching limit.`);
    }

    if (removedItems.length > 0) {
      warnings.push(`Removed ${removedItems.length} old item(s) to make space.`);
    }

    // Add new item to the beginning (most recent first)
    const newHistory = [item, ...workingHistory];
    
    // Save to localStorage
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
      return { success: false, warnings: ['Failed to save to localStorage'] };
    }
  }

  // Remove specific item from history
  async removeFromHistory(itemId: string): Promise<boolean> {
    const currentHistory = this.getHistory();
    const newHistory = currentHistory.filter(item => item.id !== itemId);
    
    try {
      await this.saveHistory(newHistory);
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
      if (!this.isLocalStorageAvailable()) {
        this.historySubject.next([]);
        this.updateStorageInfo();
        return true;
      }
      
      localStorage.removeItem(this.STORAGE_KEY);
      this.historySubject.next([]);
      this.updateStorageInfo();
      return true;
    } catch (error) {
      console.error('Failed to clear history:', error);
      return false;
    }
  }

  // Get items that would be removed if we add a new item of given size
  getItemsToBeRemoved(newItemSize: number): HistoryItem[] {
    const currentHistory = this.getHistory();
    const storageInfo = this.getStorageInfo();
    const maxBytes = this.MAX_STORAGE_MB * 1024 * 1024;
    
    if (storageInfo.used + newItemSize <= maxBytes) {
      return [];
    }

    const toRemove: HistoryItem[] = [];
    let totalSizeToRemove = (storageInfo.used + newItemSize) - maxBytes;
    
    // Start from oldest items (end of array)
    for (let i = currentHistory.length - 1; i >= 0 && totalSizeToRemove > 0; i--) {
      toRemove.unshift(currentHistory[i]);
      totalSizeToRemove -= currentHistory[i].audioSize;
    }
    
    return toRemove;
  }

  // Check if storage is getting full
  isStorageNearFull(): boolean {
    return this.getStorageInfo().usedPercentage > this.WARNING_THRESHOLD;
  }

  isStorageCritical(): boolean {
    return this.getStorageInfo().usedPercentage > this.CRITICAL_THRESHOLD;
  }
  // Private methods
  private isLocalStorageAvailable(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch {
      return false;
    }
  }

  private loadHistory(): void {
    try {
      if (!this.isLocalStorageAvailable()) {
        console.log('localStorage not available (likely SSR), using empty history');
        return;
      }
      
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        const history = parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          result: {
            ...item.result,
            createdAt: new Date(item.result.createdAt),
            updatedAt: new Date(item.result.updatedAt),
            // Convert audioData back to Uint8Array
            audioData: item.result.audioData ? new Uint8Array(Object.values(item.result.audioData)) : undefined
          }
        }));
        this.historySubject.next(history);
      }
    } catch (error) {
      console.error('Failed to load history from localStorage:', error);
      this.historySubject.next([]);
    }
  }
  private async saveHistory(history: HistoryItem[]): Promise<void> {
    try {
      if (!this.isLocalStorageAvailable()) {
        console.log('localStorage not available, skipping save');
        return;
      }
      
      const serializable = history.map(item => ({
        ...item,
        result: {
          ...item.result,
          // Convert Uint8Array to regular array for JSON serialization
          audioData: item.result.audioData ? Array.from(item.result.audioData) : undefined
        }
      }));
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializable));
    } catch (error) {
      // Handle localStorage quota exceeded
      if (error instanceof DOMException && error.code === 22) {
        throw new Error('Storage quota exceeded');
      }
      throw error;
    }
  }

  private calculateStorageInfo(): StorageInfo {
    const history = this.historySubject.value;
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

  private updateStorageInfo(): void {
    this.storageInfoSubject.next(this.calculateStorageInfo());
  }
}
