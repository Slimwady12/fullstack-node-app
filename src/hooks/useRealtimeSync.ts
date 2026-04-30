import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Database } from '../types/db';

interface UseRealtimeSyncResult {
  data: Database | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  lastSync: string | null;
}

const POLL_INTERVAL = 500;
const MAX_RETRY_BACKOFF = 5000;
const DEBOUNCE_DELAY = 200;
const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api` 
  : '/api';

export function useRealtimeSync(): UseRealtimeSyncResult {
  const [data, setData] = useState<Database | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const lastModifiedRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const retryBackoffRef = useRef<number>(POLL_INTERVAL);
  const isMountedRef = useRef<boolean>(true);

  const fetchData = useCallback(async (force: boolean = false) => {
    if (!isMountedRef.current) return;

    try {
      const timestamp = Date.now();
      const response = await axios.get(`${API_BASE}/db/read`, {
        params: { t: timestamp },
        timeout: 10000,
      });

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error || 'Failed to fetch data');
      }

      const fetchedData: Database = response.data.data;
      const currentModified = JSON.stringify(fetchedData);

      if (force || lastModifiedRef.current !== currentModified) {
        if (isMountedRef.current) {
          setData(fetchedData);
          lastModifiedRef.current = currentModified;
          setLastSync(new Date().toISOString());
        }
      }

      retryBackoffRef.current = POLL_INTERVAL;

      if (isMountedRef.current) {
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const message = err instanceof Error ? err.message : 'Failed to sync data';
        setError(message);
        setLoading(false);

        retryBackoffRef.current = Math.min(retryBackoffRef.current * 2, MAX_RETRY_BACKOFF);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const debouncedFetch = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(() => {
        fetchData(false);
      }, DEBOUNCE_DELAY);
    };

    debouncedFetch();

    pollIntervalRef.current = window.setInterval(() => {
      debouncedFetch();
    }, retryBackoffRef.current);

    return () => {
      isMountedRef.current = false;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchData]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchData(true);
    }
  }, [refreshTrigger, fetchData]);

  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return { data, loading, error, refresh, lastSync };
}
