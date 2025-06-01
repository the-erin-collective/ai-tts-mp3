// Infrastructure provider factory for TTS services
import { ModelProvider } from '../../domain/tts.entity';
import { TTSProviderService } from '../../domain/tts-provider.interface';
import { OpenAITTSProviderService } from './openai/openai-tts-provider.service';

export class TTSProviderFactory {
  private static providers = new Map<ModelProvider, TTSProviderService>();

  static getProvider(provider: ModelProvider): TTSProviderService {
    // Check if provider is already instantiated
    if (this.providers.has(provider)) {
      return this.providers.get(provider)!;
    }

    // Create new provider instance based on type
    let providerInstance: TTSProviderService;

    switch (provider) {
      case ModelProvider.OPENAI:
        providerInstance = new OpenAITTSProviderService();
        break;
      
      case ModelProvider.ELEVENLABS:
        // TODO: Implement ElevenLabs provider
        throw new Error('ElevenLabs provider not yet implemented');
      
      case ModelProvider.AZURE:
        // TODO: Implement Azure provider
        throw new Error('Azure provider not yet implemented');
      
      case ModelProvider.GOOGLE:
        // TODO: Implement Google provider
        throw new Error('Google provider not yet implemented');
      
      case ModelProvider.AWS:
        // TODO: Implement AWS provider
        throw new Error('AWS provider not yet implemented');
      
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Cache the provider instance
    this.providers.set(provider, providerInstance);
    return providerInstance;
  }

  static getSupportedProviders(): ModelProvider[] {
    return [
      ModelProvider.OPENAI,
      // TODO: Add other providers as they're implemented
      // ModelProvider.ELEVENLABS,
      // ModelProvider.AZURE,
      // ModelProvider.GOOGLE,
      // ModelProvider.AWS,
    ];
  }

  static isProviderSupported(provider: ModelProvider): boolean {
    return this.getSupportedProviders().includes(provider);
  }

  static clearCache(): void {
    this.providers.clear();
  }
}
