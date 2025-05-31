import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AngularTTSService } from '../../integration/angular-tts.service';
import { IntegratedHistoryStorageService, HistoryItem } from '../../integration/history-storage.service';
import { HistoryPanelComponent } from '../history-panel/history-panel.component';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';
import { EditorComponent } from '../editor/editor.component';
import { AudioPlayerComponent } from '../audio-player/audio-player.component';
import { SettingsService } from '../shared/settings.service';
import { TruncateTextPipe } from '../../app/pipes/truncate-text.pipe';
import { FormatDatePipe } from '../../app/pipes/format-date.pipe';
import { FormatFileSizePipe } from '../../app/pipes/format-file-size.pipe';
import { 
  TTSSettings, 
  Voice, 
  ApiKey, 
  TTSResult
} from '../../integration/domain-types';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HistoryPanelComponent, SettingsPanelComponent, EditorComponent, AudioPlayerComponent, TruncateTextPipe, FormatDatePipe, FormatFileSizePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  // Inject services using modern Angular patterns
  private ttsService = inject(AngularTTSService);
  private historyService = inject(IntegratedHistoryStorageService);
  private settingsService = inject(SettingsService);
  // Application state using Angular signals
  inputText = signal('');
  isProcessing = signal(false);  currentResult = signal<TTSResult | null>(null);  currentQueryInfo = signal<{
    text: string;
    title?: string;
    settings?: {
      provider: string;
      model: string;
      voice: string;
    };
    estimatedDuration?: number; // in seconds
    createdAt: Date;
  } | null>(null);
  errorMessage = signal('');
  
  // Storage warning state
  private storageWarningState = signal<{
    level: 'warning' | 'critical';
    message: string;
    itemsToRemove?: HistoryItem[];
  } | null>(null);
  
  // UI state
  showRemovalPreview = false;

  // Computed properties
  canGenerate = computed(() => {
    return this.inputText().trim().length > 0 &&
           this.settingsService.apiKey().trim().length > 0 && 
           !this.isProcessing();
  });

  storageWarning = computed(() => this.storageWarningState());

  constructor() {
    this.loadSavedSettings();
  }

  // Text editor event handlers
  onTextChange(text: string) {
    this.inputText.set(text);
  }

  // Generation workflow
  async generateSpeech() {
    if (!this.canGenerate()) return;

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
        apiKey: new ApiKey(this.settingsService.apiKey())
      };

      // Save settings for next time
      await this.ttsService.saveSettings(settings);

      // Capture title before it might get cleared
      const currentTitle = this.settingsService.historyTitle() || undefined;
      
      // Generate speech
      const result = await this.ttsService.generateSpeech(this.inputText(), settings);
      
      if (result) {
        // Save to history first if enabled
        if (this.settingsService.saveToHistory()) {
          const historyResult = await this.historyService.addToHistory(
            this.inputText(),
            settings,
            result,
            {
              title: currentTitle,
            }
          );
          
          if (historyResult.warnings && historyResult.warnings.length > 0) {
            console.warn('History warnings:', historyResult.warnings);
          }
          
          // Clear the title after saving
          this.settingsService.historyTitle.set('');
        }        // Set audio player data consistently (same as when selecting from history)
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
          estimatedDuration: undefined
        });
        
        this.storageWarningState.set(null);
      } else {
        this.errorMessage.set('Failed to generate speech');
      }

    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      this.isProcessing.set(false);
    }
  }
  // Result management
  clearResult() {
    this.currentResult.set(null);
    this.currentQueryInfo.set(null);
    this.errorMessage.set('');
  }  // History integration
  onHistoryItemSelected(item: HistoryItem): void {
    this.inputText.set(item.text);
    this.settingsService.selectedProvider.set(item.settings.provider);
    this.settingsService.selectedModel.set(item.settings.model);
    this.settingsService.selectedVoice.set(item.settings.voice as Voice);
    if (item.settings.apiKey) {
      this.settingsService.apiKey.set(item.settings.apiKey.getValue());
    }
    
    // Set the current result and ensure fileSize is populated from history
    const result = item.result;
    if (result && !result.fileSize && item.audioSize) {
      // Create a copy of the result with the fileSize from history
      this.currentResult.set({
        ...result,
        fileSize: item.audioSize
      });
    } else {
      this.currentResult.set(result);
    }
    
    // Set current query info for the audio player with consistent structure
    this.currentQueryInfo.set({
      text: item.text,
      title: item.metadata?.title,
      createdAt: item.createdAt,
      settings: {
        provider: item.settings.provider,
        model: item.settings.model,
        voice: item.settings.voice
      },
      estimatedDuration: item.metadata?.duration
    });
    
    if (item.metadata?.title) {
      this.settingsService.historyTitle.set(item.metadata.title);
    } else {
      this.settingsService.historyTitle.set('');
    }
  }

  // Settings management
  private async loadSavedSettings() {
    try {
      const result = await this.ttsService.loadSettings();
      if (result.isSuccess()) {
        const settings = result.getValue();
        if (settings) {
          this.settingsService.selectedProvider.set(settings.provider);
          this.settingsService.selectedModel.set(settings.model);
          this.settingsService.selectedVoice.set(settings.voice as Voice);
          if (settings.apiKey) {
            this.settingsService.apiKey.set(settings.apiKey.getValue());
          }
        }
      }
    } catch (error) {
      console.error('Failed to load saved settings:', error);
    }
  }
}
