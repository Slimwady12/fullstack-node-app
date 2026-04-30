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

async function read(): Promise<ReadResponse> {
  const timestamp = Date.now();

  try {
    const response = await axios.get(`${API_BASE}/db/read`, {
      params: { t: timestamp },
      timeout: 10000,
    });

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || 'Failed to read database');
    }

    return {
      data: response.data.data as Database,
      lastModified: new Date().toISOString(),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;

      if (status === 404) {
        throw { code: 'DB_NOT_FOUND', message };
      }

      if (status === 500) {
        throw { code: 'DB_READ_ERROR', message };
      }
    }

    throw {
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown network error',
    };
  }
}

async function write(data: Database, lastModified: string): Promise<void> {
  const payload: WritePayload = { data, lastModified };

  try {
    const response = await axios.post(`${API_BASE}/db/write`, payload, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || 'Failed to write database');
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;

      if (status === 409) {
        throw { code: 'CONFLICT', message: 'Database was modified by another process', retryable: true };
      }

      if (status === 400) {
        throw { code: 'VALIDATION_ERROR', message, retryable: false };
      }

      if (status === 500) {
        throw { code: 'DB_WRITE_ERROR', message, retryable: true };
      }
    }

    throw {
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown network error',
      retryable: true,
    };
  }
}

async function transaction<T>(fn: (db: Database) => Database | Promise<Database>): Promise<T | void> {
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const { data: currentDb } = await read();

      const result = fn(currentDb);
      const updatedDb = result instanceof Promise ? await result : result;

      if (updatedDb === undefined || updatedDb === null) {
        await write(currentDb, new Date().toISOString());
        return undefined;
      }

      await write(updatedDb as Database, new Date().toISOString());
      return updatedDb as unknown as T;
    } catch (error) {
      const err = error as { code?: string; retryable?: boolean; message?: string };

      if (err.code === 'CONFLICT' || err.retryable === true) {
        retries++;
        const delay = RETRY_BASE_DELAY * Math.pow(2, retries - 1);

        if (retries >= MAX_RETRIES) {
          throw {
            code: 'MAX_RETRIES_EXCEEDED',
            message: `Transaction failed after ${MAX_RETRIES} retries: ${err.message || 'Unknown error'}`,
          };
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw {
    code: 'MAX_RETRIES_EXCEEDED',
    message: `Transaction failed after ${MAX_RETRIES} retries`,
  };
}

export { read, write, transaction };
