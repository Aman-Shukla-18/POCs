# Architecture & Data-Flow Guide (Junior-Friendly)

This document explains **how the app is architected** and **how data flows** across UI → Local DB → Sync → Backend → PostgreSQL, including **edge-case scenarios** and the design choices that keep the app stable and predictable.

If you want the “how to run / commands / endpoints” reference, see `DOCUMENTATION.md` and `QUICK_REFERENCE.md`.

---

## Why this architecture?

We want an app that:
- **Works offline** (create/update/delete without network).
- Feels **fast** (reads/writes are local).
- Becomes consistent eventually (sync when online).
- Handles conflicts in a deterministic way (so “weird” bugs are rare).

The result is an **offline-first, local-source-of-truth** architecture.

---

## High-level system view

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         React Native App (Device)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  UI Screens  →  Hooks  →  Repositories  →  WatermelonDB (SQLite)            │
│                     │                        ▲                              │
│                     │                        │                              │
│                     └────────── Sync Engine ─┘                              │
│                                 (Pull → Push)                               │
│                                      │                                      │
│                               Transport Layer                               │
│                            (Console / HTTP)                                 │
└──────────────────────────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Backend (Node.js + Express)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Auth middleware → Routes → Services → Sync Service (LWW + Mapping)         │
│                                               │                             │
│                                               ▼                             │
│                                    PostgreSQL (Remote DB)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key idea
- **Reads** always come from **local** WatermelonDB.
- **Writes** always go to **local** WatermelonDB first.
- **Sync** is a background/triggered process that reconciles local ↔ remote.

This avoids UI depending on network timing and reduces “stuck loading” issues.

---

## Frontend building blocks (responsibilities)

### 1) Screens (UI)
**Role:** Display data + trigger actions (create/update/delete/sync).
- Should not contain database query logic directly.
- Uses hooks/repositories.

### 2) Hooks (example: `useTodos`, `useCategories`, `useSync`)
**Role:** Bridge UI ↔ domain operations, expose a clean API to the screen.
- Keeps UI simple (e.g., `isSyncing`, `sync()`).

### 3) Repositories (CRUD)
**Role:** Single place for “how to write this entity into WatermelonDB”.
- Ensures writes happen in `database.write()` transactions.
- Ensures timestamps/status fields are updated consistently.

### 4) WatermelonDB (Local Source of Truth)
**Role:** Durable local storage with fast queries (SQLite + JSI).
- Tracks sync state using WatermelonDB metadata (`_status`, `_changed`).
  - `synced`: record matches remote state
  - `created` / `updated` / `deleted`: pending push

### 5) Sync Engine (`src/sync/syncEngine.ts`)
**Role:** Orchestrate sync: **Pull** remote changes, apply locally with conflict rules, then **Push** local changes.
- Stores `lastPulledAt` in `AsyncStorage` (`@sync/lastPulledAt`) to do incremental pulls.
- Prevents overlapping syncs by blocking when status is not `idle`.

### 6) Transport (`src/sync/transport.ts`)
**Role:** Abstract communication so we can swap implementations:
- `ConsoleTransport`: logs requests/responses (debug)
- `HttpTransport`: real backend calls

---

## Backend building blocks (responsibilities)

### 1) Auth
**Role:** Identify the user; scope all data to that user.
- In this POC, the “token” is effectively a user identifier (see backend auth code).

### 2) Services
**Role:** Encapsulate business logic and DB queries.
- Categories/Todos services read/write Postgres.

### 3) Sync Service (server-side)
**Role:** Apply pushes and generate pulls.
- Implements **Last-Write-Wins (LWW)** conflict resolution server-side too.
- Performs **field name mapping** between local schema and Postgres schema.

### 4) PostgreSQL (Remote DB)
**Role:** Durable shared storage for cross-device/user persistence.
- Uses soft-delete semantics (`is_deleted`) for sync consistency.

---

