// Domain value object for TTS Query Text
import { BoundedText } from '../../common/value-objects/text';
import { StringUtil } from '../../common/utils';

export class QueryText extends BoundedText {
  // TTS-specific text length limits
  private static readonly MIN_LENGTH = 1;
  private static readonly MAX_LENGTH = 10000; // Generous max limit for TTS

  private constructor(value: string) {
    super(value, QueryText.MIN_LENGTH, QueryText.MAX_LENGTH);
  }
  static override fromString(value: string): QueryText {
    return new QueryText(value.trim());
  }

  // TTS-specific methods
  getWordCount(): number {
    return StringUtil.countWords(this.getValue());
  }

  getCharacterCount(): number {
    return this.getValue().length;
  }

  truncate(maxLength: number): string {
    return StringUtil.truncate(this.getValue(), maxLength);
  }

  // Estimate speech duration (rough calculation)
  getEstimatedDuration(): number {
    const words = this.getWordCount();
    const wordsPerMinute = 175; // Average speaking rate
    return Math.ceil((words / wordsPerMinute) * 60); // Duration in seconds
  }

  // Check if text is suitable for TTS processing
  isSuitableForTTS(): boolean {
    const text = this.getValue().trim();
    
    // Basic checks for TTS suitability
    if (text.length === 0) return false;
    if (text.length < 2) return false; // Too short
    
    // Check for excessive special characters
    const specialCharRatio = (text.match(/[^a-zA-Z0-9\s.,!?;:'"()-]/g) || []).length / text.length;
    return specialCharRatio < 0.3; // Less than 30% special characters
  }
}
