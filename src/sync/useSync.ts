import { useState, useEffect, useCallback } from 'react';
import { syncEngine } from './syncEngine';
import { SyncStatus, SyncResult } from './types';
import { logger } from '../shared/utils';

const TAG = 'useSync';

interface UseSyncResult {
  status: SyncStatus;
  lastResult: SyncResult | null;
  sync: () => Promise<SyncResult>;
  isSyncing: boolean;
}

export const useSync = (): UseSyncResult => {
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    // Subscribe to status changes
    const unsubscribe = syncEngine.addStatusListener(setStatus);
    return unsubscribe;
  }, []);

  const sync = useCallback(async (): Promise<SyncResult> => {
    logger.info(TAG, 'Manual sync triggered');
    const result = await syncEngine.sync();
    setLastResult(result);
    return result;
  }, []);

  const isSyncing = status === 'pulling' || status === 'pushing';

  return {
    status,
    lastResult,
    sync,
    isSyncing,
  };
};