## The “Source of Truth” rule (critical)

### Local is the source of truth for UI
The UI renders from local DB, which means:
- UI does not break when network is slow/offline.
- You can always open the app and see your data.

### Remote is the source of truth for cross-device consistency
The server eventually becomes the meeting point for all devices.

---

## Data model & sync metadata (how “pending changes” are tracked)

WatermelonDB internally tracks sync state:
- `_status`: `'synced' | 'created' | 'updated' | 'deleted'`
- `_changed`: which columns changed (used by WatermelonDB sync patterns)

This POC relies on `_status` to find pending changes:
- Query pending changes with `Q.where('_status', Q.notEq('synced'))`

---

## Sync protocol: Pull then Push (two-phase)

Why do we do Pull before Push?
- We want to apply server updates first to reduce overwriting and detect conflicts.

```
PHASE 1: PULL
  Client → Server:  lastPulledAt, schemaVersion
  Server → Client:  { changes, timestamp }
  Client:           apply changes locally (with LWW), save timestamp

PHASE 2: PUSH
  Client:           collect local changes (created/updated/deleted)
  Client → Server:  { changes, lastPulledAt }
  Server:           apply (with LWW), return ok
  Client:           mark records as synced / delete permanently
```

---

## Conflict strategy (LWW) — the rulebook

### The rule
Compare timestamps (`updated_at`):
- Newer timestamp **wins**
- On exact tie, **remote wins** (“server authority”)

### Why this helps stability
You get deterministic outcomes:
- Two devices won’t “ping-pong” a value forever.
- The same conflict always resolves the same way.

### Where conflicts are logged (client)
When a conflict is detected/resolved client-side, we log a record into `sync_events` using `syncEventRepository`.
This gives you:
- What record conflicted
- Local/remote timestamps
- Winner and reason (human readable)

---

## Field mapping (local vs remote schema names)

**Important:** Local column names do **not** need to match remote column names.

Example mapping (conceptual):

| Local (WatermelonDB) | Remote (Postgres) |
|---|---|
| `title` | `name` |
| `description` | `details` |
| `is_completed` | `done` |
| `created_at` | `created_timestamp` |
| `updated_at` | `modified_at` |

This mapping is handled server-side in the backend sync service during:
- **Pull transforms**: remote → local shape
- **Push processing**: local → remote shape

---

## Scenario playbook (how data flows in real life)

### Scenario A: User creates a todo while offline

**Goal:** No network required; UI updates instantly.

Flow:
1. User taps “Save”
2. Repository writes todo into WatermelonDB inside `database.write()`
3. WatermelonDB marks record `_status = 'created'`
4. UI re-renders from local DB (shows the todo)
5. Later, user syncs:
   - Pull applies remote changes
   - Push uploads the new todo
   - Client marks `_status = 'synced'`

Edge cases handled:
- No network: no problem; local write always succeeds (unless device storage issues).

Hardening recommendations (optional):
- Retry push with backoff when network returns (auto-sync).

---

### Scenario B: User edits a todo on two devices (conflict)

Assume both devices started from the same state.

1. Device A edits todo at `updated_at = 1200` (local)
2. Device B edits same todo at `updated_at = 1100` (remote eventually)
3. Device A syncs:
   - Pull receives remote update
   - Conflict detected (local record also modified)
   - LWW compares timestamps: 1200 > 1100 → local wins
   - Conflict is logged to `sync_events`
   - Push sends local winner to server

Edge cases handled:
- Deterministic conflict resolution (prevents “random” outcomes).

Hardening recommendations (optional):
- Consider server-provided timestamps to reduce device clock skew issues.

---

### Scenario C: User deletes a record offline

Flow:
1. User taps delete
2. Local record becomes `_status = 'deleted'`
3. UI hides it (depending on query/filter logic)
4. On sync push:
   - Deleted IDs are sent in `changes.[table].deleted`
   - Server soft-deletes (`is_deleted = true`)
   - Client permanently deletes locally after push succeeds

