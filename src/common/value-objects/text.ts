// Generic text validation value object for common use across domains
export abstract class ValidatedText {
  protected constructor(protected readonly value: string) {
    this.validate(value);
  }

  protected abstract validate(value: string): void;

  getValue(): string {
    return this.value;
  }

  getLength(): number {
    return this.value.length;
  }

  getTrimmedLength(): number {
    return this.value.trim().length;
  }

  isEmpty(): boolean {
    return this.value.trim().length === 0;
  }

  equals(other: ValidatedText): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

// Generic non-empty text
export class NonEmptyText extends ValidatedText {
  protected constructor(value: string) {
    super(value);
  }

  protected validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }
  }

  static fromString(value: string): NonEmptyText {
    return new NonEmptyText(value.trim());
  }
}

// Generic bounded text (with min/max length constraints)
export class BoundedText extends ValidatedText {
  protected constructor(
    value: string,
    private readonly minLength = 1,
    private readonly maxLength: number = Number.MAX_SAFE_INTEGER
  ) {
    super(value);
  }

  protected validate(value: string): void {
    const trimmed = value.trim();
    
    if (trimmed.length < this.minLength) {
      throw new Error(`Text must be at least ${this.minLength} characters`);
    }
    
    if (trimmed.length > this.maxLength) {
      throw new Error(`Text cannot exceed ${this.maxLength} characters`);
    }
  }

  static fromString(value: string, minLength = 1, maxLength: number = Number.MAX_SAFE_INTEGER): BoundedText {
    return new BoundedText(value.trim(), minLength, maxLength);
  }

  getMinLength(): number {
    return this.minLength;
  }

  getMaxLength(): number {
    return this.maxLength;
  }
}
