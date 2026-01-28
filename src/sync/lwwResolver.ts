import {
  ConflictInfo,
  ConflictResolution,
  RecordChange,
} from './types';

/**
 * Last-Write-Wins (LWW) Conflict Resolver
 * 
 * This module provides pure functions for resolving conflicts using
 * a timestamp-based last-write-wins strategy.
 * 
 * Key principles:
 * 1. The record with the most recent updated_at timestamp wins
 * 2. In case of exact timestamp tie, remote wins (server authority)
 * 3. All conflict resolutions are logged for audit purposes
 */

/**
 * Resolves a conflict between local and remote records using LWW
 */
export function resolveLWWConflict(conflict: ConflictInfo): ConflictResolution {
  const { localUpdatedAt, remoteUpdatedAt, localRecord, remoteRecord } = conflict;

  // Compare timestamps - the most recent one wins
  if (localUpdatedAt > remoteUpdatedAt) {
    return {
      winner: 'local',
      reason: `Local timestamp (${localUpdatedAt}) is newer than remote (${remoteUpdatedAt})`,
      resolvedRecord: localRecord,
    };
  }

  if (remoteUpdatedAt > localUpdatedAt) {
    return {
      winner: 'remote',
      reason: `Remote timestamp (${remoteUpdatedAt}) is newer than local (${localUpdatedAt})`,
      resolvedRecord: remoteRecord,
    };
  }

  // Exact tie - remote wins (server authority)
  return {
    winner: 'remote',
    reason: `Timestamps equal (${localUpdatedAt}). Remote wins by server authority.`,
    resolvedRecord: remoteRecord,
  };
}

/**
 * Extracts the updated_at timestamp from a record
 */
export function getRecordTimestamp(record: RecordChange): number {
  const timestamp = record.updated_at ?? record.updatedAt ?? 0;
  return typeof timestamp === 'number' ? timestamp : 0;
}

/**
 * Checks if two records have conflicting changes
 * A conflict exists when both local and remote have been modified
 */
export function hasConflict(
  localRecord: RecordChange | undefined,
  remoteRecord: RecordChange | undefined,
  baseTimestamp: number
): boolean {
  if (!localRecord || !remoteRecord) {
    return false;
  }

  const localTimestamp = getRecordTimestamp(localRecord);
  const remoteTimestamp = getRecordTimestamp(remoteRecord);

  // Both have been modified since base timestamp
  return localTimestamp > baseTimestamp && remoteTimestamp > baseTimestamp;
}

/**
 * Merges two records using LWW for each field
 * This provides a more granular conflict resolution at field level
 */
export function mergeRecordsFieldLevel(
  localRecord: RecordChange,
  remoteRecord: RecordChange,
  localTimestamp: number,
  remoteTimestamp: number
): RecordChange {
  // For simplicity in POC, we use record-level LWW
  // Field-level merge would track per-field timestamps
  
  if (localTimestamp >= remoteTimestamp) {
    return { ...remoteRecord, ...localRecord };
  }
  return { ...localRecord, ...remoteRecord };
}

/**
 * Creates a conflict info object for logging/auditing
 */
export function createConflictInfo(
  collection: string,
  localRecord: RecordChange,
  remoteRecord: RecordChange
): ConflictInfo {
  return {
    collection,
    recordId: String(localRecord.id),
    localRecord,
    remoteRecord,
    localUpdatedAt: getRecordTimestamp(localRecord),
    remoteUpdatedAt: getRecordTimestamp(remoteRecord),
  };
}

/**
 * Batch resolve conflicts for multiple records
 */
export function resolveConflicts(
  conflicts: ConflictInfo[]
): Map<string, ConflictResolution> {
  const results = new Map<string, ConflictResolution>();

  for (const conflict of conflicts) {
    const resolution = resolveLWWConflict(conflict);
    results.set(conflict.recordId, resolution);
  }

  return results;
}
