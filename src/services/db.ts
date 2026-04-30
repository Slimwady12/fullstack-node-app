import axios from 'axios';
import { Database } from '../types/db';

interface ReadResponse {
  data: Database;
  lastModified: string;
}

interface WritePayload {
  data: Database;
  lastModified: string;
}

// Use environment variable for API base URL with fallback to relative path
const API_BASE = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '') // Remove trailing slash
  : '/api';

const MAX_RETRIES = 5;
const RETRY_BASE_DELAY = 100;

// Debug logging utility
const debugLog = (type: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logPrefix = `[API_DEBUG ${timestamp}]`;
  
  if (type === 'error') {
    console.error(`${logPrefix} ❌ ${message}`, data || '');
  } else if (type === 'warn') {
    console.warn(`${logPrefix} ⚠️ ${message}`, data || '');
  } else if (type === 'info') {
    console.info(`${logPrefix} ℹ️ ${message}`, data || '');
  } else {
    console.log(`${logPrefix} ${message}`, data || '');
  }
};

async function read(): Promise<ReadResponse> {
  const timestamp = Date.now();
  const url = `${API_BASE}/db/read`;
  
  debugLog('info', 'Reading database', { url, params: { t: timestamp } });

  try {
    const response = await axios.get(url, {
      params: { t: timestamp },
      timeout: 10000,
      headers: {
        'X-Request-ID': crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`,
      },
    });

    debugLog('success', 'Database read successful', { 
      status: response.status,
      hasData: !!response.data,
      success: response.data?.success 
    });

    if (!response.data || !response.data.success) {
      const error = response.data?.error || 'Failed to read database';
      debugLog('error', 'Database read failed - server returned error', { error, responseData: response.data });
      throw new Error(error);
    }

    return {
      data: response.data.data as Database,
      lastModified: new Date().toISOString(),
    };
  } catch (error) {
    debugLog('error', 'Database read failed - exception caught', { 
      errorType: error?.constructor?.name,
      isAxiosError: axios.isAxiosError(error),
      errorMessage: error instanceof Error ? error.message : String(error),
      responseStatus: axios.isAxiosError(error) ? error.response?.status : undefined,
      responseData: axios.isAxiosError(error) ? error.response?.data : undefined,
    });

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;
      const code = error.response?.data?.code;

      if (status === 404) {
        debugLog('warn', 'Database endpoint not found (404)', { 
          url, 
          hint: 'Make sure backend server is running and /api/db/read endpoint exists' 
        });
        throw { code: 'DB_NOT_FOUND', message, details: { status, url } };
      }

      if (status === 500) {
        debugLog('error', 'Server error (500)', { url, message, code });
        throw { code: 'DB_READ_ERROR', message, details: { status, code } };
      }

      if (status === 0) {
        debugLog('error', 'Network error - cannot reach server', { 
          url, 
          hint: 'Check if backend server is running at ' + API_BASE,
          corsIssue: error.message?.includes('Network Error') 
        });
        throw { 
          code: 'NETWORK_UNREACHABLE', 
          message: 'Cannot connect to backend server. Make sure it\'s running.',
          details: { url, API_BASE, corsIssue: true }
        };
      }
    }

    throw {
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown network error',
      details: { errorType: error?.constructor?.name },
    };
  }
}

async function write(data: Database, lastModified: string): Promise<void> {
  const payload: WritePayload = { data, lastModified };
  const url = `${API_BASE}/db/write`;

  debugLog('info', 'Writing database', { 
    url, 
    dataSize: JSON.stringify(data).length,
    lastModified 
  });

  try {
    const response = await axios.post(url, payload, {
      timeout: 15000,
      headers: { 
        'Content-Type': 'application/json',
        'X-Request-ID': crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`,
      },
    });

    debugLog('success', 'Database write successful', { 
      status: response.status,
      success: response.data?.success 
    });

    if (!response.data || !response.data.success) {
      const error = response.data?.error || 'Failed to write database';
      debugLog('error', 'Database write failed - server returned error', { error, responseData: response.data });
      throw new Error(error);
    }
  } catch (error) {
    debugLog('error', 'Database write failed - exception caught', {
      errorType: error?.constructor?.name,
      isAxiosError: axios.isAxiosError(error),
      errorMessage: error instanceof Error ? error.message : String(error),
      responseStatus: axios.isAxiosError(error) ? error.response?.status : undefined,
      responseData: axios.isAxiosError(error) ? error.response?.data : undefined,
    });

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;
      const code = error.response?.data?.code || 'DB_WRITE_ERROR';

      if (status === 409) {
        debugLog('warn', 'Database conflict (409) - will retry', { 
          url, 
          message,
          hint: 'Another process modified the database simultaneously' 
        });
        throw { code: 'CONFLICT', message: 'Database was modified by another process', retryable: true, details: { status, code } };
      }

      if (status === 400) {
        debugLog('error', 'Validation error (400)', { url, message, code, payload });
        throw { code: 'VALIDATION_ERROR', message, retryable: false, details: { status, code, payload } };
      }

      if (status === 500) {
        debugLog('error', 'Server error (500)', { url, message, code });
        throw { code: 'DB_WRITE_ERROR', message, retryable: true, details: { status, code } };
      }

      if (status === 0) {
        debugLog('error', 'Network error - cannot reach server', {
          url,
          hint: 'Check if backend server is running at ' + API_BASE,
          corsIssue: error.message?.includes('Network Error')
        });
        throw {
          code: 'NETWORK_UNREACHABLE',
          message: 'Cannot connect to backend server. Make sure it\'s running.',
          retryable: true,
          details: { url, API_BASE, corsIssue: true }
        };
      }
    }

    throw {
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown network error',
      retryable: true,
      details: { errorType: error?.constructor?.name },
    };
  }
}

