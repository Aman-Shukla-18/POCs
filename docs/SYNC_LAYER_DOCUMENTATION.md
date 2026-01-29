# Sync Layer Documentation (`src/sync/`)

This document explains every file in the `src/sync/` directory in detail. It covers how offline-first synchronization works, the two-phase sync protocol, and Last-Write-Wins conflict resolution.

---

## Table of Contents
1. [What is Sync?](#what-is-sync)
2. [The Two-Phase Sync Protocol](#the-two-phase-sync-protocol)
3. [File Overview](#file-overview)
4. [types.ts - Type Definitions](#typests---type-definitions)
5. [transport.ts - Transport Interface](#transportts---transport-interface)
6. [consoleTransport.ts - Debug Transport](#consoletransportts---debug-transport)
7. [httpTransport.ts - Production Transport](#httptransportts---production-transport)
8. [lwwResolver.ts - Conflict Resolution](#lwwresolverts---conflict-resolution)
9. [syncEngine.ts - The Orchestrator](#syncenginets---the-orchestrator)
10. [syncEventRepository.ts - Audit Logging](#synceventrepositorysts---audit-logging)
11. [useSync.ts - React Hook](#usesyncsts---react-hook)
12. [index.ts - Barrel Export](#indexts---barrel-export)
13. [Complete Sync Flow Example](#complete-sync-flow-example)
14. [Common Scenarios](#common-scenarios)

---

## What is Sync?

**Sync** (synchronization) is the process of keeping two databases in agreement:
1. **Local database** (WatermelonDB on the device)
2. **Remote database** (PostgreSQL on the server)

### Analogy: The Notebook Problem

Imagine you have a notebook (local) and a Google Doc (remote):
- You write notes in your notebook offline
- Someone else edits the Google Doc online
- When you go online, you need to:
  1. **Pull**: Download changes from Google Doc → your notebook
  2. **Push**: Upload your notebook changes → Google Doc
- **Conflict**: What if you both edited the same paragraph? That's where LWW comes in!

---

## The Two-Phase Sync Protocol

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         USER TAPS "SYNC" BUTTON                            │
└────────────────────────────────────────────┬───────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: PULL (Download remote changes)                                   │
│  ════════════════════════════════════════                                  │
│                                                                            │
│  Client                              Server                                │
│    │                                   │                                   │
│    │ ─── POST /sync/pull ───────────▶  │  "Give me all changes since      │
│    │     { lastPulledAt: 1000 }        │   timestamp 1000"                 │
│    │                                   │                                   │
│    │ ◀── Response ─────────────────── │                                   │
│    │     { changes: {...},             │  "Here are 5 new todos,          │
│    │       timestamp: 2000 }           │   2 updated categories"          │
│    │                                   │                                   │
│    ▼                                   │                                   │
│  Apply changes to local DB             │                                   │
│  (with conflict resolution)            │                                   │
│  Save timestamp: 2000                  │                                   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: PUSH (Upload local changes)                                      │
│  ════════════════════════════════════                                      │
│                                                                            │
│  Client                              Server                                │
│    │                                   │                                   │
│    │ ─── POST /sync/push ───────────▶  │  "Here are my local changes"     │
│    │     { changes: {...},             │                                   │
│    │       lastPulledAt: 2000 }        │                                   │
│    │                                   │                                   │
│    │ ◀── Response ─────────────────── │                                   │
│    │     { ok: true }                  │  "Got it, saved!"                │
│    │                                   │                                   │
│    ▼                                   │                                   │
│  Mark local records as "synced"        │                                   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Why Pull First?

We pull BEFORE push to:
1. Get the latest server state
2. Detect conflicts before pushing
3. Avoid overwriting someone else's changes

---

## File Overview

```
src/sync/
├── types.ts              # TypeScript interfaces for sync data structures
├── transport.ts          # Abstract interface for sync communication
├── consoleTransport.ts   # Debug implementation (logs to console)
├── httpTransport.ts      # Production implementation (real HTTP calls)
├── lwwResolver.ts        # Last-Write-Wins conflict resolution logic
├── syncEngine.ts         # Main orchestrator - coordinates the entire sync
├── syncEventRepository.ts# Logs conflicts for auditing
├── useSync.ts            # React hook for components
└── index.ts              # Exports everything
```

### Dependency Graph

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              useSync.ts                                  │
│                           (React Hook)                                   │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ uses
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                             syncEngine.ts                                │
│                         (Main Orchestrator)                              │
└───────┬──────────────────────┬───────────────────────┬───────────────────┘
        │                      │                       │
        ▼                      ▼                       ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐
│ transport.ts  │    │ lwwResolver.ts  │    │ syncEventRepository.ts      │
│ (Interface)   │    │ (Conflict Res.) │    │ (Audit Logging)             │
└───────┬───────┘    └─────────────────┘    └─────────────────────────────┘
        │
        ├─────────────────────┐
        ▼                     ▼
┌───────────────────┐  ┌─────────────────┐
│ consoleTransport  │  │ httpTransport   │
│ (Debug)           │  │ (Production)    │
└───────────────────┘  └─────────────────┘
```

---

## types.ts - Type Definitions

**Purpose:** Defines all TypeScript interfaces used throughout the sync system.

### Full Code with Explanations

```typescript
/**
 * Types for the sync system
 */

// ═══════════════════════════════════════════════════════════════════════════
// RECORD CHANGE
// Represents a single record that has been created, updated, or deleted
// ═══════════════════════════════════════════════════════════════════════════
export interface RecordChange {
  id: string;                    // Every record MUST have an ID
  [key: string]: unknown;        // Any other fields (title, description, etc.)
}

// Example RecordChange:
// {
//   id: "todo-123",
//   title: "Buy milk",
//   is_completed: false,
//   updated_at: 1706450000000
// }


// ═══════════════════════════════════════════════════════════════════════════
// TABLE CHANGES
// Groups all changes for a single table
// ═══════════════════════════════════════════════════════════════════════════
export interface TableChanges {
  created: RecordChange[];       // New records
  updated: RecordChange[];       // Modified records
  deleted: string[];             // IDs of deleted records (just IDs, not full records)
}

// Example TableChanges:
// {
//   created: [{ id: "1", title: "New Todo" }],
//   updated: [{ id: "2", title: "Updated Title" }],
//   deleted: ["3", "4"]  // Just IDs
// }


// ═══════════════════════════════════════════════════════════════════════════
// SYNC CHANGES
// Groups all changes for ALL tables
// ═══════════════════════════════════════════════════════════════════════════
export interface SyncChanges {
  [tableName: string]: TableChanges;  // Key = table name, Value = changes
}

// Example SyncChanges:
// {
//   categories: { created: [...], updated: [...], deleted: [...] },
//   todos: { created: [...], updated: [...], deleted: [...] }
// }


// ═══════════════════════════════════════════════════════════════════════════
// PULL REQUEST/RESPONSE
// Used when downloading changes FROM the server
// ═══════════════════════════════════════════════════════════════════════════
export interface PullChangesParams {
  lastPulledAt: number | null;   // When did we last sync? (null = first sync)
  schemaVersion: number;          // Client's database schema version
}

export interface PullChangesResponse {
  changes: SyncChanges;           // All changes since lastPulledAt
  timestamp: number;              // Server's current time (save for next sync)
}


// ═══════════════════════════════════════════════════════════════════════════
// PUSH REQUEST/RESPONSE
// Used when uploading changes TO the server
// ═══════════════════════════════════════════════════════════════════════════
export interface PushChangesParams {
  changes: SyncChanges;           // Local changes to upload
  lastPulledAt: number | null;    // Used for conflict detection
}

export interface PushChangesResponse {
  ok: boolean;                    // Did the push succeed?
  errors?: string[];              // Error messages if failed
}


// ═══════════════════════════════════════════════════════════════════════════
// CONFLICT TYPES
// Used for Last-Write-Wins resolution
// ═══════════════════════════════════════════════════════════════════════════
export interface ConflictInfo {
  collection: string;             // Which table? "todos" or "categories"
  recordId: string;               // Which record ID?
  localRecord: RecordChange;      // The local version
  remoteRecord: RecordChange;     // The server version
  localUpdatedAt: number;         // Local timestamp
  remoteUpdatedAt: number;        // Remote timestamp
}

export interface ConflictResolution {
  winner: 'local' | 'remote';     // Who won the conflict?
  reason: string;                 // Human-readable explanation
  resolvedRecord: RecordChange;   // The winning record
}


// ═══════════════════════════════════════════════════════════════════════════
// SYNC STATUS AND RESULT
// Used to track sync progress
// ═══════════════════════════════════════════════════════════════════════════
export type SyncStatus = 'idle' | 'pulling' | 'pushing' | 'error';

export interface SyncResult {
  success: boolean;               // Did sync complete successfully?
  pulled: number;                 // How many records pulled from server?
  pushed: number;                 // How many records pushed to server?
  conflicts: number;              // How many conflicts were resolved?
  error?: string;                 // Error message if failed
}
```

### Visual: How Types Flow Through Sync

```
PULL:
┌─────────────────────┐        ┌─────────────────────┐
│  PullChangesParams  │ ─────▶ │ PullChangesResponse │
│  { lastPulledAt,    │        │  { changes: {...},  │
│    schemaVersion }  │        │    timestamp }      │
└─────────────────────┘        └─────────────────────┘

PUSH:
┌─────────────────────┐        ┌─────────────────────┐
│  PushChangesParams  │ ─────▶ │ PushChangesResponse │
│  { changes: {...},  │        │  { ok: true/false,  │
│    lastPulledAt }   │        │    errors?: [...] } │
└─────────────────────┘        └─────────────────────┘
```

---

## transport.ts - Transport Interface

**Purpose:** Defines the contract that ALL transports must follow. This is the **Strategy Pattern** - we can swap implementations without changing the sync engine.

```typescript
import {
  PullChangesParams,
  PullChangesResponse,
  PushChangesParams,
  PushChangesResponse,
} from './types';

/**
 * SyncTransport interface - abstraction layer for sync communication
 * 
 * WHY an interface?
 * - ConsoleTransport: For development (logs to console)
 * - HttpTransport: For production (real API calls)
 * - MockTransport: For testing (returns fake data)
 * 
 * The SyncEngine doesn't care WHICH transport it uses!
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
```

### Visual: Strategy Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            SyncEngine                                   │
│                                                                         │
│   private transport: SyncTransport;  ◀── Can be ANY implementation!    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ ConsoleTransport│      │  HttpTransport  │      │  MockTransport  │
│   (for debug)   │      │ (for production)│      │  (for testing)  │
└─────────────────┘      └─────────────────┘      └─────────────────┘

All implement the same interface, so SyncEngine works with any of them!
```

---

## consoleTransport.ts - Debug Transport

**Purpose:** A transport that logs sync operations to the console instead of making real API calls. Perfect for development and debugging.

### Key Parts Explained

```typescript
export class ConsoleTransport implements SyncTransport {
  private simulateNetworkDelay: boolean;  // Should we fake network latency?
  private delayMs: number;                 // How long to wait (default: 500ms)

  constructor(options?: { simulateDelay?: boolean; delayMs?: number }) {
    this.simulateNetworkDelay = options?.simulateDelay ?? true;
    this.delayMs = options?.delayMs ?? 500;
  }

  // Simulates network delay
  private async delay(): Promise<void> {
    if (this.simulateNetworkDelay) {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), this.delayMs));
    }
  }

  async pullChanges(params: PullChangesParams): Promise<PullChangesResponse> {
    // Log the request in a pretty box
    console.log('┌──────────────────────────────────────────────────────────┐');
    console.log('│                    GET /sync/pull                        │');
    console.log(`│   lastPulledAt: ${params.lastPulledAt ?? 'null (first sync)'}`);
    console.log('└──────────────────────────────────────────────────────────┘');

    await this.delay();  // Fake network delay

    // Return empty changes (no server in console mode)
    return {
      changes: {
        categories: { created: [], updated: [], deleted: [] },
        todos: { created: [], updated: [], deleted: [] },
      },
      timestamp: Date.now(),
    };
  }

  async pushChanges(params: PushChangesParams): Promise<PushChangesResponse> {
    // Log each operation type
    console.log('│ [POST] todos (create):');
    console.log('│ [PUT] todos (update):');
    console.log('│ [DELETE] todos:');

    await this.delay();

    return { ok: true };
  }
}

// Singleton - use this throughout the app
export const consoleTransport = new ConsoleTransport();
```

### Console Output Example

```
┌──────────────────────────────────────────────────────────┐
│                    GET /sync/pull                        │
├──────────────────────────────────────────────────────────┤
│ Request:                                                 │
│   lastPulledAt: 1706450000000                           │
│   schemaVersion: 1                                       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    RESPONSE 200 OK                       │
├──────────────────────────────────────────────────────────┤
│ Server timestamp: 1706450100000                         │
│ Changes: no changes                                      │
│ Duration: 502ms                                          │
└──────────────────────────────────────────────────────────┘
```

---

## httpTransport.ts - Production Transport

**Purpose:** Makes real HTTP calls to the backend API. Used in production.

### Key Parts Explained

```typescript
const DEFAULT_BASE_URL = 'http://localhost:3000';
// Note: For Android emulator, use 'http://10.0.2.2:3000'

export class HttpTransport implements SyncTransport {
  private baseUrl: string;
  private authToken: string | null = null;  // User's auth token

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  }

  /**
   * Set the auth token (user ID) for API calls
   * Called after user logs in
   */
  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  /**
   * Build headers for HTTP requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add auth header if logged in
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }

  async pullChanges(params: PullChangesParams): Promise<PullChangesResponse> {
    // Check authentication
    if (!this.authToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    // Make the HTTP request
    const response = await fetch(`${this.baseUrl}/api/sync/pull`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),  // Send lastPulledAt and schemaVersion
    });

    // Handle errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  async pushChanges(params: PushChangesParams): Promise<PushChangesResponse> {
    if (!this.authToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    const response = await fetch(`${this.baseUrl}/api/sync/push`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),  // Send changes and lastPulledAt
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }
}

// Singleton instance
export const httpTransport = new HttpTransport();
```

### HTTP Request/Response Example

```
REQUEST:
POST http://localhost:3000/api/sync/pull
Headers:
  Content-Type: application/json
  Authorization: Bearer abc-123-user-id
Body:
{
  "lastPulledAt": 1706450000000,
  "schemaVersion": 1
}

RESPONSE:
{
  "changes": {
    "categories": {
      "created": [{ "id": "cat-1", "title": "Work", ... }],
      "updated": [],
      "deleted": []
    },
    "todos": {
      "created": [],
      "updated": [{ "id": "todo-1", "title": "Updated", ... }],
      "deleted": ["todo-old"]
    }
  },
  "timestamp": 1706450100000
}
```

---

## lwwResolver.ts - Conflict Resolution

**Purpose:** Contains pure functions for Last-Write-Wins (LWW) conflict resolution.

### What is LWW?

**Last-Write-Wins** is a simple conflict resolution strategy:
- Compare timestamps
- The record with the NEWER timestamp wins
- In case of tie, server wins (server authority)

### Key Functions Explained

```typescript
/**
 * The main conflict resolution function
 * Compares timestamps and returns the winner
 */
export function resolveLWWConflict(conflict: ConflictInfo): ConflictResolution {
  const { localUpdatedAt, remoteUpdatedAt, localRecord, remoteRecord } = conflict;

  // CASE 1: Local is newer → Local wins
  if (localUpdatedAt > remoteUpdatedAt) {
    return {
      winner: 'local',
      reason: `Local timestamp (${localUpdatedAt}) is newer than remote (${remoteUpdatedAt})`,
      resolvedRecord: localRecord,
    };
  }

  // CASE 2: Remote is newer → Remote wins
  if (remoteUpdatedAt > localUpdatedAt) {
    return {
      winner: 'remote',
      reason: `Remote timestamp (${remoteUpdatedAt}) is newer than local (${localUpdatedAt})`,
      resolvedRecord: remoteRecord,
    };
  }

  // CASE 3: Exact tie → Remote wins (server authority)
  return {
    winner: 'remote',
    reason: `Timestamps equal (${localUpdatedAt}). Remote wins by server authority.`,
    resolvedRecord: remoteRecord,
  };
}

/**
 * Extract timestamp from a record
 * Handles both snake_case and camelCase field names
 */
export function getRecordTimestamp(record: RecordChange): number {
  const timestamp = record.updated_at ?? record.updatedAt ?? 0;
  return typeof timestamp === 'number' ? timestamp : 0;
}

/**
 * Check if there's a conflict
 * Both records must be modified after the base timestamp
 */
export function hasConflict(
  localRecord: RecordChange | undefined,
  remoteRecord: RecordChange | undefined,
  baseTimestamp: number
): boolean {
  if (!localRecord || !remoteRecord) {
    return false;  // No conflict if either doesn't exist
  }

  const localTimestamp = getRecordTimestamp(localRecord);
  const remoteTimestamp = getRecordTimestamp(remoteRecord);

  // Conflict exists if BOTH were modified after base
  return localTimestamp > baseTimestamp && remoteTimestamp > baseTimestamp;
}

/**
 * Create a ConflictInfo object for logging
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
```

### Visual: LWW Resolution

```
SCENARIO: Same todo edited on phone and web

Phone (local):
┌─────────────────────────────────────────┐
│ id: "todo-1"                            │
│ title: "Buy almond milk"                │
│ updated_at: 1706450000000               │  ← Newer (1000)
└─────────────────────────────────────────┘

Server (remote):
┌─────────────────────────────────────────┐
│ id: "todo-1"                            │
│ title: "Buy oat milk"                   │
│ updated_at: 1706449000000               │  ← Older (900)
└─────────────────────────────────────────┘

                    │
                    ▼
           ┌───────────────┐
           │ Compare times │
           │ 1000 > 900    │
           └───────┬───────┘
                   │
                   ▼
           ┌───────────────┐
           │ LOCAL WINS!   │
           │ "Buy almond   │
           │  milk" kept   │
           └───────────────┘
```

---

## syncEngine.ts - The Orchestrator

**Purpose:** The main sync coordinator. Manages the entire sync process from start to finish.

### Class Structure

```typescript
class SyncEngine {
  private transport: SyncTransport;                    // How to communicate
  private status: SyncStatus = 'idle';                 // Current state
  private listeners: Set<(status: SyncStatus) => void>; // Status subscribers

  constructor(transport: SyncTransport = consoleTransport) {
    this.transport = transport;
  }
}
```

### Key Methods Explained

#### 1. Status Management

```typescript
/**
 * Get current sync status
 * Returns: 'idle' | 'pulling' | 'pushing' | 'error'
 */
getStatus(): SyncStatus {
  return this.status;
}

/**
 * Subscribe to status changes
 * Used by React components to update UI
 * Returns: unsubscribe function
 */
addStatusListener(listener: (status: SyncStatus) => void): () => void {
  this.listeners.add(listener);
  return () => this.listeners.delete(listener);  // Return cleanup function
}

/**
 * Update status and notify all listeners
 */
private setStatus(status: SyncStatus): void {
  this.status = status;
  this.listeners.forEach((listener) => listener(status));  // Notify all
}
```

#### 2. Timestamp Management

```typescript
const LAST_PULLED_AT_KEY = '@sync/lastPulledAt';

/**
 * Get last sync timestamp from AsyncStorage
 * Returns null for first sync
 */
async getLastPulledAt(): Promise<number | null> {
  const value = await AsyncStorage.getItem(LAST_PULLED_AT_KEY);
  return value ? parseInt(value, 10) : null;
}

/**
 * Save timestamp after successful pull
 */
private async setLastPulledAt(timestamp: number): Promise<void> {
  await AsyncStorage.setItem(LAST_PULLED_AT_KEY, String(timestamp));
}

/**
 * Clear timestamp (on logout)
 * Next user will get full sync
 */
async clearLastPulledAt(): Promise<void> {
  await AsyncStorage.removeItem(LAST_PULLED_AT_KEY);
}
```

#### 3. Fetching Local Changes

```typescript
/**
 * Get all local records that need to be pushed
 * WatermelonDB uses _status field to track this
 */
private async fetchLocalChanges(): Promise<SyncChanges> {
  const changes: SyncChanges = {
    categories: { created: [], updated: [], deleted: [] },
    todos: { created: [], updated: [], deleted: [] },
  };

  // Query records where _status is NOT 'synced'
  const [categories, todos] = await Promise.all([
    categoriesCollection.query(Q.where('_status', Q.notEq('synced'))).fetch(),
    todosCollection.query(Q.where('_status', Q.notEq('synced'))).fetch(),
  ]);

  // Categorize by status
  for (const record of todos) {
    const raw = record._raw as any;
    
    if (raw._status === 'created') {
      changes.todos.created.push({ id: record.id, title: raw.title, ... });
    } else if (raw._status === 'updated') {
      changes.todos.updated.push({ id: record.id, title: raw.title, ... });
    } else if (raw._status === 'deleted') {
      changes.todos.deleted.push(record.id);
    }
  }

  return changes;
}
```

#### 4. Applying Remote Changes

```typescript
/**
 * Apply changes from server to local database
 * With conflict resolution!
 */
private async applyRemoteChanges(
  remoteChanges: SyncChanges,
  lastPulledAt: number | null
): Promise<{ applied: number; conflicts: number }> {
  let applied = 0;
  let conflicts = 0;

  await database.write(async () => {
    // For each table (categories, todos)
    for (const [collectionName, tableChanges] of Object.entries(remoteChanges)) {
      
      // Handle CREATED records from server
      for (const remoteRecord of tableChanges.created) {
        // Check if record already exists locally
        const existing = await collection.find(remoteRecord.id).catch(() => null);
        
        if (existing) {
          // CONFLICT! Record exists both locally and remotely
          const conflictInfo = createConflictInfo(collectionName, existing, remoteRecord);
          const resolution = resolveLWWConflict(conflictInfo);
          
          // Log the conflict for auditing
          await syncEventRepository.logConflictResolution(conflictInfo, resolution);
          conflicts++;
          
          if (resolution.winner === 'remote') {
            // Remote wins - update local record
            await existing.update((r) => {
              Object.entries(remoteRecord).forEach(([key, value]) => {
                r._raw[key] = value;
              });
            });
            applied++;
          }
          // If local wins, do nothing (local changes will be pushed)
        } else {
          // No conflict - create new record locally
          await collection.create((r) => {
            r._raw.id = remoteRecord.id;
            // Copy all fields...
            r._raw._status = 'synced';  // Mark as synced
          });
          applied++;
        }
      }
      
      // Similar logic for UPDATED and DELETED...
    }
  });

  return { applied, conflicts };
}
```

#### 5. The Main sync() Method

```typescript
/**
 * Perform a full sync (pull + push)
 * This is the main method called when user taps Sync
 */
async sync(): Promise<SyncResult> {
  // Prevent concurrent syncs
  if (this.status !== 'idle') {
    return { success: false, error: 'Sync already in progress', ... };
  }

  try {
    // ═══════════════════════════════════════════════════════════
    // PHASE 1: PULL
    // ═══════════════════════════════════════════════════════════
    this.setStatus('pulling');  // Update UI
    
    const lastPulledAt = await this.getLastPulledAt();
    
    // Call the transport (HTTP or Console)
    const pullResponse = await this.transport.pullChanges({
      lastPulledAt,
      schemaVersion: SCHEMA_VERSION,
    });
    
    // Apply remote changes to local DB
    const { applied: pulled, conflicts } = await this.applyRemoteChanges(
      pullResponse.changes,
      lastPulledAt
    );
    
    // Save new timestamp
    await this.setLastPulledAt(pullResponse.timestamp);

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: PUSH
    // ═══════════════════════════════════════════════════════════
    this.setStatus('pushing');  // Update UI
    
    const localChanges = await this.fetchLocalChanges();
    
    // Count changes
    let pushed = 0;
    for (const tableChanges of Object.values(localChanges)) {
      pushed += tableChanges.created.length;
      pushed += tableChanges.updated.length;
      pushed += tableChanges.deleted.length;
    }
    
    if (pushed > 0) {
      // Push to server
      const pushResponse = await this.transport.pushChanges({
        changes: localChanges,
        lastPulledAt: pullResponse.timestamp,
      });
      
      if (pushResponse.ok) {
        // Mark records as synced
        await this.markLocalChangesAsSynced(localChanges);
      }
    }

    this.setStatus('idle');
    return { success: true, pulled, pushed, conflicts };
    
  } catch (error) {
    this.setStatus('error');
    return { success: false, error: error.message, ... };
  }
}
```

### Sync Engine State Machine

```
                    ┌──────────┐
                    │   IDLE   │ ◀─────────────────────────────────────┐
                    └────┬─────┘                                       │
                         │ sync() called                               │
                         ▼                                             │
                    ┌──────────┐                                       │
              ┌─────│ PULLING  │                                       │
              │     └────┬─────┘                                       │
              │          │ pull complete                               │
              │          ▼                                             │
              │     ┌──────────┐                                       │
              │     │ PUSHING  │───────────────────────────────────────┤
              │     └────┬─────┘ push complete                         │
              │          │                                             │
              │          │ error                                       │
              │          ▼                                             │
              │     ┌──────────┐                                       │
              └────▶│  ERROR   │───────────────────────────────────────┘
                    └──────────┘ (auto-reset after 1s)
```

---

## syncEventRepository.ts - Audit Logging

**Purpose:** Logs all sync conflicts to a local database table for debugging and auditing.

### Why Log Conflicts?

1. **Debugging**: See why data changed unexpectedly
2. **Auditing**: Track sync history
3. **Monitoring**: Detect frequent conflicts (might indicate a bug)

### Key Methods

```typescript
class SyncEventRepository {
  /**
   * Log a conflict resolution
   * Called whenever LWW resolves a conflict
   */
  async logConflictResolution(
    conflictInfo: ConflictInfo,
    resolution: ConflictResolution
  ): Promise<SyncEvent> {
    return await database.write(async () => {
      const event = await syncEventsCollection.create((e) => {
        e.collectionName = conflictInfo.collection;      // "todos" or "categories"
        e.recordId = conflictInfo.recordId;               // Which record
        e.localUpdatedAt = conflictInfo.localUpdatedAt;   // Local timestamp
        e.remoteUpdatedAt = conflictInfo.remoteUpdatedAt; // Remote timestamp
        e.winner = resolution.winner;                     // "local" or "remote"
        e.reason = resolution.reason;                     // Human explanation
      });
      return event;
    });
  }

  /**
   * Get conflict history for a specific record
   * Useful for debugging
   */
  async getEventsForRecord(collectionName: string, recordId: string): Promise<SyncEvent[]> {
    const events = await syncEventsCollection.query().fetch();
    return events.filter(e => 
      e.collectionName === collectionName && e.recordId === recordId
    );
  }

  /**
   * Get recent conflicts for monitoring
   */
  async getRecentEvents(limit: number = 50): Promise<SyncEvent[]> {
    const events = await syncEventsCollection.query().fetch();
    return events
      .sort((a, b) => b.createdAt - a.createdAt)  // Newest first
      .slice(0, limit);
  }

  /**
   * Clean up old events
   * Call periodically to prevent database bloat
   */
  async clearOldEvents(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    const oldEvents = (await syncEventsCollection.query().fetch())
      .filter(e => e.createdAt < cutoff);
    
    await database.write(async () => {
      for (const event of oldEvents) {
        await event.destroyPermanently();
      }
    });
    
    return oldEvents.length;
  }
}
```

### Example: Viewing Conflict History

```sql
-- Query sync_events table in SQLite
SELECT collection_name, record_id, winner, reason, created_at
FROM sync_events
ORDER BY created_at DESC
LIMIT 10;

-- Output:
-- todos    | todo-123 | local  | Local timestamp (1000) > remote (900) | 1706450000
-- todos    | todo-456 | remote | Remote timestamp (2000) > local (1500)| 1706449000
```

---

## useSync.ts - React Hook

**Purpose:** Provides a simple way for React components to trigger sync and track status.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { syncEngine } from './syncEngine';
import { SyncStatus, SyncResult } from './types';

// What the hook returns
interface UseSyncResult {
  status: SyncStatus;          // Current status: 'idle' | 'pulling' | 'pushing' | 'error'
  lastResult: SyncResult | null; // Result of last sync
  sync: () => Promise<SyncResult>; // Function to trigger sync
  isSyncing: boolean;          // Convenience: true if pulling or pushing
}

export const useSync = (): UseSyncResult => {
  // Track status in React state
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    // Subscribe to status changes from syncEngine
    const unsubscribe = syncEngine.addStatusListener(setStatus);
    
    // Cleanup on unmount
    return unsubscribe;
  }, []);

  // Memoized sync function
  const sync = useCallback(async (): Promise<SyncResult> => {
    const result = await syncEngine.sync();
    setLastResult(result);
    return result;
  }, []);

  // Convenience boolean
  const isSyncing = status === 'pulling' || status === 'pushing';

  return {
    status,
    lastResult,
    sync,
    isSyncing,
  };
};
```

### Usage in a Component

```tsx
function TodoListScreen() {
  const { status, sync, isSyncing, lastResult } = useSync();

  return (
    <View>
      {/* Sync button */}
      <Button
        title={isSyncing ? 'Syncing...' : 'Sync'}
        onPress={sync}
        disabled={isSyncing}
      />
      
      {/* Status indicator */}
      <Text>Status: {status}</Text>
      
      {/* Last result */}
      {lastResult && (
        <Text>
          Last sync: {lastResult.pulled} pulled, {lastResult.pushed} pushed
        </Text>
      )}
    </View>
  );
}
```

### Hook Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              React Component                                │
│                                                                             │
│  const { status, sync, isSyncing } = useSync();                            │
│                                                                             │
└─────────────────────────────────────────────────┬───────────────────────────┘
                                                  │
                  ┌───────────────────────────────┴───────────────────────────┐
                  │                                                           │
                  ▼                                                           │
┌─────────────────────────────────────┐                                       │
│            useSync Hook             │                                       │
│                                     │                                       │
│  useState(status)  ◀─────────────── │ ◀── syncEngine.addStatusListener()   │
│                                     │                                       │
│  sync() ─────────────────────────── │ ──▶ syncEngine.sync()                │
│                                     │                                       │
└─────────────────────────────────────┘                                       │
                                                                              │
                                                  ▲                           │
                                                  │                           │
                                                  │ notifies                  │
                                                  │                           │
┌─────────────────────────────────────────────────┴───────────────────────────┐
│                              SyncEngine                                     │
│                                                                             │
│  setStatus('pulling') ──▶ listeners.forEach(l => l(status))                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## index.ts - Barrel Export

**Purpose:** Single entry point for importing anything from the sync module.

```typescript
// Main sync engine
export { syncEngine } from './syncEngine';

// Transport implementations
export { consoleTransport, ConsoleTransport } from './consoleTransport';
export { httpTransport, HttpTransport } from './httpTransport';

// Audit logging
export { syncEventRepository } from './syncEventRepository';

// React hook
export { useSync } from './useSync';

// All types
export * from './types';

// Transport interface
export * from './transport';

// LWW functions
export * from './lwwResolver';
```

### Usage

```typescript
// Import everything you need from one place
import {
  syncEngine,
  httpTransport,
  useSync,
  SyncStatus,
  SyncResult,
} from '../sync';
```

---

## Complete Sync Flow Example

Let's trace through a complete sync operation:

```
USER TAPS SYNC BUTTON
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. useSync.sync() called                                                    │
│    Component calls the sync function from the hook                          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. syncEngine.sync() starts                                                 │
│    - Checks status is 'idle' (prevents concurrent syncs)                    │
│    - Sets status to 'pulling'                                               │
│    - Hook updates: isSyncing = true                                         │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. PULL PHASE                                                               │
│    - Gets lastPulledAt from AsyncStorage (e.g., 1706450000000)             │
│    - Calls httpTransport.pullChanges({ lastPulledAt, schemaVersion })      │
│    - Server returns: { changes: {...}, timestamp: 1706450100000 }          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. APPLY REMOTE CHANGES                                                     │
│    - For each created/updated/deleted record from server:                   │
│      - Check if exists locally                                              │
│      - If conflict: call resolveLWWConflict()                              │
│      - If conflict: call syncEventRepository.logConflictResolution()       │
│      - Apply winner's version to local DB                                   │
│    - Save new lastPulledAt: 1706450100000                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. PUSH PHASE                                                               │
│    - Sets status to 'pushing'                                               │
│    - Fetches local changes: query WHERE _status != 'synced'                │
│    - Calls httpTransport.pushChanges({ changes, lastPulledAt })            │
│    - Server applies changes (with its own LWW)                             │
│    - Server returns: { ok: true }                                          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. MARK AS SYNCED                                                           │
│    - For each pushed record: set _status = 'synced'                        │
│    - For deleted records: destroyPermanently()                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 7. COMPLETE                                                                 │
│    - Sets status to 'idle'                                                  │
│    - Returns: { success: true, pulled: 3, pushed: 2, conflicts: 1 }        │
│    - Hook updates: isSyncing = false, lastResult = {...}                   │
│    - UI updates to show success                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Common Scenarios

### Scenario 1: First Sync (New User)

```
lastPulledAt = null (never synced before)
         │
         ▼
Server returns ALL records for this user (not just changes)
         │
         ▼
Local DB populated with all data
         │
         ▼
lastPulledAt = server's timestamp (e.g., 1706450000000)
```

### Scenario 2: Offline Edit → Sync

```
1. User creates todo while offline
   Local: { id: "new-1", title: "Buy milk", _status: "created" }

2. User taps Sync
   PULL: No conflicts (record doesn't exist on server)
   PUSH: Send { todos: { created: [{ id: "new-1", ... }] } }

3. Server creates record
   Returns: { ok: true }

4. Local: _status changes from "created" to "synced"
```

### Scenario 3: Conflict Resolution

```
1. User A edits todo on phone: "Buy almond milk" at t=1000
2. User B edits same todo on web: "Buy oat milk" at t=900

3. User A syncs:
   PULL: Server has "Buy oat milk" (t=900)
   CONFLICT DETECTED:
     Local: t=1000, Remote: t=900
     1000 > 900 → LOCAL WINS
   
   Local keeps "Buy almond milk"
   
   PUSH: Send local version to server
   Server now has "Buy almond milk"
```

### Scenario 4: User Logout/Login

```
1. User A logs out
   - authService.logout() called
   - resetDatabase() clears ALL local data
   - clearLastPulledAt() removes sync timestamp

2. User B logs in
   - httpTransport.setAuthToken(userB.id)
   - Auto-sync triggered
   - lastPulledAt = null (full sync)
   - Server returns User B's data
   - Local DB populated with User B's data only
```

---

## Summary Table

| File | Purpose | Key Export |
|------|---------|------------|
| `types.ts` | TypeScript interfaces | `SyncChanges`, `SyncResult`, `ConflictInfo` |
| `transport.ts` | Transport interface | `SyncTransport` |
| `consoleTransport.ts` | Debug implementation | `consoleTransport` |
| `httpTransport.ts` | Production implementation | `httpTransport` |
| `lwwResolver.ts` | Conflict resolution | `resolveLWWConflict()` |
| `syncEngine.ts` | Main orchestrator | `syncEngine` |
| `syncEventRepository.ts` | Audit logging | `syncEventRepository` |
| `useSync.ts` | React hook | `useSync()` |
| `index.ts` | Barrel export | Everything above |

---

*This documentation is part of the WatermelonDB Offline-First Todo POC project.*
