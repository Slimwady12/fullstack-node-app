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

const API_BASE = '/api';
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY = 100;

// Debug flag - can be controlled via environment variable
const DEBUG_DB = typeof window !== 'undefined' 
  ? (window as any).__DEBUG_DB__ || process.env.NODE_ENV === 'development'
  : true;

const log = (...args: any[]) => {
  if (DEBUG_DB) {
    console.log('[DB_SERVICE]', ...args);
  }
};

const warn = (...args: any[]) => {
  if (DEBUG_DB) {
    console.warn('[DB_SERVICE]', ...args);
  }
};

const errorLog = (...args: any[]) => {
  console.error('[DB_SERVICE]', ...args);
};

async function read(): Promise<ReadResponse> {
  const timestamp = Date.now();
  const requestId = `${timestamp}-${Math.random().toString(36).slice(2, 6)}`;
  
  log(`📖 [READ] Starting request #${requestId}`);
  log(`[READ] API_BASE: "${API_BASE}"`);
  log(`[READ] Full URL will be: ${API_BASE}/db/read?t=${timestamp}`);
  log(`[READ] Current window.location: ${typeof window !== 'undefined' ? window.location.href : 'N/A (server-side)'}`);
  
  try {
    const fullUrl = `${API_BASE}/db/read`;
    log(`[READ] Attempting GET to "${fullUrl}" with params: { t: ${timestamp} }`);
    
    const response = await axios.get(fullUrl, {
      params: { t: timestamp },
      timeout: 10000,
    });

    log(`[READ] ✅ Response received #${requestId}: status=${response.status}`);
    log(`[READ] Response data keys:`, Object.keys(response.data || {}));
    log(`[READ] Response data.success:`, response.data?.success);

    if (!response.data || !response.data.success) {
      const errorMsg = response.data?.error || 'Failed to read database';
      errorLog(`[READ] ❌ Server returned success=false:`, response.data);
      throw new Error(errorMsg);
    }

    const result = {
      data: response.data.data as Database,
      lastModified: new Date().toISOString(),
    };
    
    log(`[READ] ✅ Successfully unwrapped response, data keys:`, Object.keys(result.data || {}));
    log(`[READ] Has users array:`, Array.isArray(result.data?.users));
    log(`[READ] Users count:`, result.data?.users?.length ?? 'N/A');
    
    return result;
  } catch (err) {
    log(`[READ] ❌ Error caught #${requestId}`);
    
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const statusText = err.response?.statusText;
      const message = err.response?.data?.error || err.message;
      const responseData = err.response?.data;
      
      errorLog(`[READ] Axios error details:`);
      errorLog(`  - Status: ${status} ${statusText || ''}`);
      errorLog(`  - Message: ${message}`);
      errorLog(`  - Response data:`, responseData);
      errorLog(`  - Request URL: ${err.config?.url}`);
      errorLog(`  - Request method: ${err.config?.method}`);
      errorLog(`  - Request headers:`, err.config?.headers);

      if (status === 404) {
        errorLog(`[READ] 🔍 404 NOT FOUND - This means the /api/db/read endpoint doesn't exist on the server`);
        errorLog(`[READ] Possible causes:`);
        errorLog(`  1. Server is not running (localhost)`);
        errorLog(`  2. API route is not deployed correctly (Vercel)`);
        errorLog(`  3. Base URL "${API_BASE}" is incorrect`);
        errorLog(`  4. Server crashed or failed to initialize`);
        throw { code: 'DB_NOT_FOUND', message, debug: { status, url: err.config?.url, apiBase: API_BASE } };
      }

      if (status === 500) {
        errorLog(`[READ] 🚨 500 SERVER ERROR - Server encountered an internal error`);
        throw { code: 'DB_READ_ERROR', message, debug: { status, responseData } };
      }
      
      if (status === 401 || status === 403) {
        errorLog(`[READ] 🔒 Authentication/Authorization error: ${status}`);
        throw { code: 'AUTH_ERROR', message, debug: { status } };
      }
    } else {
      errorLog(`[READ] Non-Axios error:`, err);
    }

    throw {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : 'Unknown network error',
      debug: { 
        errorType: err?.constructor?.name,
        timestamp,
        requestId,
      },
    };
  }
}

