import { Component, signal, computed, inject, ViewChild, PLATFORM_ID, OnInit, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AngularTTSService } from '../../integration/angular-tts.service';
import { IntegratedHistoryStorageService } from '../../integration/history-storage.service';
import { HistoryPanelComponent } from '../history-panel/history-panel.component';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';
import { EditorComponent } from '../editor/editor.component';
import { AudioPlayerComponent } from '../audio-player/audio-player.component';
import { SettingsService } from '../shared/settings.service';
import { TruncateTextPipe } from '../shared/pipes/truncate-text.pipe';
import { FormatDatePipe } from '../shared/pipes/format-date.pipe';
import { FormatFileSizePipe } from '../shared/pipes/format-file-size.pipe';
import { HttpClientModule } from '@angular/common/http';
import { 
  TTSSettings, 
  Voice, 
  ApiKey, 
  TTSResult
} from '../../integration/domain-types';
import { HistoryItem as IntegratedHistoryItem } from '../../integration/history-storage.service';
import { PlaybackService } from '../../infrastructure/audio/playback.service';
import { TTSQuery, TTSResultStatus } from '../../domain/tts.entity';
import { QueryId } from '../../domain/value-objects/query-id';
import { HistoryItem } from '../../infrastructure/history-storage.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HistoryPanelComponent, SettingsPanelComponent, EditorComponent, AudioPlayerComponent, TruncateTextPipe, FormatDatePipe, FormatFileSizePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit {
  @ViewChild(HistoryPanelComponent) private historyPanel?: HistoryPanelComponent;

  // Inject services using modern Angular patterns
  private ttsService = inject(AngularTTSService);
  private historyService = inject(IntegratedHistoryStorageService);
  private settingsService = inject(SettingsService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private playbackService = inject(PlaybackService);
  
  // Application state using Angular signals
  inputText = signal('');
  isProcessing = signal(false); 
  currentResult = signal<TTSResult | null>(null); 
  currentQueryInfo = signal<{
    text: string;
    title?: string;
    settings?: {
      provider: string;
      model: string;
      voice: string;
    };
    estimatedDuration?: number; // in seconds
    createdAt: Date;
    id?: string;
    audioSize?: number;
  } | null>(null);
  errorMessage = signal('');
  
  // Temporary storage for history item when saving is off
  private tempHistoryItem = signal<HistoryItem | null>(null);
  
  // Storage warning state
  private storageWarningState = signal<{
    level: 'warning' | 'critical';
    message: string;
    itemsToRemove?: IntegratedHistoryItem[];
  } | null>(null);
  
  // UI state
  showRemovalPreview = false;

  // Computed properties
  canGenerate = computed(() => {
    return this.inputText().trim().length > 0 &&
           this.settingsService.apiKey().trim().length > 0 && 
           !this.isProcessing() &&
           this.isBrowser;
  });

  storageWarning = computed(() => this.storageWarningState());

  constructor(private elementRef: ElementRef) {
    // Initialization logic that is safe for both browser and SSR
  }

  ngOnInit() {
    // Code that should only run in the browser after the view is initialized
    if (this.isBrowser) {
      this.loadSavedSettings();
    }
  }

  ngAfterViewInit() {
    // Code that should only run in the browser after the view is initialized
    if (this.isBrowser) {
      this.loadSavedSettings();
    }
  }

  // Text editor event handlers
  onTextChange(text: string) {
    this.inputText.set(text);
  }

  // Generation workflow
  async generateSpeech() {
    if (!this.canGenerate()) {
      return;
    }

    try {
      this.isProcessing.set(true);
      this.errorMessage.set('');
      this.storageWarningState.set(null);
      this.currentResult.set(null);

      // Check storage before generation if saving to history
      if (this.settingsService.saveToHistory()) {
        const text = this.inputText();
        const estimatedSize = text.length * 100; // Rough estimate: 100 bytes per character
        const itemsToRemove = this.historyService.getItemsToBeRemoved(estimatedSize);
        
        if (itemsToRemove.length > 0) {
          const storageInfo = this.historyService.getStorageInfo();
          const level = storageInfo.usedPercentage > 0.9 ? 'critical' : 'warning';
          const message = `Storage ${Math.round(storageInfo.usedPercentage * 100)}% full. ${itemsToRemove.length} item(s) will be removed.`;
          
          this.storageWarningState.set({
            level,
            message,
            itemsToRemove
          });
          
          this.isProcessing.set(false);
          return;
        }
      }

      await this.proceedWithGeneration();

    } catch (error) {
      console.error('[TTS] Error in generateSpeech:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Unknown error occurred');
      this.isProcessing.set(false);
    }
  }

  // Storage warning methods
  dismissStorageWarning(): void {
    this.storageWarningState.set(null);
  }

  cancelGeneration(): void {
    this.showRemovalPreview = false;
    this.storageWarningState.set(null);
    this.isProcessing.set(false);
  }
  // Make proceedWithGeneration public
  async proceedWithGeneration(): Promise<void> {
    try {
      this.showRemovalPreview = false;
      
      const settings: TTSSettings = {
        provider: this.settingsService.selectedProvider(),
        model: this.settingsService.selectedModel(),
        voice: this.settingsService.selectedVoice(),
        apiKey: ApiKey.fromString(this.settingsService.apiKey())
      };

      // Save settings for next time
      await this.ttsService.saveSettings(settings);

      // Capture title before it might get cleared
      const currentTitle = this.settingsService.historyTitle() || undefined;
      
      // Generate speech
      const result = await this.ttsService.generateSpeech(this.inputText(), settings);
      if (result) {
        // Set audio player data immediately with the generated result
        this.currentResult.set(result);

        this.currentQueryInfo.set({
          text: this.inputText(),
          title: currentTitle,
          createdAt: result.createdAt,
          settings: {
            provider: settings.provider,
            model: settings.model,
            voice: settings.voice
          },
          estimatedDuration: undefined // Duration will be set after loading
        });

        // Load audio in the player to get duration and make it ready for playback
        await this.playbackService.loadAudio(result, result.queryId?.getValue());

        // Update currentResult and currentQueryInfo with the actual duration
        const actualDuration = this.playbackService.totalDuration();

        this.currentResult.update(res => {
          if (!res) return null;
          const updatedResult = { ...res, duration: actualDuration };
          return updatedResult;
        });

        this.currentQueryInfo.update(info => {
          if (!info) return null;
          const updatedInfo = { ...info, estimatedDuration: actualDuration };
          return updatedInfo;
        });

        // Update currentQueryInfo with the estimated duration obtained from PlaybackService
        this.currentQueryInfo.update(info => ({
          ...info!,
          estimatedDuration: actualDuration
        }));

        // Update the result with the actual duration and file size
        const updatedResult: TTSResult = {
          ...result,
          duration: actualDuration,
          fileSize: result.audioData?.byteLength || 0 // Use actual byteLength for fileSize
        };

        // Create the HistoryItem object to save or use temporarily
        const historyItemToProcess: HistoryItem = {
          id: updatedResult.queryId?.getValue(), // Use the updated result's queryId for consistency
          text: this.inputText(),
          settings: {
            provider: settings.provider,
            model: this.settingsService.selectedModel(), // Corrected: Use settingsService
            voice: this.settingsService.selectedVoice(), // Corrected: Use settingsService
            // ApiKey should not be saved or included in history item
          },
          result: updatedResult, // Use the updated result with duration and file size
          createdAt: new Date(), // Use current date for history item creation
          audioSize: updatedResult.fileSize || 0, // Use file size from updatedResult
          metadata: this.currentQueryInfo()?.title ? { title: this.currentQueryInfo()?.title } : undefined,
        };

        // Add the item to history if saving is enabled
        // Note: The historyService will emit the updated history array
        // which the HistoryPanelComponent subscribes to.
        if (this.settingsService.saveToHistory()) {
          // Use the updatedResult which now includes duration and fileSize
          const historyResult = await this.historyService.addToHistory(
            historyItemToProcess.text,
            historyItemToProcess.settings!,
            historyItemToProcess.result,
            {
              title: historyItemToProcess.metadata?.title,
            }
          );

          if (historyResult.warnings && historyResult.warnings.length > 0) {
            console.warn('History warnings:', historyResult.warnings);
          }

          // Clear the title after saving
          this.settingsService.historyTitle.set('');

          // Programmatically select the newly added item in the history panel
          if (this.historyPanel) {
            // Removed programmatic selection here as it is now handled in HistoryPanelComponent
          }
        } else { // Saving to history is off
           // If saving is off, just store the generated item temporarily
           this.tempHistoryItem.set(historyItemToProcess);
           // Clear any existing selection in the history panel since we're not saving to history
           if (this.historyPanel) {
             this.historyPanel.clearSelection();
           }
           // Manually trigger onHistoryItemSelected with the temporary item
           this.onHistoryItemSelected(this.tempHistoryItem());
        }

        this.storageWarningState.set(null);

        // Re-enable the generate button and clear processing state here,
        // as all asynchronous operations are complete and successful or failed.
        this.isProcessing.set(false);

      } else { // Handle case where generateSpeech returned falsy result
        this.errorMessage.set('Failed to generate speech');
        // Re-enable the generate button and clear processing state here,
        // as all asynchronous operations are complete and successful or failed.
        this.isProcessing.set(false);
      }
    } catch (error) {
      console.error('[TTS] Error in proceedWithGeneration:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Unknown error occurred');
      // Ensure button is re-enabled even on error
      this.isProcessing.set(false);
    }
  }

  // Handle history item selection
  async onHistoryItemSelected(item: HistoryItem | null): Promise<void> {
    if (item) {
      // Update editor text with the selected item's text
      this.inputText.set(item.text);

      // Update the current result and query info based on the selected history item
      this.currentResult.set(item.result);
      // Ensure id and audioSize are included when setting currentQueryInfo from a history item
      this.currentQueryInfo.set(item.metadata ? { ...item.metadata, text: item.text, createdAt: item.createdAt, id: item.id, audioSize: item.audioSize } : { text: item.text, createdAt: item.createdAt, id: item.id, audioSize: item.audioSize });

      // Load audio into the player. Do NOT automatically play when selecting.
      if (item.result) {
        await this.playbackService.loadAudio(item.result, item.id);
      }
    } else {
      // Handle deselection if necessary (e.g., clear audio player)
      this.currentResult.set(null);
      this.currentQueryInfo.set(null);
      this.playbackService.stop(true); // Stop playback and clear loaded audio on deselection
    }
  }

  clearResult() {
    this.currentResult.set(null);
    this.currentQueryInfo.set(null);
    this.errorMessage.set('');
  }

  // Add new method to handle playItem event from HistoryPanelComponent
  async onHistoryPanelPlayItem(item: HistoryItem): Promise<void> {
    // Select the item (loads audio without playing) and update HomeComponent\'s state
    await this.onHistoryItemSelected(item);

    // Explicitly select the item in the HistoryPanelComponent as well
    if (this.historyPanel) {
      // Removed redundant historyPanel.selectItem call
    }

    // Then explicitly play the loaded audio
    this.playbackService.play();
  }

  private async loadSavedSettings() {
    if (!this.isBrowser) return;
    try {
      const result = await this.ttsService.loadSettings();
      if (result) {
        const settings = result.settings;
        this.settingsService.selectedProvider.set(settings.provider);
        this.settingsService.selectedModel.set(settings.model);
        this.settingsService.selectedVoice.set(settings.voice as Voice);
        if (settings.apiKey) {
          this.settingsService.apiKey.set(settings.apiKey.getValue());
        }
      }
    } catch (error) {
      console.error('Failed to load saved settings:', error);
    }
  }
}
