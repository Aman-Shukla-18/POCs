import AsyncStorage from '@react-native-async-storage/async-storage';
import { Q } from '@nozbe/watermelondb';
import { database, todosCollection, categoriesCollection, SCHEMA_VERSION } from '../db';
import { SyncTransport } from './transport';
import { consoleTransport } from './consoleTransport';
import { syncEventRepository } from './syncEventRepository';
import {
  SyncStatus,
  SyncResult,
  SyncChanges,
  RecordChange,
  ConflictInfo,
} from './types';
import {
  resolveLWWConflict,
  createConflictInfo,
} from './lwwResolver';
import { logger, nowMs } from '../shared/utils';

const TAG = 'SyncEngine';
const LAST_PULLED_AT_KEY = '@sync/lastPulledAt';

/**
 * SyncEngine - Orchestrates the synchronization process
 * 
 * Features:
 * - Two-phase sync (pull then push)
 * - Custom LWW conflict resolution
 * - Audit logging of all conflict resolutions
 * - Pluggable transport layer
 */
class SyncEngine {
  private transport: SyncTransport;
  private status: SyncStatus = 'idle';
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  constructor(transport: SyncTransport = consoleTransport) {
    this.transport = transport;
  }

  /**
   * Set a custom transport (e.g., for testing or production HTTP)
   */
  setTransport(transport: SyncTransport): void {
    this.transport = transport;
    logger.info(TAG, 'Transport updated');
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Subscribe to status changes
   */
  addStatusListener(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.listeners.forEach((listener) => listener(status));
  }

  /**
   * Get the last pulled at timestamp
   */
  async getLastPulledAt(): Promise<number | null> {
    try {
      const value = await AsyncStorage.getItem(LAST_PULLED_AT_KEY);
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      logger.error(TAG, 'Failed to get lastPulledAt:', error);
      return null;
    }
  }

  /**
   * Save the last pulled at timestamp
   */
  private async setLastPulledAt(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_PULLED_AT_KEY, String(timestamp));
    } catch (error) {
      logger.error(TAG, 'Failed to save lastPulledAt:', error);
    }
  }

  /**
   * Clear the last pulled at timestamp
   * Called on logout to ensure next user gets a full sync
   */
  async clearLastPulledAt(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LAST_PULLED_AT_KEY);
      logger.info(TAG, 'Cleared lastPulledAt - next sync will be a full sync');
    } catch (error) {
      logger.error(TAG, 'Failed to clear lastPulledAt:', error);
    }
  }

  /**
   * Fetch local changes that need to be pushed
   */
  private async fetchLocalChanges(): Promise<SyncChanges> {
    const changes: SyncChanges = {
      categories: { created: [], updated: [], deleted: [] },
      todos: { created: [], updated: [], deleted: [] },
    };

    // Get all records with pending changes
    const [categories, todos] = await Promise.all([
      categoriesCollection.query(Q.where('_status', Q.notEq('synced'))).fetch(),
      todosCollection.query(Q.where('_status', Q.notEq('synced'))).fetch(),
    ]);

    // Process categories
    for (const record of categories) {
      const raw = record._raw as any;
      const change: RecordChange = {
        id: record.id,
        title: raw.title,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
      };

      if (raw._status === 'created') {
        changes.categories.created.push(change);
      } else if (raw._status === 'updated') {
        changes.categories.updated.push(change);
      } else if (raw._status === 'deleted') {
        changes.categories.deleted.push(record.id);
      }
    }

    // Process todos
    for (const record of todos) {
      const raw = record._raw as any;
      const change: RecordChange = {
        id: record.id,
        title: raw.title,
        description: raw.description,
        is_completed: raw.is_completed,
        category_id: raw.category_id,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
      };

      if (raw._status === 'created') {
        changes.todos.created.push(change);
      } else if (raw._status === 'updated') {
        changes.todos.updated.push(change);
      } else if (raw._status === 'deleted') {
        changes.todos.deleted.push(record.id);
      }
    }

    return changes;
  }

  /**
   * Apply remote changes with LWW conflict resolution
   */
  private async applyRemoteChanges(
    remoteChanges: SyncChanges,
    _lastPulledAt: number | null
  ): Promise<{ applied: number; conflicts: number }> {
    let applied = 0;
    let conflicts = 0;

    await database.write(async () => {
      // Process each collection
      for (const [collectionName, tableChanges] of Object.entries(remoteChanges)) {
        const collection = collectionName === 'categories' 
          ? categoriesCollection 
          : collectionName === 'todos' 
            ? todosCollection 
            : null;

        if (!collection) continue;

        // Handle created records
        for (const remoteRecord of tableChanges.created) {
          try {
            // Check if record exists locally (conflict)
            const existingRecord = await collection.find(remoteRecord.id).catch(() => null);
            
            if (existingRecord) {
              // Conflict: record exists locally
              const localRaw = existingRecord._raw as any;
              const conflictInfo = createConflictInfo(
                collectionName,
                { id: existingRecord.id, updated_at: localRaw.updated_at },
                remoteRecord
              );
              const resolution = resolveLWWConflict(conflictInfo);
              
              // Log the conflict
              await syncEventRepository.logConflictResolution(conflictInfo, resolution);
              conflicts++;

              if (resolution.winner === 'remote') {
                // Apply remote record
                await existingRecord.update((r: any) => {
                  Object.entries(remoteRecord).forEach(([key, value]) => {
                    if (key !== 'id') {
                      r._raw[key] = value;
                    }
                  });
                });
                applied++;
              }
            } else {
              // No conflict: create new record
              await collection.create((r: any) => {
                r._raw.id = remoteRecord.id;
                Object.entries(remoteRecord).forEach(([key, value]) => {
                  if (key !== 'id') {
                    r._raw[key] = value;
                  }
                });
                r._raw._status = 'synced';
              });
              applied++;
            }
          } catch (error) {
            logger.error(TAG, `Failed to apply created record:`, error);
          }
        }

        // Handle updated records
        for (const remoteRecord of tableChanges.updated) {
          try {
            const existingRecord = await collection.find(remoteRecord.id).catch(() => null);
            
            if (existingRecord) {
              const localRaw = existingRecord._raw as any;
              
              // Check if local record was also modified
              if (localRaw._status !== 'synced') {
                // Conflict: both local and remote modified
                const conflictInfo = createConflictInfo(
                  collectionName,
                  { id: existingRecord.id, updated_at: localRaw.updated_at },
                  remoteRecord
                );
                const resolution = resolveLWWConflict(conflictInfo);
                
                await syncEventRepository.logConflictResolution(conflictInfo, resolution);
                conflicts++;

                if (resolution.winner === 'remote') {
                  await existingRecord.update((r: any) => {
                    Object.entries(remoteRecord).forEach(([key, value]) => {
                      if (key !== 'id') {
                        r._raw[key] = value;
                      }
                    });
                    r._raw._status = 'synced';
                  });
                  applied++;
                }
                // If local wins, keep local changes (they'll be pushed later)
              } else {
                // No conflict: apply remote update
                await existingRecord.update((r: any) => {
                  Object.entries(remoteRecord).forEach(([key, value]) => {
                    if (key !== 'id') {
                      r._raw[key] = value;
                    }
                  });
                });
                applied++;
              }
            }
          } catch (error) {
            logger.error(TAG, `Failed to apply updated record:`, error);
          }
        }

        // Handle deleted records
        for (const deletedId of tableChanges.deleted) {
          try {
            const existingRecord = await collection.find(deletedId).catch(() => null);
            
            if (existingRecord) {
              const localRaw = existingRecord._raw as any;
              
              if (localRaw._status !== 'synced') {
                // Conflict: local has changes but remote deleted
                // For deletes, we check timestamps too
                const remoteDeleteTime = nowMs(); // In real impl, server sends delete timestamp
                const localTime = localRaw.updated_at || 0;
                
                const conflictInfo: ConflictInfo = {
                  collection: collectionName,
                  recordId: deletedId,
                  localRecord: { id: deletedId, updated_at: localTime },
                  remoteRecord: { id: deletedId, updated_at: remoteDeleteTime, _deleted: true },
                  localUpdatedAt: localTime,
                  remoteUpdatedAt: remoteDeleteTime,
                };
                
                const resolution = resolveLWWConflict(conflictInfo);
                await syncEventRepository.logConflictResolution(conflictInfo, resolution);
                conflicts++;

                if (resolution.winner === 'remote') {
                  await existingRecord.destroyPermanently();
                  applied++;
                }
              } else {
                // No conflict: delete the record
                await existingRecord.destroyPermanently();
                applied++;
              }
            }
          } catch (error) {
            logger.error(TAG, `Failed to apply deleted record:`, error);
          }
        }
      }
    });

    return { applied, conflicts };
  }

  /**
   * Mark local changes as synced after successful push
   */
  private async markLocalChangesAsSynced(changes: SyncChanges): Promise<void> {
    await database.write(async () => {
      for (const [collectionName, tableChanges] of Object.entries(changes)) {
        const collection = collectionName === 'categories' 
          ? categoriesCollection 
          : collectionName === 'todos' 
            ? todosCollection 
            : null;

        if (!collection) continue;

        // Mark created and updated records as synced
        const recordIds = [
          ...tableChanges.created.map((r) => r.id),
          ...tableChanges.updated.map((r) => r.id),
        ];

        for (const id of recordIds) {
          try {
            const record = await collection.find(id);
            await record.update((r: any) => {
              r._raw._status = 'synced';
              r._raw._changed = '';
            });
          } catch {
            // Record might have been deleted in the meantime
            logger.debug(TAG, `Could not mark record as synced: ${id}`);
          }
        }

        // Permanently delete records marked as deleted
        for (const id of tableChanges.deleted) {
          try {
            const record = await collection.find(id);
            await record.destroyPermanently();
          } catch {
            // Already deleted
          }
        }
      }
    });
  }

  /**
   * Perform a full sync (pull + push)
   */
  async sync(): Promise<SyncResult> {
    if (this.status !== 'idle') {
      logger.warn(TAG, 'Sync already in progress');
      return {
        success: false,
        pulled: 0,
        pushed: 0,
        conflicts: 0,
        error: 'Sync already in progress',
      };
    }

    const startTime = nowMs();
    let pulled = 0;
    let pushed = 0;
    let conflicts = 0;

    try {
      // --- PULL PHASE ---
      this.setStatus('pulling');
      logger.info(TAG, 'Starting pull phase...');

      const lastPulledAt = await this.getLastPulledAt();
      
      const pullResponse = await this.transport.pullChanges({
        lastPulledAt,
        schemaVersion: SCHEMA_VERSION,
      });

      const applyResult = await this.applyRemoteChanges(
        pullResponse.changes,
        lastPulledAt
      );
      pulled = applyResult.applied;
      conflicts = applyResult.conflicts;

      // Save the new timestamp
      await this.setLastPulledAt(pullResponse.timestamp);
      logger.info(TAG, `Pull complete: ${pulled} applied, ${conflicts} conflicts`);

      // --- PUSH PHASE ---
      this.setStatus('pushing');
      logger.info(TAG, 'Starting push phase...');

      const localChanges = await this.fetchLocalChanges();
      
      // Count pushed items
      for (const tableChanges of Object.values(localChanges)) {
        pushed += tableChanges.created.length;
        pushed += tableChanges.updated.length;
        pushed += tableChanges.deleted.length;
      }

      if (pushed > 0) {
        const pushResponse = await this.transport.pushChanges({
          changes: localChanges,
          lastPulledAt: pullResponse.timestamp,
        });

        if (pushResponse.ok) {
          await this.markLocalChangesAsSynced(localChanges);
          logger.info(TAG, `Push complete: ${pushed} changes pushed`);
        } else {
          throw new Error(pushResponse.errors?.join(', ') || 'Push failed');
        }
      } else {
        logger.info(TAG, 'No local changes to push');
      }

      this.setStatus('idle');
      const duration = nowMs() - startTime;
      logger.info(TAG, `Sync complete in ${duration}ms`);

      return {
        success: true,
        pulled,
        pushed,
        conflicts,
      };
    } catch (error) {
      this.setStatus('error');
      const message = error instanceof Error ? error.message : 'Sync failed';
      logger.error(TAG, 'Sync failed:', error);

      // Reset to idle after error
      setTimeout(() => this.setStatus('idle'), 1000);

      return {
        success: false,
        pulled,
        pushed,
        conflicts,
        error: message,
      };
    }
  }
}

// Default singleton instance
export const syncEngine = new SyncEngine();