async function write(data: Database, lastModified: string): Promise<void> {
  const payload: WritePayload = { data, lastModified };
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  
  log(`✍️ [WRITE] Starting request #${requestId}`);
  log(`[WRITE] Payload size: ${JSON.stringify(payload).length} bytes`);
  log(`[WRITE] Data keys:`, Object.keys(data || {}));
  log(`[WRITE] Has users:`, Array.isArray(data?.users));
  log(`[WRITE] Users count:`, data?.users?.length ?? 'N/A');

  try {
    const fullUrl = `${API_BASE}/db/write`;
    log(`[WRITE] Attempting POST to "${fullUrl}"`);
    
    const response = await axios.post(fullUrl, payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    log(`[WRITE] ✅ Response received #${requestId}: status=${response.status}`);

    if (!response.data || !response.data.success) {
      const errorMsg = response.data?.error || 'Failed to write database';
      errorLog(`[WRITE] ❌ Server returned success=false:`, response.data);
      throw new Error(errorMsg);
    }
    
    log(`[WRITE] ✅ Write successful`);
  } catch (err) {
    log(`[WRITE] ❌ Error caught #${requestId}`);
    
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const statusText = err.response?.statusText;
      const message = err.response?.data?.error || err.message;
      const code = err.response?.data?.code || 'DB_WRITE_ERROR';
      const responseData = err.response?.data;
      
      errorLog(`[WRITE] Axios error details:`);
      errorLog(`  - Status: ${status} ${statusText || ''}`);
      errorLog(`  - Code: ${code}`);
      errorLog(`  - Message: ${message}`);
      errorLog(`  - Response data:`, responseData);
      errorLog(`  - Request URL: ${err.config?.url}`);
      errorLog(`  - Request method: ${err.config?.method}`);

      if (status === 409) {
        errorLog(`[WRITE] ⚠️ CONFLICT - Database was modified by another process`);
        throw { code: 'CONFLICT', message: 'Database was modified by another process', retryable: true };
      }

      if (status === 400) {
        errorLog(`[WRITE] ❌ VALIDATION ERROR - Invalid data format`);
        throw { code: 'VALIDATION_ERROR', message, retryable: false };
      }

      if (status === 500) {
        errorLog(`[WRITE] 🚨 500 SERVER ERROR`);
        throw { code: 'DB_WRITE_ERROR', message, retryable: true };
      }
    } else {
      errorLog(`[WRITE] Non-Axios error:`, err);
    }

    throw {
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : 'Unknown network error',
      retryable: true,
      debug: {
        errorType: err?.constructor?.name,
        requestId,
      },
    };
  }
}

async function transaction<T>(fn: (db: Database) => Database | Promise<Database>): Promise<T | void> {
  let retries = 0;
  const transactionId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  
  log(`🔄 [TRANSACTION] Starting transaction #${transactionId}`);

  while (retries < MAX_RETRIES) {
    try {
      log(`[TRANSACTION] Attempt #${retries + 1}/${MAX_RETRIES}`);
      
      const { data: currentDb } = await read();
      log(`[TRANSACTION] Read current DB state, keys:`, Object.keys(currentDb || {}));

      const result = fn(currentDb);
      const updatedDb = result instanceof Promise ? await result : result;

      if (updatedDb === undefined || updatedDb === null) {
        log(`[TRANSACTION] No changes made (fn returned null/undefined), writing original DB back`);
        await write(currentDb, new Date().toISOString());
        log(`[TRANSACTION] ✅ Transaction completed (no changes)`);
        return undefined;
      }

      log(`[TRANSACTION] Writing updated DB...`);
      await write(updatedDb as Database, new Date().toISOString());
      log(`[TRANSACTION] ✅ Transaction #${transactionId} completed successfully`);
      return updatedDb as unknown as T;
    } catch (err) {
      const error = err as { code?: string; retryable?: boolean; message?: string };
      
      log(`[TRANSACTION] Error in attempt #${retries + 1}:`, error.code || error.message);

      if (error.code === 'CONFLICT' || error.retryable === true) {
        retries++;
        const delay = RETRY_BASE_DELAY * Math.pow(2, retries - 1);
        
        log(`[TRANSACTION] Retryable error, waiting ${delay}ms before retry #${retries + 1}`);

        if (retries >= MAX_RETRIES) {
          errorLog(`[TRANSACTION] ❌ Max retries exceeded after ${MAX_RETRIES} attempts`);
          throw {
            code: 'MAX_RETRIES_EXCEEDED',
            message: `Transaction failed after ${MAX_RETRIES} retries: ${error.message || 'Unknown error'}`,
          };
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      errorLog(`[TRANSACTION] ❌ Non-retryable error, aborting transaction`);
      throw err;
    }
  }

  throw {
    code: 'MAX_RETRIES_EXCEEDED',
    message: `Transaction failed after ${MAX_RETRIES} retries`,
  };
}

export { read, write, transaction };