async function transaction<T>(fn: (db: Database) => Database | Promise<Database>): Promise<T | void> {
  let retries = 0;

  debugLog('info', 'Starting database transaction', { maxRetries: MAX_RETRIES });

  while (retries < MAX_RETRIES) {
    try {
      debugLog('info', `Transaction attempt ${retries + 1}/${MAX_RETRIES}`);
      
      const { data: currentDb } = await read();

      const result = fn(currentDb);
      const updatedDb = result instanceof Promise ? await result : result;

      if (updatedDb === undefined || updatedDb === null) {
        debugLog('info', 'Transaction completed - no changes made');
        await write(currentDb, new Date().toISOString());
        return undefined;
      }

      await write(updatedDb as Database, new Date().toISOString());
      debugLog('success', 'Transaction completed successfully');
      return updatedDb as unknown as T;
    } catch (error) {
      const err = error as { code?: string; retryable?: boolean; message?: string; details?: any };

      debugLog('error', 'Transaction attempt failed', { 
        attempt: retries + 1,
        code: err.code,
        message: err.message,
        retryable: err.retryable,
        details: err.details 
      });

      if (err.code === 'CONFLICT' || err.retryable === true) {
        retries++;
        const delay = RETRY_BASE_DELAY * Math.pow(2, retries - 1);

        if (retries >= MAX_RETRIES) {
          debugLog('error', 'Transaction failed - max retries exceeded', { 
            totalAttempts: retries,
            lastError: err.message 
          });
          throw {
            code: 'MAX_RETRIES_EXCEEDED',
            message: `Transaction failed after ${MAX_RETRIES} retries: ${err.message || 'Unknown error'}`,
            details: { attempts: retries, lastError: err },
          };
        }

        debugLog('warn', `Retrying transaction in ${delay}ms...`, { attempt: retries, delay });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      debugLog('error', 'Transaction failed - non-retryable error', { code: err.code, message: err.message });
      throw error;
    }
  }

  throw {
    code: 'MAX_RETRIES_EXCEEDED',
    message: `Transaction failed after ${MAX_RETRIES} retries`,
    details: { attempts: retries },
  };
}

export { read, write, transaction };
