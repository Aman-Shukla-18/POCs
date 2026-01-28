import {
  PullChangesParams,
  PullChangesResponse,
  PushChangesParams,
  PushChangesResponse,
} from './types';

/**
 * SyncTransport interface - abstraction layer for sync communication
 * 
 * This interface allows swapping between different backends:
 * - ConsoleTransport (POC - logs to console)
 * - HttpTransport (production - real API calls)
 * - MockTransport (testing)
 */
export interface SyncTransport {
  /**
   * Pull changes from the remote server
   * @param params - Contains lastPulledAt timestamp and schema version
   * @returns Promise with changes and new server timestamp
   */
  pullChanges(params: PullChangesParams): Promise<PullChangesResponse>;

  /**
   * Push local changes to the remote server
   * @param params - Contains local changes and lastPulledAt for conflict detection
   * @returns Promise with success status
   */
  pushChanges(params: PushChangesParams): Promise<PushChangesResponse>;
}
