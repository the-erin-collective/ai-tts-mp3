import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularTTSService } from '../../integration/angular-tts.service';
import { HistoryStorageService, HistoryItem } from '../../infrastructure/history-storage.service';
import { HistoryPanelComponent } from '../history-panel/history-panel.component';
import { OpenAITTSService } from '../../infrastructure/openai-tts.service';
import { TablerIconComponent } from '../shared/tabler-icon.component';
import { 
  TTSSettings, 
  ModelProvider, 
  Voice, 
  ApiKey, 
  TTSResult, 
  TTSResultStatus,
  QueryText
} from '../../domain/tts.entity';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, HistoryPanelComponent, TablerIconComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  // TTS Application state using Angular 20 signals
  title = signal('AI TTS MP3 App');
  inputText = signal('');
  isProcessing = signal(false);
  currentResult = signal<TTSResult | null>(null);
  errorMessage = signal('');
    // Settings state
  selectedProvider = signal<ModelProvider>(ModelProvider.OPENAI);
  selectedModel = signal('tts-1');
  selectedVoice = signal<Voice>(Voice.ALLOY);
  apiKey = signal('');
  
  // History state
  showHistoryPanel = signal(true); // Open by default
  saveToHistory = signal(true);
  historyTitle = signal('');
  showRemovalPreview = false;
  
  // Storage warning state
  private storageWarningState = signal<{
    level: 'warning' | 'critical';
    message: string;
    itemsToRemove?: HistoryItem[];
  } | null>(null);

  // Computed properties
  canGenerate = computed(() => {
    return this.inputText().trim().length > 0 && 
           this.apiKey().trim().length > 0 && 
           !this.isProcessing();
  });

  statusMessage = computed(() => {
    const result = this.currentResult();
    if (!result) return '';
    
    switch (result.status) {
      case TTSResultStatus.PENDING:
        return 'Request queued...';
      case TTSResultStatus.PROCESSING:
        return 'Generating speech...';
      case TTSResultStatus.COMPLETED:
        return 'Speech generated successfully!';
      case TTSResultStatus.FAILED:
        return `Error: ${result.error?.message || 'Unknown error'}`;
      case TTSResultStatus.CANCELLED:
        return 'Request cancelled';
      default:
        return '';
    }
  });

  storageWarning = computed(() => this.storageWarningState());
  // Token counting and cost estimation
  tokenCount = computed(() => {
    const text = this.inputText();
    if (!text.trim()) return 0;
    // For TTS, we approximate tokens as character count / 4 (rough estimate)
    // but for display purposes, we'll use word count as it's more meaningful
    return text.trim().split(/\s+/).length;
  });

  estimatedCost = computed(() => {
    const text = this.inputText();
    if (!text.trim()) return '0.0000';
    
    const characterCount = text.length;
    const selectedModel = this.selectedModel();
    const provider = this.selectedProvider();
    
    // Use OpenAI pricing for accurate cost estimation
    if (provider === ModelProvider.OPENAI) {
      const cost = this.openaiService.estimateCost(characterCount, selectedModel);
      return cost.toFixed(4);
    }
    
    // Fallback estimation for other providers
    return (characterCount * 0.000015).toFixed(4);
  });

  // Available options for dropdowns
  providers = Object.values(ModelProvider);
  voices = Object.values(Voice);
  
  models = computed(() => {
    switch (this.selectedProvider()) {
      case ModelProvider.OPENAI:
        return ['tts-1', 'tts-1-hd'];
      case ModelProvider.ELEVENLABS:
        return ['eleven_multilingual_v2', 'eleven_turbo_v2_5'];
      default:
        return ['default'];
    }
  });
  constructor(
    private ttsService: AngularTTSService,
    private historyService: HistoryStorageService,
    private openaiService: OpenAITTSService
  ) {
    this.loadSavedSettings();
  }async generateSpeech() {
    if (!this.canGenerate()) return;

    try {
      this.isProcessing.set(true);
      this.errorMessage.set('');
      this.storageWarningState.set(null);
      // Auto-clear previous results when starting new generation
      this.currentResult.set(null);

      const settings: TTSSettings = {
        provider: this.selectedProvider(),
        model: this.selectedModel(),
        voice: this.selectedVoice(),
        apiKey: new ApiKey(this.apiKey())
      };

      // Check storage before generation if saving to history
      if (this.saveToHistory()) {
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
          
          // Don't proceed automatically, let user decide
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

  async playAudio() {
    const result = this.currentResult();
    if (!result) return;

    try {
      const audio = await this.ttsService.playAudio(result);
      if (audio) {
        await audio.play();
      }
    } catch (error) {
      this.errorMessage.set('Failed to play audio');
    }
  }

  async downloadAudio() {
    const result = this.currentResult();
    if (!result) return;

    try {
      const audioUrl = await this.ttsService.downloadAudio(result);
      if (audioUrl) {
        const link = document.createElement('a');
        link.href = audioUrl;
        link.download = `tts-audio-${Date.now()}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      this.errorMessage.set('Failed to download audio');
    }
  }

  clearResult() {
    this.currentResult.set(null);
    this.errorMessage.set('');
  }

  onProviderChange() {
    // Reset model when provider changes
    const models = this.models();
    if (models.length > 0) {
      this.selectedModel.set(models[0]);
    }
  }
  // Editor functionality methods
  onTextChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.inputText.set(target.value);
  }

  getLineCount(): number {
    const text = this.inputText();
    if (!text) return 1;
    return text.split('\n').length;
  }

  getCharCount(): number {
    return this.inputText().length;
  }

  getLineNumbers(): number[] {
    const lineCount = this.getLineCount();
    return Array.from({ length: lineCount }, (_, i) => i + 1);
  }
    private async loadSavedSettings() {
    try {
      const result = await this.ttsService.loadSettings();
      if (result.isSuccess()) {
        const settings = result.getValue();
        if (settings) {
          this.selectedProvider.set(settings.provider);
          this.selectedModel.set(settings.model);
          this.selectedVoice.set(settings.voice as Voice);
          this.apiKey.set(settings.apiKey.getValue());
        }
      }
    } catch (error) {
      console.error('Failed to load saved settings:', error);
    }
  }

  // History panel methods removed - panel is always open

  onHistoryItemSelected(item: HistoryItem): void {
    // Load the selected history item into the current form
    this.inputText.set(item.text);
    this.selectedProvider.set(item.settings.provider);
    this.selectedModel.set(item.settings.model);
    this.selectedVoice.set(item.settings.voice as Voice);
    this.apiKey.set(item.settings.apiKey.getValue());
    this.currentResult.set(item.result);
    
    if (item.metadata?.title) {
      this.historyTitle.set(item.metadata.title);
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

  async proceedWithGeneration(): Promise<void> {
    try {
      this.showRemovalPreview = false;
      
      const settings: TTSSettings = {
        provider: this.selectedProvider(),
        model: this.selectedModel(),
        voice: this.selectedVoice(),
        apiKey: new ApiKey(this.apiKey())
      };

      // Save settings for next time
      await this.ttsService.saveSettings(settings);

      // Generate speech
      const result = await this.ttsService.generateSpeech(this.inputText(), settings);
      
      if (result) {
        this.currentResult.set(result);
        
        // Save to history if enabled
        if (this.saveToHistory()) {
          const historyResult = await this.historyService.addToHistory(
            this.inputText(),
            settings,
            result,
            {
              title: this.historyTitle() || undefined,
              duration: this.estimateDuration(this.inputText())
            }
          );
          
          if (historyResult.warnings && historyResult.warnings.length > 0) {
            console.warn('History warnings:', historyResult.warnings);
          }
          
          // Clear the title after saving
          this.historyTitle.set('');
        }
        
        // Clear storage warning after successful save
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

  // Utility methods
  formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  private estimateDuration(text: string): number {
    // Rough estimation: average speaking rate is about 150-200 words per minute
    const words = text.trim().split(/\s+/).length;
    const wordsPerMinute = 175; // Average speaking rate
    return Math.ceil((words / wordsPerMinute) * 60); // Duration in seconds
  }
}
