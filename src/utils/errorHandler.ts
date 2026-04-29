/**
 * Centralized Error Handling and Logging Utility
 * Provides consistent error reporting with context and memory
 */

export interface AppError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  stack?: string;
}

class ErrorLogger {
  private static instance: ErrorLogger;
  private errorHistory: AppError[] = [];
  private readonly MAX_HISTORY = 50;

  private constructor() {}

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Log an error with context for debugging
   */
  log(error: unknown, context?: Record<string, unknown>): AppError {
    const appError = this.normalizeError(error, context);
    
    // Add to history for debugging across sessions
    this.errorHistory.unshift(appError);
    if (this.errorHistory.length > this.MAX_HISTORY) {
      this.errorHistory.pop();
    }

    // Console output with formatting
    console.group(`❌ [${appError.code}] ${new Date(appError.timestamp).toLocaleTimeString()}`);
    console.error('Message:', appError.message);
    if (appError.context) {
      console.error('Context:', appError.context);
    }
    if (appError.stack) {
      console.error('Stack:', appError.stack);
    }
    console.groupEnd();

    // Store in sessionStorage for cross-component debugging
    try {
      const storageKey = 'app_error_history';
      const existing = sessionStorage.getItem(storageKey);
      const history = existing ? JSON.parse(existing) : [];
      history.unshift(appError);
      sessionStorage.setItem(storageKey, JSON.stringify(history.slice(0, this.MAX_HISTORY)));
    } catch {
      // Ignore storage errors
    }

    return appError;
  }

  /**
   * Get recent error history for debugging
   */
  getHistory(): AppError[] {
    try {
      const stored = sessionStorage.getItem('app_error_history');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore storage errors
    }
    return this.errorHistory;
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
    try {
      sessionStorage.removeItem('app_error_history');
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Normalize any error into AppError format
   */
  private normalizeError(error: unknown, context?: Record<string, unknown>): AppError {
    const timestamp = new Date().toISOString();

    if (typeof error === 'string') {
      return {
        code: 'UNKNOWN_ERROR',
        message: error,
        context,
        timestamp,
      };
    }

    if (error instanceof Error) {
      return {
        code: error.name || 'UNKNOWN_ERROR',
        message: error.message,
        context: {
          ...context,
          ...(error as any).context,
        },
        stack: error.stack,
        timestamp,
      };
    }

    if (error && typeof error === 'object' && 'code' in error) {
      const err = error as Partial<AppError>;
      return {
        code: String(err.code || 'UNKNOWN_ERROR'),
        message: String(err.message || 'An unexpected error occurred'),
        context: err.context || context,
        stack: err.stack,
        timestamp: err.timestamp || timestamp,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
      context: {
        ...context,
        rawError: String(error),
      },
      timestamp,
    };
  }
}

/**
 * Wrap async functions with automatic error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorCode: string,
  defaultMessage?: string
): T {
  return ((...args: Parameters<T>) => {
    return fn(...args).catch((error: unknown) => {
      const logger = ErrorLogger.getInstance();
      const appError = logger.log(error, {
        functionName: fn.name,
        arguments: args,
      });
      
      throw {
        code: errorCode,
        message: defaultMessage || appError.message,
        context: appError.context,
      };
    });
  }) as T;
}

/**
 * Get the error logger instance
 */
export function getErrorLogger(): ErrorLogger {
  return ErrorLogger.getInstance();
}

/**
 * Display user-friendly error message
 */
export function getUserFriendlyMessage(code: string): string {
  const messages: Record<string, string> = {
    DB_NOT_FOUND: 'Database not found. Please refresh the page.',
    DB_READ_ERROR: 'Failed to load data. Please check your connection.',
    DB_WRITE_ERROR: 'Failed to save changes. Please try again.',
    CONFLICT: 'Data was modified by another process. Refreshing...',
    VALIDATION_ERROR: 'Invalid data provided. Please check your input.',
    NETWORK_ERROR: 'Network error. Please check your internet connection.',
    MAX_RETRIES_EXCEEDED: 'Operation failed after multiple attempts. Please try again.',
    AUTH_FAILED: 'Authentication failed. Please try logging in again.',
    INVALID_OTP: 'Invalid OTP code. Please try again.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  };

  return messages[code] || 'An error occurred. Please try again.';
}
