// Integration layer monitoring and health check service
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LoggingService, LogLevel } from './logging.service';
import { ProviderConfigurationService } from './provider-configuration.service';
import { ModelProvider } from '../domain/tts.entity';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  lastUpdated: Date;
  uptime: number; // milliseconds
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number; // milliseconds
  lastChecked: Date;
}

export interface ApplicationMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  providers: Partial<Record<ModelProvider, {
      requests: number;
      errors: number;
      averageResponseTime: number;
      lastUsed: Date;
      lastHealthCheck?: string;
      isHealthy?: boolean;
    }>>;
  storage: {
    used: number;
    available: number;
    percentageUsed: number;
  };
  errors: {
    total: number;
    byLevel: Record<LogLevel, number>;
    recentErrorRate: number; // errors per hour
  };
  system: {
    healthScore: number; // 0-100
    uptime: number;
    startTime: Date;
  };
}

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  private startTime = Date.now();
  private healthChecks = new Map<string, HealthCheck>();
  private metrics: ApplicationMetrics = this.initializeMetrics();
  private healthCheckInterval?: number;
  private isBrowser: boolean;

  constructor(
    private logging: LoggingService,
    private providerConfig: ProviderConfigurationService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.initializeMonitoring();
  }

  // Health monitoring
  async getHealthStatus(): Promise<HealthStatus> {
    const checks = await this.runHealthChecks();
    const overallStatus = this.determineOverallHealth(checks);

    return {
      status: overallStatus,
      checks,
      lastUpdated: new Date(),
      uptime: Date.now() - this.startTime
    };
  }

  registerHealthCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.logging.info(`Registering health check: ${name}`, 'Monitoring');
    
    // Run initial check
    checkFn().then(result => {
      this.healthChecks.set(name, result);
    }).catch(error => {
      this.healthChecks.set(name, {
        name,
        status: 'fail',
        message: error.message,
        lastChecked: new Date()
      });
    });
  }

  // Metrics collection
  recordRequest(provider: ModelProvider, success: boolean, responseTime: number): void {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    // Update average response time (simple moving average)
    const totalRequests = this.metrics.requests.total;
    this.metrics.requests.averageResponseTime = 
      (this.metrics.requests.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    // Provider-specific metrics
    if (!this.metrics.providers[provider]) {
      this.metrics.providers[provider] = {
        requests: 0,
        errors: 0,
        averageResponseTime: 0,
        lastUsed: new Date()
      };
    }

    const providerMetrics = this.metrics.providers[provider]!;
    providerMetrics.requests++;
    providerMetrics.lastUsed = new Date();

    if (!success) {
      providerMetrics.errors++;
    }

    // Update provider average response time
    providerMetrics.averageResponseTime = 
      (providerMetrics.averageResponseTime * (providerMetrics.requests - 1) + responseTime) / providerMetrics.requests;
  }

  recordError(level: LogLevel): void {
    this.metrics.errors.total++;
    this.metrics.errors.byLevel[level] = (this.metrics.errors.byLevel[level] || 0) + 1;
  }

  updateStorageMetrics(used: number, available: number): void {
    this.metrics.storage.used = used;
    this.metrics.storage.available = available;
    this.metrics.storage.percentageUsed = (used / (used + available)) * 100;
  }

  getMetrics(): ApplicationMetrics {
    // Calculate recent error rate (errors in last hour)
    const logMetrics = this.logging.getMetrics();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = this.logging.getLogs(LogLevel.ERROR, undefined, 1000, oneHourAgo);
    this.metrics.errors.recentErrorRate = recentErrors.length;
    this.metrics.errors.byLevel = logMetrics.logsByLevel;

    return { ...this.metrics };
  }

  // Alert system
  checkAlerts(): string[] {
    const alerts: string[] = [];
    const metrics = this.getMetrics();

    // High error rate alert
    if (metrics.errors.recentErrorRate > 10) {
      alerts.push(`High error rate: ${metrics.errors.recentErrorRate} errors in the last hour`);
    }

    // High storage usage alert
    if (metrics.storage.percentageUsed > 90) {
      alerts.push(`Storage critically low: ${metrics.storage.percentageUsed.toFixed(1)}% used`);
    } else if (metrics.storage.percentageUsed > 80) {
      alerts.push(`Storage usage high: ${metrics.storage.percentageUsed.toFixed(1)}% used`);
    }

    // High response time alert
    if (metrics.requests.averageResponseTime > 5000) {
      alerts.push(`High average response time: ${metrics.requests.averageResponseTime.toFixed(0)}ms`);
    }

    // Provider-specific alerts
    Object.entries(metrics.providers).forEach(([provider, providerMetrics]) => {
      if (providerMetrics) {
        const errorRate = providerMetrics.errors / providerMetrics.requests;
        if (errorRate > 0.1 && providerMetrics.requests > 10) {
          alerts.push(`High error rate for ${provider}: ${(errorRate * 100).toFixed(1)}%`);
        }
      }
    });

    return alerts;
  }
  // Performance monitoring
  startPerformanceMonitoring(): void {
    // Only start performance monitoring in browser environment
    if (!this.isBrowser) {
      this.logging.info('Skipping performance monitoring in SSR environment', 'Monitoring');
      return;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = window.setInterval(() => {
      this.runPeriodicChecks();
    }, 30000); // Every 30 seconds

    this.logging.info('Performance monitoring started', 'Monitoring');
  }

  stopPerformanceMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    this.logging.info('Performance monitoring stopped', 'Monitoring');
  }

  // Export monitoring data
  exportDiagnostics(): string {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      health: this.healthChecks,
      metrics: this.metrics,
      logs: this.logging.getLogs(LogLevel.WARN, undefined, 50),
      alerts: this.checkAlerts()
    };

    return JSON.stringify(diagnostics, null, 2);
  }

  // Private methods
  private initializeMetrics(): ApplicationMetrics {
    return {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0
      },
      providers: {},
      storage: {
        used: 0,
        available: 0,
        percentageUsed: 0
      },
      errors: {
        total: 0,
        byLevel: {
          [LogLevel.DEBUG]: 0,
          [LogLevel.INFO]: 0,
          [LogLevel.WARN]: 0,
          [LogLevel.ERROR]: 0,
          [LogLevel.CRITICAL]: 0
        },
        recentErrorRate: 0
      },
      system: {
        healthScore: 100,
        uptime: 0,
        startTime: new Date()
      }
    };
  }

  private initializeMonitoring(): void {
    this.logging.info('Initializing monitoring service', 'Monitoring');

    // Register default health checks
    this.registerHealthCheck('localStorage', this.checkLocalStorage);
    this.registerHealthCheck('providers', this.checkProviders.bind(this));

    // Start periodic monitoring
    this.startPerformanceMonitoring();
  }

  private async runHealthChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Only run browser-specific health checks in the browser
    if (this.isBrowser) {
      // Check localStorage
      checks.push(await this.checkLocalStorage());

      // Check providers
      checks.push(await this.checkProviders());
    }

    // Add other health checks here

    return checks;
  }

  private determineOverallHealth(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const failedChecks = checks.filter(check => check.status === 'fail');
    const warnChecks = checks.filter(check => check.status === 'warn');

    if (failedChecks.length > 0) {
      return 'unhealthy';
    }
    
    if (warnChecks.length > 0) {
      return 'degraded';
    }

    return 'healthy';
  }
  private checkLocalStorage = async (): Promise<HealthCheck> => {
    const start = Date.now();
    
    try {      // Skip localStorage check in SSR environment
      if (!this.isBrowser) {        return {
          name: 'localStorage',
          status: 'pass',
          message: 'localStorage check skipped in SSR environment',
          duration: Date.now() - start,
          lastChecked: new Date()
        };
      }

      // Test localStorage functionality
      const testKey = 'monitoring_test';
      const testValue = 'test_value';
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (retrieved !== testValue) {
        throw new Error('localStorage read/write test failed');
      }

      return {
        name: 'localStorage',
        status: 'pass',
        message: 'localStorage is functioning properly',
        duration: Date.now() - start,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        name: 'localStorage',
        status: 'fail',
        message: error instanceof Error ? error.message : 'localStorage check failed',
        duration: Date.now() - start,
        lastChecked: new Date()
      };
    }
  };

  private async checkProviders(): Promise<HealthCheck> {
    const start = Date.now();
    
    try {
      const availableProviders = this.providerConfig.getAvailableProviders();
      
      if (availableProviders.length === 0) {
        return {
          name: 'providers',
          status: 'fail',
          message: 'No TTS providers are available',
          duration: Date.now() - start,
          lastChecked: new Date()
        };
      }

      return {
        name: 'providers',
        status: 'pass',
        message: `${availableProviders.length} provider(s) available: ${availableProviders.join(', ')}`,
        duration: Date.now() - start,
        lastChecked: new Date()
      };
    } catch (error) {
      return {
        name: 'providers',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Provider check failed',
        duration: Date.now() - start,
        lastChecked: new Date()
      };
    }
  }

  private runPeriodicChecks(): void {
    // Update storage metrics if available
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        this.updateStorageMetrics(used, quota - used);
      }).catch(error => {
        this.logging.warn('Failed to update storage metrics', 'Monitoring', { error: error.message });
      });
    }

    // Check for alerts
    const alerts = this.checkAlerts();
    if (alerts.length > 0) {
      this.logging.warn('Monitoring alerts detected', 'Monitoring', { alerts });
    }
  }
  recordHealthCheck(provider: ModelProvider, isHealthy: boolean): void {
    const timestamp = new Date();
    
    // Record in provider metrics
    if (!this.metrics.providers[provider]) {
      this.metrics.providers[provider] = {
        requests: 0,
        errors: 0,
        averageResponseTime: 0,
        lastUsed: new Date()
      };
    }

    // Update provider health status
    this.metrics.providers[provider]!.lastHealthCheck = timestamp.toISOString();
    this.metrics.providers[provider]!.isHealthy = isHealthy;
    
    if (isHealthy) {
      this.metrics.system.healthScore = Math.min(100, this.metrics.system.healthScore + 5);
    } else {
      this.metrics.system.healthScore = Math.max(0, this.metrics.system.healthScore - 10);
    }

    this.logging.debug(`Health check recorded for ${provider}: ${isHealthy ? 'healthy' : 'unhealthy'}`, 'MonitoringService');
  }
}
