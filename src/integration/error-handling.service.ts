// Integration layer error handling and monitoring service
import { Injectable } from '@angular/core';
import { ProviderError, ProviderErrorType } from '../domain/provider.entity';
import { Result } from '../common/result';
import { LoggingService } from './logging.service';

export interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface ErrorReport {
  id: string;
  type: 'provider' | 'validation' | 'network' | 'system' | 'user';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: unknown;
  context: ErrorContext;
  timestamp: Date;
  resolved: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlingService {
  private errorReports: ErrorReport[] = [];
  private readonly maxReports = 100;

  constructor(private logging: LoggingService) {}

  handleProviderError(
    error: ProviderError,
    context: ErrorContext = {}
  ): Result<never, string> {
    const report = this.createErrorReport({
      type: 'provider',
      severity: this.getProviderErrorSeverity(error.type),
      message: error.message,
      details: error,
      context
    });

    this.logError(report);
    return Result.failure(this.getUserFriendlyMessage(error));
  }
  handleValidationError(
    message: string,
    details?: unknown,
    context: ErrorContext = {}
  ): Result<never, string> {
    const report = this.createErrorReport({
      type: 'validation',
      severity: 'medium',
      message,
      details,
      context
    });

    this.logError(report);
    return Result.failure(message);
  }

  handleSystemError(
    error: Error,
    context: ErrorContext = {}
  ): Result<never, string> {
    const report = this.createErrorReport({
      type: 'system',
      severity: 'high',
      message: error.message,
      details: {
        name: error.name,
        stack: error.stack,
        cause: error.cause
      },
      context
    });

    this.logError(report);
    return Result.failure('An unexpected error occurred. Please try again.');
  }
  handleNetworkError(
    error: unknown,
    context: ErrorContext = {}
  ): Result<never, string> {
    const report = this.createErrorReport({
      type: 'network',
      severity: 'high',
      message: 'Network request failed',
      details: error,
      context
    });

    this.logError(report);
    return Result.failure('Network connection failed. Please check your internet connection and try again.');
  }

  private createErrorReport(
    params: Omit<ErrorReport, 'id' | 'timestamp' | 'resolved'>
  ): ErrorReport {
    const report: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      resolved: false,
      ...params,
      context: {
        timestamp: new Date(),
        ...params.context
      }
    };

    this.addErrorReport(report);
    return report;
  }

  private addErrorReport(report: ErrorReport): void {
    this.errorReports.unshift(report);
    
    // Keep only the most recent reports
    if (this.errorReports.length > this.maxReports) {
      this.errorReports = this.errorReports.slice(0, this.maxReports);
    }
  }
  private logError(report: ErrorReport): void {
    const category = 'ErrorHandling';
    const metadata = {
      errorId: report.id,
      severity: report.severity,
      context: report.context,
      details: report.details
    };
    
    switch (report.severity) {
      case 'low':
        this.logging.info(`[${report.type.toUpperCase()}] ${report.message}`, category, metadata);
        break;
      case 'medium':
        this.logging.warn(`[${report.type.toUpperCase()}] ${report.message}`, category, metadata);
        break;
      case 'high':
        this.logging.error(`[${report.type.toUpperCase()}] ${report.message}`, undefined, category, metadata);
        break;
      case 'critical':
        this.logging.critical(`[${report.type.toUpperCase()}] ${report.message}`, undefined, category, metadata);
        break;
      default:
        this.logging.error(`[${report.type.toUpperCase()}] ${report.message}`, undefined, category, metadata);
    }  }
  
  private getProviderErrorSeverity(errorType: ProviderErrorType): ErrorReport['severity'] {
    switch (errorType) {
      case ProviderErrorType.RATE_LIMIT_EXCEEDED:
      case ProviderErrorType.QUOTA_EXCEEDED:
        return 'medium';
      case ProviderErrorType.AUTHENTICATION_FAILED:
        return 'high';
      case ProviderErrorType.NETWORK_ERROR:
      case ProviderErrorType.SERVICE_UNAVAILABLE:
        return 'high';
      case ProviderErrorType.INVALID_VOICE:
      case ProviderErrorType.INVALID_MODEL:
      case ProviderErrorType.TEXT_TOO_LONG:
      case ProviderErrorType.UNSUPPORTED_FORMAT:
        return 'low';
      default:
        return 'medium';
    }
  }

  private getUserFriendlyMessage(error: ProviderError): string {
    switch (error.type) {
      case ProviderErrorType.RATE_LIMIT_EXCEEDED:
        return 'Request rate limit exceeded. Please wait a moment and try again.';
      case ProviderErrorType.AUTHENTICATION_FAILED:
        return 'Invalid API key. Please check your API key in settings.';
      case ProviderErrorType.QUOTA_EXCEEDED:
        return 'Quota exceeded. Please check your account limits.';
      case ProviderErrorType.NETWORK_ERROR:
        return 'Network connection failed. Please check your internet connection.';
      case ProviderErrorType.SERVICE_UNAVAILABLE:
        return 'The TTS service is temporarily unavailable. Please try again later.';
      case ProviderErrorType.INVALID_VOICE:
        return 'Invalid voice selected. Please choose a different voice.';
      case ProviderErrorType.INVALID_MODEL:
        return 'Invalid model selected. Please choose a different model.';
      case ProviderErrorType.TEXT_TOO_LONG:
        return 'Text is too long for the selected provider. Please shorten your text.';
      case ProviderErrorType.UNSUPPORTED_FORMAT:
        return 'Unsupported audio format requested.';
      default:
        return error.message || 'An error occurred while processing your request.';
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for error monitoring
  getRecentErrors(limit = 20): ErrorReport[] {
    return this.errorReports.slice(0, limit);
  }

  getErrorsByType(type: ErrorReport['type']): ErrorReport[] {
    return this.errorReports.filter(report => report.type === type);
  }

  getErrorsBySeverity(severity: ErrorReport['severity']): ErrorReport[] {
    return this.errorReports.filter(report => report.severity === severity);
  }
  markErrorAsResolved(errorId: string): boolean {
    const error = this.errorReports.find(report => report.id === errorId);
    if (error) {
      error.resolved = true;
      this.logging.info('Error marked as resolved', 'ErrorHandling', { errorId });
      return true;
    }
    return false;
  }

  clearErrorHistory(): void {
    const count = this.errorReports.length;
    this.errorReports = [];
    this.logging.info('Error history cleared', 'ErrorHandling', { clearedCount: count });
  }

  getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    resolved: number;
    unresolved: number;
  } {
    const stats = {
      total: this.errorReports.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      resolved: 0,
      unresolved: 0
    };

    this.errorReports.forEach(report => {
      // Count by type
      stats.byType[report.type] = (stats.byType[report.type] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[report.severity] = (stats.bySeverity[report.severity] || 0) + 1;
      
      // Count resolution status
      if (report.resolved) {
        stats.resolved++;
      } else {
        stats.unresolved++;
      }
    });

    return stats;
  }
}