Edge cases handled:
- Local stays responsive and consistent even before server acknowledges.

Known limitation (POC detail):
- Client-side delete conflicts currently approximate remote delete time (`nowMs()`); a production system should send/compare a real server delete timestamp.

---

### Scenario D: App is killed mid-sync (pull or push)

What can happen:
- Pull might have partially applied remote changes.
- Push might have sent changes but client didn’t mark local as synced yet.

Why this doesn’t usually corrupt data:
- Local DB writes happen inside WatermelonDB transactions (`database.write()`).
- Pending local changes remain `_status != 'synced'` until explicitly marked synced.

Hardening recommendations (optional but important):
- Make server push endpoint **idempotent** (same change can be safely re-applied).
- Keep a “sync in progress” marker + resume logic (not required for POC, but good for production).

---

### Scenario E: Sync is triggered multiple times rapidly (double-tap / UI glitch)

Current behavior:
- `syncEngine.sync()` checks `status !== 'idle'` and returns an error result: `Sync already in progress`.

Why this helps:
- Prevents overlapping writes that could cause inconsistent status marking.

Hardening recommendations:
- Queue sync requests instead of returning an error (optional UX improvement).

---

### Scenario F: User logs out (data isolation)

Goal:
**User A’s data must not be visible to User B** on the same device.

Flow on logout:
1. Clear auth tokens from storage
2. `resetDatabase()` permanently deletes local data (categories/todos/sync events)
3. `syncEngine.clearLastPulledAt()` removes the sync checkpoint

Flow on next login:
1. Set auth token for HTTP transport
2. Trigger sync (auto-sync)
3. Because `lastPulledAt = null`, the client does a **full pull** for the new user

This is one of the biggest “avoid production bugs” features in multi-user devices.

---

## Observability & debugging (how we avoid “mystery bugs”)

### Client logs
There is structured logging via `shared/utils/logger`.
- Sync logs: start/end, counts, errors
- HTTP transport logs: endpoints, durations

### Conflict audit trail
Conflicts are recorded locally (table `sync_events`), so you can explain:
- what conflicted
- why one side won

### Querying local DB
Use `QUICK_REFERENCE.md` for sqlite commands to inspect `_status`, tables, and sync events.

---

## “Almost zero functional issues” checklist (what we have vs what to add)

### Already implemented (stability fundamentals)
- **Local-first writes** (UI doesn’t depend on network)
- **Two-phase sync** (pull then push)
- **LWW conflict resolution** on client + server
- **Pluggable transport** (console vs HTTP)
- **Sync checkpoint** (`lastPulledAt`) for incremental pulls
- **User data isolation on logout**
- **Conflict logging** to `sync_events`
- **Concurrent sync prevention** (status guard)

### Recommended hardening for production-grade reliability
These are not strictly required for a POC, but they are what teams add to reduce edge-case bugs further:
- **Retry with exponential backoff** for network failures (especially push)
- **Idempotent server writes** (safe to replay pushes)
- **Server timestamps** (avoid device clock skew issues)
- **Pagination/batching** for very large datasets
- **Schema migration handling**: if schemaVersion mismatches, perform safe reset/migration flow
- **Robust delete semantics**: server-provided delete timestamps + consistent conflict rules for deletes
- **Sync queue**: if sync requested while syncing, schedule it rather than returning error
- **Background sync triggers** (app resume, network regained), with throttling/debouncing
- **Better error surfaces**: map network/auth/server errors to user-friendly UI messages

---

## Where to read next (code-level docs)

- Sync internals: `src/sync/SYNC_LAYER_DOCUMENTATION.md`
- DB internals: `src/db/DB_LAYER_DOCUMENTATION.md`
- Full project reference: `DOCUMENTATION.md`
- Query cheat sheet: `QUICK_REFERENCE.md`

