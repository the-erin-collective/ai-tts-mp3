import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularTTSService } from '../../integration/angular-tts.service';
import { SettingsService } from '../shared/settings.service';
import { TTSResult, TTSResultStatus, TTSSettings, ApiKey } from '../../integration/domain-types';


@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss'
})
export class EditorComponent {  // Inject services
  private ttsService = inject(AngularTTSService);
  public settingsService = inject(SettingsService);

  // Input/Output properties
  inputText = input.required<string>();
  currentResult = input<TTSResult | null>(null);
  isProcessing = input.required<boolean>();
  errorMessage = input<string>('');
  // Output events
  textChanged = output<string>();
  generateSpeech = output<void>();
  clearResult = output<void>();

  // Computed properties
  canGenerate = computed(() => {
    const isProcessing = this.isProcessing();
    const inputTextLength = this.inputText().trim().length;
    const apiKeyLength = this.settingsService.apiKey().trim().length;
    const result = inputTextLength > 0 &&
           apiKeyLength > 0 && 
           !isProcessing;
           
    return result;
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
    if (!text.trim()) return '~$0.00000 est.';
    const characterCount = text.length;
    const provider = this.settingsService.selectedProvider();
    
    // Create a settings object for cost estimation
    const settings: TTSSettings = {
      provider: provider,
      model: this.settingsService.selectedModel(),
      voice: this.settingsService.selectedVoice(),
      apiKey: this.settingsService.apiKey() ? ApiKey.fromString(this.settingsService.apiKey()) : undefined
    };
    
    const cost = this.ttsService.estimateCost(characterCount, settings);
    // Always show 5 decimal places, no duplicate $
    return `~$${Number(cost).toFixed(5)} est.`;
  });

  // Editor functionality methods
  onTextChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.textChanged.emit(target.value);
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
  // Event handlers for buttons
  onGenerateSpeech() {
    this.generateSpeech.emit();
  }

  onClearResult() {
    this.clearResult.emit();
  }

  // Handle title input change
  onTitleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.settingsService.historyTitle.set(target.value);
  }

  // Handle save to history toggle change
  onSaveToHistoryChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.settingsService.saveToHistory.set(target.checked);
  }
}
