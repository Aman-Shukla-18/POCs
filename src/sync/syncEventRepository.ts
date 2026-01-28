import { database, syncEventsCollection } from '../db';
import SyncEvent, { ConflictWinner } from '../db/models/SyncEvent';
import { generateId, nowMs, logger } from '../shared/utils';
import { ConflictResolution, ConflictInfo } from './types';

const TAG = 'SyncEventRepository';

export interface CreateSyncEventInput {
  collectionName: string;
  recordId: string;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  winner: ConflictWinner;
  reason: string;
}

class SyncEventRepository {
  /**
   * Log a conflict resolution event for auditing
   */
  async logConflictResolution(
    conflictInfo: ConflictInfo,
    resolution: ConflictResolution
  ): Promise<SyncEvent> {
    const now = nowMs();

    try {
      const syncEvent = await database.write(async () => {
        const event = await syncEventsCollection.create((e: any) => {
          e._raw.id = generateId();
          e.collectionName = conflictInfo.collection;
          e.recordId = conflictInfo.recordId;
          e.localUpdatedAt = conflictInfo.localUpdatedAt;
          e.remoteUpdatedAt = conflictInfo.remoteUpdatedAt;
          e.winner = resolution.winner;
          e.reason = resolution.reason;
          e._raw.created_at = now;
        });
        return event;
      });

      logger.info(TAG, `Logged conflict resolution: ${conflictInfo.collection}/${conflictInfo.recordId} -> ${resolution.winner}`);
      return syncEvent as unknown as SyncEvent;
    } catch (error) {
      logger.error(TAG, 'Failed to log conflict resolution:', error);
      throw error;
    }
  }

  /**
   * Get all sync events for a specific record
   */
  async getEventsForRecord(collectionName: string, recordId: string): Promise<SyncEvent[]> {
    try {
      const events = await syncEventsCollection
        .query()
        .fetch();
      
      // Filter in JS since we need compound condition
      return (events as unknown as SyncEvent[]).filter(
        (e) => e.collectionName === collectionName && e.recordId === recordId
      );
    } catch (error) {
      logger.error(TAG, 'Failed to fetch sync events:', error);
      throw error;
    }
  }

  /**
   * Get recent sync events for debugging/monitoring
   */
  async getRecentEvents(limit: number = 50): Promise<SyncEvent[]> {
    try {
      const events = await syncEventsCollection
        .query()
        .fetch();
      
      // Sort by created_at desc and limit
      return (events as unknown as SyncEvent[])
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    } catch (error) {
      logger.error(TAG, 'Failed to fetch recent sync events:', error);
      throw error;
    }
  }

  /**
   * Clear old sync events (for maintenance)
   */
  async clearOldEvents(olderThanMs: number): Promise<number> {
    try {
      const cutoff = nowMs() - olderThanMs;
      const events = await syncEventsCollection.query().fetch();
      const oldEvents = (events as unknown as SyncEvent[]).filter(
        (e) => e.createdAt < cutoff
      );

      await database.write(async () => {
        for (const event of oldEvents) {
          await event.destroyPermanently();
        }
      });

      logger.info(TAG, `Cleared ${oldEvents.length} old sync events`);
      return oldEvents.length;
    } catch (error) {
      logger.error(TAG, 'Failed to clear old sync events:', error);
      throw error;
    }
  }
}

export const syncEventRepository = new SyncEventRepository();
