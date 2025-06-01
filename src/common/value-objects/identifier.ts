// Generic identifier value object for common use across domains
export abstract class Identifier<T extends string | number = string> {
  protected constructor(protected readonly value: T) {
    this.validate(value);
  }

  protected abstract validate(value: T): void;

  getValue(): T {
    return this.value;
  }

  equals(other: Identifier<T>): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}

// Generic string-based identifier
export class StringIdentifier extends Identifier<string> {
  protected constructor(value: string) {
    super(value);
  }

  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('Identifier cannot be empty');
    }
  }

  static fromString(value: string): StringIdentifier {
    return new StringIdentifier(value);
  }

  static generate(): StringIdentifier {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 7);
    return new StringIdentifier(`${timestamp}-${randomPart}`);
  }
}

// UUID-based identifier
export class UuidIdentifier extends Identifier<string> {
  protected constructor(value: string) {
    super(value);
  }

  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('UUID cannot be empty');
    }
    
    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('Invalid UUID format');
    }
  }

  static fromString(value: string): UuidIdentifier {
    return new UuidIdentifier(value);
  }

  static generate(): UuidIdentifier {
    return new UuidIdentifier(crypto.randomUUID());
  }
}
