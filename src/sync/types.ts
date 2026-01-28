/**
 * Types for the sync system
 */

// Record change for a single item
export interface RecordChange {
  id: string;
  [key: string]: unknown;
}

// Changes for a single table/collection
export interface TableChanges {
  created: RecordChange[];
  updated: RecordChange[];
  deleted: string[]; // just IDs for deleted records
}

// All changes grouped by table name
export interface SyncChanges {
  [tableName: string]: TableChanges;
}

// Pull response from server
export interface PullChangesResponse {
  changes: SyncChanges;
  timestamp: number; // server timestamp (Unix ms)
}

// Pull request params
export interface PullChangesParams {
  lastPulledAt: number | null;
  schemaVersion: number;
}

// Push request params
export interface PushChangesParams {
  changes: SyncChanges;
  lastPulledAt: number | null;
}

// Push response from server
export interface PushChangesResponse {
  ok: boolean;
  errors?: string[];
}

// Conflict info for LWW resolution
export interface ConflictInfo {
  collection: string;
  recordId: string;
  localRecord: RecordChange;
  remoteRecord: RecordChange;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
}

// Conflict resolution result
export interface ConflictResolution {
  winner: 'local' | 'remote';
  reason: string;
  resolvedRecord: RecordChange;
}

// Sync status
export type SyncStatus = 'idle' | 'pulling' | 'pushing' | 'error';

// Sync result
export interface SyncResult {
  success: boolean;
  pulled: number;
  pushed: number;
  conflicts: number;
  error?: string;
}
