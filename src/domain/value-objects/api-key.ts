// Domain value object for API Keys
import { NonEmptyText } from '../../common/value-objects/text';

export class ApiKey extends NonEmptyText {
  private static readonly MIN_LENGTH = 10;

  private constructor(value: string) {
    super(value);
    this.validateApiKey(value);
  }

  private validateApiKey(value: string): void {
    if (value.length < ApiKey.MIN_LENGTH) {
      throw new Error('API key appears to be invalid (too short)');
    }
  }
  static override fromString(value: string): ApiKey {
    return new ApiKey(value.trim());
  }

  // Security method to mask the API key for display
  getMasked(): string {
    const value = this.getValue();
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    
    const visible = value.slice(0, 4);
    const masked = '*'.repeat(Math.max(0, value.length - 8));
    const ending = value.slice(-4);
    return `${visible}${masked}${ending}`;
  }

  // Check if API key format is valid for specific providers
  isValidForProvider(provider: string): boolean {
    const value = this.getValue();
    
    switch (provider.toLowerCase()) {
      case 'openai':
        return value.startsWith('sk-') && value.length >= 40;
      case 'elevenlabs':
        return value.length >= 32; // ElevenLabs API keys are typically 32+ chars
      case 'azure':
        return value.length >= 32;
      case 'google':
        return value.length >= 20;
      case 'aws':
        return value.length >= 16;
      default:
        return value.length >= ApiKey.MIN_LENGTH;
    }
  }

  // Get the type of API key based on format
  getProviderType(): string | null {
    const value = this.getValue();
    
    if (value.startsWith('sk-')) return 'openai';
    if (value.length === 32 && /^[a-f0-9]{32}$/.test(value)) return 'elevenlabs';
    
    return null; // Unknown format
  }
}
