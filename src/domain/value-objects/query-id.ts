// Domain value object for TTS Query ID
import { StringIdentifier } from '../../common/value-objects/identifier';

export class QueryId extends StringIdentifier {
  private constructor(value: string) {
    super(value);
  }

  static override generate(): QueryId {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 7);
    return new QueryId(`tts-${timestamp}-${randomPart}`);
  }

  static override fromString(value: string): QueryId {
    return new QueryId(value);
  }

  // TTS-specific methods can be added here if needed
  isValid(): boolean {
    return this.getValue().startsWith('tts-') || /^[a-zA-Z0-9-]+$/.test(this.getValue());
  }
}
