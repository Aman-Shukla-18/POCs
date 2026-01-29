# Database Layer Documentation (`src/db/`)

This document explains every file in the `src/db/` directory in detail. It's designed to help junior developers understand how WatermelonDB works in this project.

---

## Table of Contents
1. [What is WatermelonDB?](#what-is-watermelondb)
2. [File Overview](#file-overview)
3. [schema.ts - Database Schema Definition](#schemats---database-schema-definition)
4. [models/ - Data Models](#models---data-models)
   - [Category.ts](#categoryts)
   - [Todo.ts](#todots)
   - [SyncEvent.ts](#synceventts)
   - [models/index.ts](#modelsindexts)
5. [database.ts - Database Instance](#databasets---database-instance)
6. [migrations.ts - Schema Migrations](#migrationsts---schema-migrations)
7. [DatabaseProvider.tsx - React Context](#databaseprovidertsx---react-context)
8. [index.ts - Barrel Export](#indexts---barrel-export)
9. [How It All Connects](#how-it-all-connects)
10. [Common Operations Examples](#common-operations-examples)

---

## What is WatermelonDB?

**WatermelonDB** is a high-performance database for React Native apps. Think of it as a local SQLite database that:
- Stores data on the user's device
- Works offline (no internet needed)
- Can sync with a remote server
- Is very fast (uses lazy loading)

**Analogy:** Imagine WatermelonDB as a notebook you carry everywhere. You write notes in it (offline), and later when you have wifi, you sync those notes to Google Drive (remote server).

---

## File Overview

```
src/db/
├── schema.ts              # Defines table structures (like CREATE TABLE in SQL)
├── database.ts            # Creates the actual database instance
├── DatabaseProvider.tsx   # Makes database available to React components
├── migrations.ts          # Handles schema changes over time
├── index.ts               # Exports everything for easy imports
└── models/
    ├── Category.ts        # Category data model (class)
    ├── Todo.ts            # Todo data model (class)
    ├── SyncEvent.ts       # Sync audit log model (class)
    └── index.ts           # Exports all models
```

---

## schema.ts - Database Schema Definition

**Purpose:** Defines what tables exist and what columns each table has. This is like writing `CREATE TABLE` statements in SQL.

### Full Code with Explanations

```typescript
// Line 1: Import functions from WatermelonDB to create schemas
import { appSchema, tableSchema } from '@nozbe/watermelondb';

// Line 3: Version number - increment this when you change the schema
// Think of it like a "save version" for your database structure
export const SCHEMA_VERSION = 1;

// Line 5-40: Define the entire database schema
export const schema = appSchema({
  version: SCHEMA_VERSION,  // Must match SCHEMA_VERSION above
  tables: [
    
    // ═══════════════════════════════════════════════════════════
    // TABLE 1: categories
    // ═══════════════════════════════════════════════════════════
    tableSchema({
      name: 'categories',  // Table name (like "CREATE TABLE categories")
      columns: [
        // Column: title (required string)
        // Example value: "Work", "Personal", "Shopping"
        { name: 'title', type: 'string' },
        
        // Column: created_at (timestamp as number)
        // Example value: 1706450000000 (milliseconds since 1970)
        { name: 'created_at', type: 'number' },
        
        // Column: updated_at (timestamp as number)
        // Updated every time the record changes
        { name: 'updated_at', type: 'number' },
      ],
    }),
    
    // ═══════════════════════════════════════════════════════════
    // TABLE 2: todos
    // ═══════════════════════════════════════════════════════════
    tableSchema({
      name: 'todos',
      columns: [
        // Column: title (required string)
        // Example: "Buy groceries"
        { name: 'title', type: 'string' },
        
        // Column: description (optional string)
        // isOptional: true means this can be NULL/empty
        // Example: "Milk, eggs, bread"
        { name: 'description', type: 'string', isOptional: true },
        
        // Column: is_completed (boolean - true/false)
        // Example: false (not done), true (done)
        { name: 'is_completed', type: 'boolean' },
        
        // Column: category_id (foreign key to categories table)
        // isOptional: true means a todo doesn't NEED a category
        // isIndexed: true means faster lookups by category_id
        { name: 'category_id', type: 'string', isOptional: true, isIndexed: true },
        
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    
    // ═══════════════════════════════════════════════════════════
    // TABLE 3: sync_events (Audit log for sync conflicts)
    // ═══════════════════════════════════════════════════════════
    tableSchema({
      name: 'sync_events',
      columns: [
        // Which table had the conflict? "categories" or "todos"
        { name: 'collection_name', type: 'string', isIndexed: true },
        
        // ID of the record that had a conflict
        { name: 'record_id', type: 'string', isIndexed: true },
        
        // Timestamps to compare
        { name: 'local_updated_at', type: 'number' },
        { name: 'remote_updated_at', type: 'number' },
        
        // Who won? "local" or "remote"
        { name: 'winner', type: 'string' },
        
        // Human-readable explanation
        // Example: "Local timestamp (1000) > remote (900)"
        { name: 'reason', type: 'string' },
        
        { name: 'created_at', type: 'number' },
      ],
    }),
  ],
});
```

### Column Types in WatermelonDB

| Type | JavaScript Equivalent | Example |
|------|----------------------|---------|
| `'string'` | `string` | `"Hello"`, `"abc-123"` |
| `'number'` | `number` | `42`, `1706450000000` |
| `'boolean'` | `boolean` | `true`, `false` |

### Column Options

| Option | Meaning | Example |
|--------|---------|---------|
| `isOptional: true` | Column can be NULL | `description` can be empty |
| `isIndexed: true` | Creates database index for faster queries | `category_id` for quick lookups |

---

## models/ - Data Models

Models are **TypeScript classes** that represent rows in your database tables. They define:
1. Which table they belong to
2. How to read/write column values
3. Relationships with other tables

### Category.ts

**Purpose:** Represents a single category (e.g., "Work", "Personal").

```typescript
// Line 1: Import the base Model class from WatermelonDB
import { Model } from '@nozbe/watermelondb';

// Line 2: Import decorators - these are special annotations that tell
// WatermelonDB how to handle each property
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';

// Line 3: Import type for defining relationships
import type { Associations } from '@nozbe/watermelondb/Model';

// Line 5: Define the Category class - it MUST extend Model
export default class Category extends Model {
  
  // Line 6: Tell WatermelonDB which table this model uses
  // This MUST match the table name in schema.ts
  static table = 'categories';

  // Line 8-10: Define relationships with other tables
  // This category "has many" todos (one-to-many relationship)
  static associations: Associations = {
    todos: { type: 'has_many', foreignKey: 'category_id' },
  };
  //   ↑ Table name    ↑ Relationship type   ↑ Column in todos table

  // Line 12: @field decorator maps this property to a database column
  // 'title' = column name in the database
  // title = property name in TypeScript (can be different!)
  // The "!" means this property will always have a value (not null)
  @field('title') title!: string;
  
  // Line 13: @readonly means this value can only be set once (on create)
  // @date converts the number timestamp to a JavaScript Date object
  @readonly @date('created_at') createdAt!: number;
  
  // Line 14: @date without @readonly - can be updated
  @date('updated_at') updatedAt!: number;

  // Line 16: @children creates a query to fetch related todos
  // When you access category.todos, it returns all todos with this category's ID
  @children('todos') todos: any;
}
```

### Visual Example: Category

```
Database Row:
┌────────────────────────────────────────────────────────────┐
│ id          │ title      │ created_at      │ updated_at    │
├────────────────────────────────────────────────────────────┤
│ "abc-123"   │ "Work"     │ 1706450000000   │ 1706450000000 │
└────────────────────────────────────────────────────────────┘

TypeScript Object:
const category = {
  id: "abc-123",           // Auto-generated by WatermelonDB
  title: "Work",           // @field('title')
  createdAt: 1706450000000 // @readonly @date('created_at')
  updatedAt: 1706450000000 // @date('updated_at')
  todos: [/* Query to get related todos */]
}
```

---

### Todo.ts

**Purpose:** Represents a single todo item.

```typescript
// Line 1: Import Model and Relation types
import { Model, Relation } from '@nozbe/watermelondb';

// Line 2: Import decorators
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

import type { Associations } from '@nozbe/watermelondb/Model';

// Line 4: Import Category model for the relationship type
import Category from './Category';

export default class Todo extends Model {
  // Line 7: Table name - must match schema.ts
  static table = 'todos';

  // Line 9-11: This todo "belongs to" a category (many-to-one)
  static associations: Associations = {
    categories: { type: 'belongs_to', key: 'category_id' },
  };
  //   ↑ Table name    ↑ Relationship      ↑ Column that stores the foreign key

  // Line 13: Regular string field
  @field('title') title!: string;
  
  // Line 14: Optional field (? means it can be undefined)
  @field('description') description?: string;
  
  // Line 15: Boolean field
  @field('is_completed') isCompleted!: boolean;
  
  // Line 16: Foreign key field (stores the category's ID)
  @field('category_id') categoryId?: string;
  
  // Line 17-18: Timestamp fields
  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;

  // Line 20: @relation creates a way to fetch the related category
  // First param: table to look in ('categories')
  // Second param: which column has the foreign key ('category_id')
  @relation('categories', 'category_id') category!: Relation<Category>;
}
```

### Visual Example: Todo with Relationship

```
todos table:
┌──────────────────────────────────────────────────────────────────────┐
│ id        │ title           │ is_completed │ category_id  │ ...      │
├──────────────────────────────────────────────────────────────────────┤
│ "todo-1"  │ "Buy groceries" │ false        │ "cat-abc"    │          │
│ "todo-2"  │ "Finish report" │ true         │ "cat-xyz"    │          │
│ "todo-3"  │ "Call mom"      │ false        │ NULL         │          │
└──────────────────────────────────────────────────────────────────────┘

categories table:
┌────────────────────────────────────────┐
│ id        │ title      │ ...           │
├────────────────────────────────────────┤
│ "cat-abc" │ "Shopping" │               │
│ "cat-xyz" │ "Work"     │               │
└────────────────────────────────────────┘

When you do: todo1.category.fetch()
→ Returns the Category object with id="cat-abc" (Shopping)
```

---

### SyncEvent.ts

**Purpose:** Logs every sync conflict for debugging and auditing.

```typescript
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

// Line 4: TypeScript union type - winner can ONLY be "local" or "remote"
export type ConflictWinner = 'local' | 'remote';

export default class SyncEvent extends Model {
  static table = 'sync_events';

  // Which table had the conflict? "categories" or "todos"
  @field('collection_name') collectionName!: string;
  
  // Which record's ID had the conflict?
  @field('record_id') recordId!: string;
  
  // What was the local record's timestamp?
  @field('local_updated_at') localUpdatedAt!: number;
  
  // What was the remote record's timestamp?
  @field('remote_updated_at') remoteUpdatedAt!: number;
  
  // Who won the conflict?
  @field('winner') winner!: ConflictWinner;
  
  // Human-readable explanation
  @field('reason') reason!: string;
  
  // When was this conflict logged?
  @readonly @date('created_at') createdAt!: number;
}
```

### Visual Example: Sync Conflict

```
Scenario: User edits "Buy milk" on phone, someone else edits on web

Phone (local):  { id: "todo-1", title: "Buy almond milk", updated_at: 1000 }
Server (remote): { id: "todo-1", title: "Buy oat milk",    updated_at: 900  }

Since 1000 > 900, LOCAL WINS!

SyncEvent created:
┌────────────────────────────────────────────────────────────────────────────┐
│ collection_name │ record_id │ local_updated_at │ remote_updated_at │ winner│
├────────────────────────────────────────────────────────────────────────────┤
│ "todos"         │ "todo-1"  │ 1000             │ 900               │ "local"│
└────────────────────────────────────────────────────────────────────────────┘
```

---

### models/index.ts

**Purpose:** Barrel file that exports all models in one place.

```typescript
// Line 1-3: Import each model class
import Category from './Category';
import Todo from './Todo';
import SyncEvent from './SyncEvent';

// Line 5: Re-export for named imports
// Usage: import { Category, Todo } from './models';
export { Category, Todo, SyncEvent };

// Line 7: Export as array - WatermelonDB needs this to register all models
// This array is passed to the Database constructor
export const modelClasses = [Category, Todo, SyncEvent];
```

---

## database.ts - Database Instance

**Purpose:** Creates and configures the actual WatermelonDB instance.

```typescript
// Line 1: Import the main Database class
import { Database } from '@nozbe/watermelondb';

// Line 2: Import SQLite adapter - this connects WatermelonDB to SQLite
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

// Line 4-6: Import our schema, migrations, and models
import { schema, SCHEMA_VERSION } from './schema';
import { migrations } from './migrations';
import { modelClasses } from './models';
import { logger } from '../shared/utils';

// Line 9: Tag for log messages
const TAG = 'Database';

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Create the SQLite Adapter
// The adapter is the "bridge" between WatermelonDB and the actual SQLite file
// ═══════════════════════════════════════════════════════════════════════════
const adapter = new SQLiteAdapter({
  schema,                           // Our table definitions from schema.ts
  migrations,                       // How to upgrade old databases
  dbName: 'watermelonTodoPOC',     // File name: watermelonTodoPOC.db
  jsi: true,                        // Use JSI for better performance
  onSetUpError: (error) => {        // Called if database setup fails
    logger.error(TAG, 'Database setup error:', error);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Create the Database Instance
// This is the main object you'll use to interact with data
// ═══════════════════════════════════════════════════════════════════════════
export const database = new Database({
  adapter,                          // The SQLite adapter from above
  modelClasses: modelClasses as any, // Register all our model classes
});

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: Create Collection References
// Collections are like "tables" - you use them to query and create records
// ═══════════════════════════════════════════════════════════════════════════
export const categoriesCollection = database.get('categories');
export const todosCollection = database.get('todos');
export const syncEventsCollection = database.get('sync_events');

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: Reset Database Function
// Called when user logs out to clear all local data
// ═══════════════════════════════════════════════════════════════════════════
export const resetDatabase = async (): Promise<void> => {
  logger.info(TAG, 'Resetting database - clearing all local data...');
  
  try {
    // database.write() wraps everything in a transaction
    // All changes happen together (atomically)
    await database.write(async () => {
      
      // Fetch ALL records from each table
      const allCategories = await categoriesCollection.query().fetch();
      const allTodos = await todosCollection.query().fetch();
      const allSyncEvents = await syncEventsCollection.query().fetch();
      
      // Delete each record permanently
      // destroyPermanently() removes from DB (not soft delete)
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

// This runs when the file is first imported
logger.info(TAG, `Database initialized with schema version ${SCHEMA_VERSION}`);
```

### Key Concepts Explained

**1. Adapter:**
```
┌─────────────────────┐
│    Your App Code    │
└──────────┬──────────┘
           │ Uses database.get(), .create(), etc.
           ▼
┌─────────────────────┐
│    WatermelonDB     │
└──────────┬──────────┘
           │ Talks to adapter
           ▼
┌─────────────────────┐
│   SQLiteAdapter     │  ← This is what we created
└──────────┬──────────┘
           │ Reads/writes
           ▼
┌─────────────────────┐
│   SQLite Database   │  ← Actual file on device
│ (watermelonTodoPOC.db)
└─────────────────────┘
```

**2. Collections:**
```typescript
// Think of collections like this:
const categoriesCollection = database.get('categories');

// categoriesCollection lets you:
// - Query: categoriesCollection.query().fetch()
// - Create: categoriesCollection.create(...)
// - Find by ID: categoriesCollection.find(id)
```

**3. database.write():**
```typescript
// WHY do we need database.write()?
// WatermelonDB requires ALL write operations to be wrapped in database.write()
// This ensures data integrity (like a transaction in SQL)

// ❌ WRONG - This will throw an error
await record.update(r => { r.title = 'New Title' });

// ✅ CORRECT
await database.write(async () => {
  await record.update(r => { r.title = 'New Title' });
});
```

---

## migrations.ts - Schema Migrations

**Purpose:** Handles database upgrades when you change the schema.

**Analogy:** Imagine you have a notebook (database) with columns. Later, you want to add a new column. Migration is like adding that column to an existing notebook without losing any notes.

```typescript
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';
// Uncomment these when you need them:
// import { createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // Currently empty because we're on version 1 (initial)
    
    // ═══════════════════════════════════════════════════════════
    // EXAMPLE: Adding a "priority" column to todos in version 2
    // ═══════════════════════════════════════════════════════════
    // {
    //   toVersion: 2,  // This migration upgrades TO version 2
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
```

### How Migrations Work

```
User has app with schema version 1
↓
User updates app (new version has schema version 2)
↓
WatermelonDB sees: "Database is v1, schema is v2"
↓
Runs all migrations from v1 → v2
↓
Database is now v2
```

### When to Add a Migration

| Change | Migration Needed? |
|--------|-------------------|
| Add new column | YES - use `addColumns` |
| Add new table | YES - use `createTable` |
| Remove column | NO - just remove from schema (data stays but ignored) |
| Change column type | Tricky - may need custom migration |

---

## DatabaseProvider.tsx - React Context

**Purpose:** Makes the database available to any React component using React Context.

```typescript
// Line 1: Import React hooks for Context
import React, { createContext, useContext, ReactNode } from 'react';

// Line 2: Import Database type for TypeScript
import { Database } from '@nozbe/watermelondb';

// Line 3: Import our database instance
import { database } from './database';

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Create a Context
// Context is like a "global variable" for React components
// ═══════════════════════════════════════════════════════════════════════════
const DatabaseContext = createContext<Database | null>(null);
//                                    ↑ Type can be Database or null

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Create the Provider Component
// This wraps your app and provides the database to all children
// ═══════════════════════════════════════════════════════════════════════════
interface DatabaseProviderProps {
  children: ReactNode;  // ReactNode = any valid JSX
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  return (
    // Provide the database instance to all children
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: Create the Hook
// Components use this hook to access the database
// ═══════════════════════════════════════════════════════════════════════════
export const useDatabase = (): Database => {
  const db = useContext(DatabaseContext);  // Get value from context
  
  // Safety check - if someone uses the hook outside the provider, crash early
  if (!db) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  
  return db;
};
```

### How It's Used in the App

```tsx
// In App.tsx - Wrap the entire app
function App() {
  return (
    <DatabaseProvider>           {/* ← Provides database */}
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </DatabaseProvider>
  );
}

// In any component - Access the database
function TodoList() {
  const database = useDatabase();  // ← Gets the database
  
  // Now you can use it
  const todos = await database.get('todos').query().fetch();
}
```

### Visual Flow

```
<DatabaseProvider value={database}>     ← Wraps entire app
  │
  ├── <LoginScreen />
  │
  ├── <TodosList />                     ← Uses useDatabase()
  │     │
  │     └── const db = useDatabase()    ← Gets 'database' from context
  │
  └── <CategoryScreen />                ← Uses useDatabase()
        │
        └── const db = useDatabase()    ← Same 'database' instance
```

---

## index.ts - Barrel Export

**Purpose:** Single entry point to import anything from the `db/` folder.

```typescript
// Export everything from database.ts
export { 
  database,                 // The main database instance
  categoriesCollection,     // Quick access to categories table
  todosCollection,          // Quick access to todos table
  syncEventsCollection,     // Quick access to sync_events table
  resetDatabase            // Function to clear all data
} from './database';

// Export schema-related items
export { schema, SCHEMA_VERSION } from './schema';

// Export migrations
export { migrations } from './migrations';

// Export models
export { Category, Todo, SyncEvent, modelClasses } from './models';
```

### Why Barrel Files?

```typescript
// ❌ WITHOUT barrel file - ugly imports
import { database } from '../db/database';
import { schema } from '../db/schema';
import { Category } from '../db/models/Category';

// ✅ WITH barrel file - clean single import
import { database, schema, Category } from '../db';
```

---

## How It All Connects

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APP STARTUP                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. schema.ts loaded                                                        │
│     → Defines tables: categories, todos, sync_events                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. models/*.ts loaded                                                      │
│     → Category, Todo, SyncEvent classes created                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. database.ts loaded                                                      │
│     → SQLiteAdapter created with schema + migrations                        │
│     → Database instance created with adapter + models                       │
│     → Collections created: categoriesCollection, todosCollection, etc.      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. App.tsx renders DatabaseProvider                                        │
│     → Database instance provided to React context                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. Components use useDatabase() or import collections directly             │
│     → Can now query, create, update, delete records                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Common Operations Examples

### Create a Category

```typescript
import { database, categoriesCollection } from '../db';

async function createCategory(title: string) {
  await database.write(async () => {
    await categoriesCollection.create((category) => {
      category.title = title;
      category._raw.created_at = Date.now();
      category._raw.updated_at = Date.now();
    });
  });
}

// Usage
await createCategory('Work');
```

### Query All Todos

```typescript
import { todosCollection } from '../db';

async function getAllTodos() {
  const todos = await todosCollection.query().fetch();
  return todos;
}
```

### Query with Conditions

```typescript
import { todosCollection } from '../db';
import { Q } from '@nozbe/watermelondb';

// Get incomplete todos
async function getIncompleteTodos() {
  const todos = await todosCollection
    .query(Q.where('is_completed', false))
    .fetch();
  return todos;
}

// Get todos in a specific category
async function getTodosByCategory(categoryId: string) {
  const todos = await todosCollection
    .query(Q.where('category_id', categoryId))
    .fetch();
  return todos;
}
```

### Update a Record

```typescript
import { database } from '../db';

async function toggleTodoComplete(todo: Todo) {
  await database.write(async () => {
    await todo.update((t) => {
      t.isCompleted = !t.isCompleted;
      t._raw.updated_at = Date.now();
    });
  });
}
```

### Delete a Record

```typescript
import { database } from '../db';

// Soft delete (marks as deleted, keeps in DB for sync)
async function softDeleteTodo(todo: Todo) {
  await database.write(async () => {
    await todo.markAsDeleted();
  });
}

// Hard delete (permanently removes from DB)
async function hardDeleteTodo(todo: Todo) {
  await database.write(async () => {
    await todo.destroyPermanently();
  });
}
```

---

## Summary

| File | Purpose | Key Export |
|------|---------|------------|
| `schema.ts` | Define table structures | `schema`, `SCHEMA_VERSION` |
| `models/*.ts` | Define data model classes | `Category`, `Todo`, `SyncEvent` |
| `database.ts` | Create database instance | `database`, `*Collection`, `resetDatabase` |
| `migrations.ts` | Handle schema upgrades | `migrations` |
| `DatabaseProvider.tsx` | React context for database | `DatabaseProvider`, `useDatabase` |
| `index.ts` | Export everything | All of the above |

---

*This documentation is part of the WatermelonDB Offline-First Todo POC project.*
