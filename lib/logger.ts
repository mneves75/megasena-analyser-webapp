/**
 * Production-ready logger utility
 * Replaces console.log with structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

class Logger {
  private isDevelopment: boolean;
  private isDebugEnabled: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
    this.isDebugEnabled = process.env.DEBUG === 'true';
  }

  private formatMessage(entry: LogEntry): string {
    const { level, message, timestamp, context } = entry;
    const levelTag = `[${level.toUpperCase()}]`;
    const timeTag = `[${timestamp}]`;
    
    let formatted = `${timeTag} ${levelTag} ${message}`;
    
    if (context && Object.keys(context).length > 0) {
      formatted += ` ${JSON.stringify(context)}`;
    }
    
    return formatted;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    const formatted = this.formatMessage(entry);

    switch (level) {
      case 'debug':
        if (this.isDebugEnabled) {
          console.debug(formatted);
        }
        break;
      case 'info':
        console.log(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const errorContext = {
      ...context,
      error: error instanceof Error 
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
    };
    this.log('error', message, errorContext);
  }

  // Utility methods for common scenarios
  apiRequest(method: string, path: string, duration?: number): void {
    this.info(`API ${method} ${path}`, duration ? { duration: `${duration}ms` } : undefined);
  }

  apiError(method: string, path: string, error: unknown): void {
    this.error(`API ${method} ${path} failed`, error);
  }

  dbQuery(query: string, duration?: number): void {
    if (this.isDebugEnabled) {
      this.debug(`DB Query: ${query}`, duration ? { duration: `${duration}ms` } : undefined);
    }
  }

  migration(name: string, status: 'start' | 'success' | 'error'): void {
    const message = `Migration ${name} ${status}`;
    if (status === 'error') {
      this.error(message);
    } else {
      this.info(message);
    }
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience exports
export const { debug, info, warn, error } = logger;

