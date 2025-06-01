// Integration layer logging and monitoring service
import { Injectable } from '@angular/core';
import { Logger as BaseLogger } from '../common/utils';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  category?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  error?: Error;
}

export interface LogMetrics {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  recentErrors: LogEntry[];
  performanceMetrics: {
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private logs: LogEntry[] = [];
  private maxLogSize = 1000;
  private sessionId = this.generateSessionId();
  private performanceData: { timestamp: Date; duration: number; success: boolean }[] = [];

  constructor() {
    // Only set up log cleanup interval in the browser
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanupLogs(), 60000); // Every minute
    }
  }

  // Core logging methods
  debug(message: string, category?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, category, metadata);
  }

  info(message: string, category?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, category, metadata);
    BaseLogger.info(`[${category || 'General'}] ${message}`, metadata);
  }

  warn(message: string, category?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, category, metadata);
    BaseLogger.warn(`[${category || 'General'}] ${message}`, metadata);
  }

  error(message: string, error?: Error, category?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, category, { ...metadata, error: error?.message }, error);
    BaseLogger.error(`[${category || 'General'}] ${message}`, error, metadata);
  }

  critical(message: string, error?: Error, category?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.CRITICAL, message, category, { ...metadata, error: error?.message }, error);
    BaseLogger.error(`[CRITICAL][${category || 'General'}] ${message}`, error, metadata);
    
    // For critical errors, we might want to send to external monitoring
    this.sendCriticalAlert(message, error, category, metadata);
  }

  // Performance monitoring
  trackPerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    category?: string
  ): Promise<T> {
    const startTime = Date.now();
    this.info(`Starting operation: ${operation}`, category, { operation });

    return fn()
      .then(result => {
        const duration = Date.now() - startTime;
        this.performanceData.push({ timestamp: new Date(), duration, success: true });
        this.info(`Operation completed: ${operation}`, category, { 
          operation, 
          duration: `${duration}ms`,
          success: true 
        });
        return result;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        this.performanceData.push({ timestamp: new Date(), duration, success: false });
        this.error(`Operation failed: ${operation}`, error as Error, category, { 
          operation, 
          duration: `${duration}ms`,
          success: false 
        });
        throw error;
      });
  }

  // Analytics and metrics
  getMetrics(): LogMetrics {
    const logsByLevel = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);

    const recentErrors = this.logs
      .filter(log => log.level >= LogLevel.ERROR)
      .slice(-10);

    const recentPerformance = this.performanceData.slice(-100);
    const averageResponseTime = recentPerformance.length > 0
      ? recentPerformance.reduce((sum, entry) => sum + entry.duration, 0) / recentPerformance.length
      : 0;

    const errorRate = recentPerformance.length > 0
      ? recentPerformance.filter(entry => !entry.success).length / recentPerformance.length
      : 0;

    return {
      totalLogs: this.logs.length,
      logsByLevel,
      recentErrors,
      performanceMetrics: {
        averageResponseTime,
        totalRequests: recentPerformance.length,
        errorRate
      }
    };
  }

  // Query logs
  getLogs(
    level?: LogLevel,
    category?: string,
    limit = 100,
    since?: Date
  ): LogEntry[] {
    let filtered = this.logs;

    if (level !== undefined) {
      filtered = filtered.filter(log => log.level >= level);
    }

    if (category) {
      filtered = filtered.filter(log => log.category === category);
    }

    if (since) {
      filtered = filtered.filter(log => log.timestamp >= since);
    }

    return filtered.slice(-limit);
  }

  // Export logs for external analysis
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      return this.exportLogsAsCsv();
    }
    return JSON.stringify(this.logs, null, 2);
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
    this.performanceData = [];
    this.info('Logs cleared', 'System');
  }

  // Private methods
  private log(
    level: LogLevel,
    message: string,
    category?: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      category,
      metadata,
      sessionId: this.sessionId,
      error
    };

    this.logs.push(entry);

    // Ensure we don't exceed max log size
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }
  }

  private cleanupLogs(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Keep critical and error logs longer, clean up debug/info logs
    this.logs = this.logs.filter(log => 
      log.level >= LogLevel.ERROR || log.timestamp > oneHourAgo
    );

    // Clean up old performance data
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    this.performanceData = this.performanceData.filter(entry => 
      entry.timestamp > oneMinuteAgo
    );
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sendCriticalAlert(
    message: string,
    error?: Error,
    category?: string,
    metadata?: Record<string, unknown>
  ): void {
    // In a real application, this would send to external monitoring services
    // like Sentry, DataDog, New Relic, etc.
    console.error('CRITICAL ALERT:', {
      message,
      error: error?.message,
      stack: error?.stack,
      category,
      metadata,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  private exportLogsAsCsv(): string {
    const headers = ['Timestamp', 'Level', 'Category', 'Message', 'Error', 'Metadata'];
    const rows = this.logs.map(log => [
      log.timestamp.toISOString(),
      LogLevel[log.level],
      log.category || '',
      log.message,
      log.error?.message || '',
      JSON.stringify(log.metadata || {})
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }
}
