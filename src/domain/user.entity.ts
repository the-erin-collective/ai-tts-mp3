// Domain Entity: User
export interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAt: Date;
  readonly isActive: boolean;
}

// Value Object: UserId
export class UserId {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('UserId cannot be empty');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }
}

// Value Object: Email
export class Email {
  constructor(private readonly value: string) {
    if (!this.isValidEmail(value)) {
      throw new Error('Invalid email format');
    }
  }

  getValue(): string {
    return this.value;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
