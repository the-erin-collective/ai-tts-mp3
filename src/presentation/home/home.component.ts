import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularTTSService } from '../../integration/angular-tts.service';
import { 
  TTSSettings, 
  ModelProvider, 
  Voice, 
  ApiKey, 
  TTSResult, 
  TTSResultStatus 
} from '../../domain/tts.entity';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  constructor(private ttsService: AngularTTSService) {
    this.loadSavedSettings();
  }

  async generateSpeech() {
    if (!this.canGenerate()) return;

    try {
      this.isProcessing.set(true);
      this.errorMessage.set('');

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
      } else {
        this.errorMessage.set('Failed to generate speech');
      }

    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
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
}
