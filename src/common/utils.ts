// Common utilities that can be used across all layers

export class Logger {
  static info(message: string, ...args: any[]): void {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args);
  }

  static error(message: string, error?: Error, ...args: any[]): void {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error, ...args);
  }
}

export class DateTimeUtil {
  static formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  static formatDateTime(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  static isValidDate(date: any): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }
}

export class StringUtil {
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  static truncate(str: string, maxLength: number): string {
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  }

  static isEmpty(str: string | null | undefined): boolean {
    return !str || str.trim().length === 0;
  }
}
