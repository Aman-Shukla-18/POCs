import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
// Future migrations may use: createTable, addColumns, etc.
// import { createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Database migrations for WatermelonDB
 * 
 * When you need to update the schema:
 * 1. Increment SCHEMA_VERSION in schema.ts
 * 2. Add a new migration entry here with toVersion matching the new schema version
 * 3. Include all necessary table/column changes in the migration steps
 */
export const migrations = schemaMigrations({
  migrations: [
    // Version 1 is the initial schema - no migrations needed
    // Add future migrations here as the schema evolves
    // Example:
    // {
    //   toVersion: 2,
    //   steps: [
    //     addColumns({
    //       table: 'todos',
    //       columns: [
    //         { name: 'priority', type: 'number', isOptional: true },
    //       ],
    //     }),
    //   ],
    // },
  ],
});
