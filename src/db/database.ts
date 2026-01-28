import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema, SCHEMA_VERSION } from './schema';
import { migrations } from './migrations';
import { modelClasses } from './models';
import { logger } from '../shared/utils';

const TAG = 'Database';

// Create the SQLite adapter
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'watermelonTodoPOC',
  jsi: true, // Use JSI for better performance (recommended for RN 0.70+)
  onSetUpError: (error) => {
    logger.error(TAG, 'Database setup error:', error);
  },
});

// Create the database instance
export const database = new Database({
  adapter,
  modelClasses: modelClasses as any,
});

// Convenience getters for each collection
export const categoriesCollection = database.get('categories');
export const todosCollection = database.get('todos');
export const syncEventsCollection = database.get('sync_events');

/**
 * Reset/clear all data from the local database
 * Called on user logout to ensure new user gets fresh data
 */
export const resetDatabase = async (): Promise<void> => {
  logger.info(TAG, 'Resetting database - clearing all local data...');
  
  try {
    await database.write(async () => {
      // Delete all records from each collection
      const allCategories = await categoriesCollection.query().fetch();
      const allTodos = await todosCollection.query().fetch();
      const allSyncEvents = await syncEventsCollection.query().fetch();
      
      // Permanently delete all records
      for (const record of allCategories) {
        await record.destroyPermanently();
      }
      for (const record of allTodos) {
        await record.destroyPermanently();
      }
      for (const record of allSyncEvents) {
        await record.destroyPermanently();
      }
    });
    
    logger.info(TAG, 'Database reset complete - all local data cleared');
  } catch (error) {
    logger.error(TAG, 'Failed to reset database:', error);
    throw error;
  }
};

logger.info(TAG, `Database initialized with schema version ${SCHEMA_VERSION}`);
