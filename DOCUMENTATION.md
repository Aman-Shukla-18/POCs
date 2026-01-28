# WatermelonDB Offline-First Todo App - Technical Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Data Flow & Sync Mechanism](#data-flow--sync-mechanism)
4. [Field Mapping (Local vs Remote)](#field-mapping-local-vs-remote)
5. [Project Structure](#project-structure)
6. [Prerequisites & Version Compatibility](#prerequisites--version-compatibility)
7. [Setup & Running the Project](#setup--running-the-project)
8. [Database Query Commands](#database-query-commands)
9. [Authentication Flow](#authentication-flow)
10. [Sync Protocol Details](#sync-protocol-details)
11. [Troubleshooting](#troubleshooting)

---

## Project Overview

This is a **production-grade Proof of Concept** demonstrating:
- **Offline-first architecture** using WatermelonDB (SQLite) on React Native
- **Two-phase sync protocol** (Pull then Push) with a Node.js/PostgreSQL backend
- **Last-Write-Wins (LWW) conflict resolution** at both client and server
- **Field name mapping** between local and remote databases (demonstrating they don't need to match)

### Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile App | React Native 0.83.1, TypeScript |
| Local Database | WatermelonDB (SQLite with JSI) |
| Backend | Node.js, Express.js, TypeScript |
| Remote Database | PostgreSQL 16 |
| Navigation | React Navigation (Bottom Tabs + Stack) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MOBILE APP (React Native)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Screens   │───▶│   Hooks     │───▶│ Repositories│───▶│ WatermelonDB│  │
│  │  (UI Layer) │    │ (useTodos)  │    │  (CRUD)     │    │  (SQLite)   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                                                        │          │
│         │                    ┌─────────────────┐                 │          │
│         └───────────────────▶│   Sync Engine   │◀────────────────┘          │
│                              │  (Pull + Push)  │                            │
│                              └────────┬────────┘                            │
│                                       │                                     │
│                              ┌────────▼────────┐                            │
│                              │  HTTP Transport │                            │
│                              └────────┬────────┘                            │
└───────────────────────────────────────┼─────────────────────────────────────┘
                                        │ HTTPS
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Node.js + Express)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Routes    │───▶│  Services   │───▶│ Sync Service│───▶│ PostgreSQL  │  │
│  │ (REST API)  │    │ (Business)  │    │ (LWW Logic) │    │  Database   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow & Sync Mechanism

### Sync Process (Two-Phase)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SYNC BUTTON PRESSED                              │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: PULL                                                           │
│  ─────────────                                                           │
│  1. Client sends: POST /api/sync/pull { lastPulledAt, schemaVersion }    │
│  2. Server returns: { changes: {...}, timestamp }                        │
│  3. Client applies remote changes with LWW conflict resolution           │
│  4. Client saves new lastPulledAt timestamp                              │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: PUSH                                                           │
│  ─────────────                                                           │
│  1. Client collects local changes (where _status != 'synced')            │
│  2. Client sends: POST /api/sync/push { changes, lastPulledAt }          │
│  3. Server applies changes with LWW conflict resolution                  │
│  4. Server returns: { ok: true }                                         │
│  5. Client marks local records as 'synced'                               │
└──────────────────────────────────────────────────────────────────────────┘
```

### LWW Conflict Resolution

```
LOCAL record:  { id: "abc", title: "Buy milk",    updated_at: 1000 }
REMOTE record: { id: "abc", title: "Buy almond",  updated_at: 1200 }

                    ┌─────────────────────────┐
                    │   Compare updated_at    │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
        local > remote    local == remote   remote > local
              │                 │                 │
              ▼                 ▼                 ▼
        LOCAL WINS       SERVER WINS        REMOTE WINS
                         (tie-breaker)
```

---

## Field Mapping (Local vs Remote)

**Key Concept:** Local database column names do NOT need to match remote database column names. The sync layer handles the translation.

| Local (WatermelonDB) | Remote (PostgreSQL) | Description |
|---------------------|---------------------|-------------|
| `title` | `name` | Category/Todo title |
| `description` | `details` | Todo description |
| `is_completed` | `done` | Todo completion status |
| `created_at` | `created_timestamp` | Record creation time |
| `updated_at` | `modified_at` | Last modification time |

### Transform Functions Location
- **Pull (Remote → Local):** `POCs-backend/src/services/syncService.ts` → `transformCategoryToLocal()`, `transformTodoToLocal()`
- **Push (Local → Remote):** `POCs-backend/src/services/syncService.ts` → `processCategoryChanges()`, `processTodoChanges()`

---

## Project Structure

```
POCs/                                    # React Native Frontend
├── App.tsx                              # App entry with auth state
├── src/
│   ├── app/navigation/                  # React Navigation setup
│   │   ├── RootNavigator.tsx
│   │   ├── MainTabNavigator.tsx
│   │   ├── TodosNavigator.tsx
│   │   └── CategoriesNavigator.tsx
│   ├── db/                              # WatermelonDB setup
│   │   ├── database.ts                  # DB instance + resetDatabase()
│   │   ├── schema.ts                    # Table schemas
│   │   ├── models/                      # Model classes
│   │   │   ├── Category.ts
│   │   │   ├── Todo.ts
│   │   │   └── SyncEvent.ts
│   │   └── migrations.ts
│   ├── features/
│   │   ├── auth/screens/LoginScreen.tsx # Login/Register UI
│   │   ├── todos/
│   │   │   ├── screens/                 # Todo list, detail, form
│   │   │   ├── hooks/useTodos.ts
│   │   │   └── repository.ts            # Todo CRUD operations
│   │   └── categories/
│   │       ├── screens/
│   │       ├── hooks/useCategories.ts
│   │       └── repository.ts
│   ├── services/
│   │   └── authService.ts               # Auth + logout (clears DB)
│   ├── sync/
│   │   ├── syncEngine.ts                # Main sync orchestrator
│   │   ├── httpTransport.ts             # HTTP API calls
│   │   ├── lwwResolver.ts               # LWW conflict logic
│   │   └── types.ts
│   └── shared/
│       ├── ui/                          # Reusable components
│       └── utils/                       # Helpers (uuid, logger, date)
└── package.json

POCs-backend/                            # Node.js Backend
├── src/
│   ├── index.ts                         # Express app entry
│   ├── config/database.ts               # PostgreSQL connection
│   ├── middleware/auth.ts               # Auth middleware
│   ├── routes/
│   │   ├── auth.ts                      # /api/auth/*
│   │   ├── categories.ts                # /api/categories/*
│   │   ├── todos.ts                     # /api/todos/*
│   │   └── sync.ts                      # /api/sync/pull, /api/sync/push
│   ├── services/
│   │   ├── authService.ts
│   │   ├── categoryService.ts
│   │   ├── todoService.ts
│   │   └── syncService.ts               # LWW + field mapping
│   └── db/migrations/
│       └── 001_initial_schema.sql
├── .env
└── package.json
```

---

## Prerequisites & Version Compatibility

### Required Versions

| Tool | Version | Check Command |
|------|---------|---------------|
| Node.js | >= 20.x (tested with 24.x) | `node --version` |
| npm | >= 10.x | `npm --version` |
| Ruby | >= 2.6.x (for CocoaPods) | `ruby --version` |
| CocoaPods | >= 1.14.x | `pod --version` |
| Xcode | >= 15.x | `xcodebuild -version` |
| PostgreSQL | 16.x | `/opt/homebrew/opt/postgresql@16/bin/psql --version` |

### Install Prerequisites (macOS)

```bash
# Install Node.js via nvm
nvm install 24
nvm use 24

# Install PostgreSQL
brew install postgresql@16
brew services start postgresql@16

# Install CocoaPods
sudo gem install cocoapods
```

---

## Setup & Running the Project

### 1. Clone and Setup Frontend

```bash
cd /Users/aman/Desktop/POCs

# Install dependencies
yarn install

# Install iOS pods
cd ios && pod install && cd ..
```

### 2. Setup Backend

```bash
cd /Users/aman/Desktop/POCs-backend

# Install dependencies
npm install

# Create database
/opt/homebrew/opt/postgresql@16/bin/createdb todo_poc

# Run migrations
npm run migrate
```

### 3. Start the Backend Server

```bash
cd /Users/aman/Desktop/POCs-backend
npm run dev

# Server runs at http://localhost:3000
# Verify: curl http://localhost:3000/health
```

### 4. Start the React Native App

```bash
cd /Users/aman/Desktop/POCs

# Terminal 1: Start Metro bundler
npx react-native start --reset-cache

# Terminal 2: Run iOS app
npx react-native run-ios
```

### 5. Test the App

1. **Register** a new user (email + password)
2. **Create** categories and todos
3. **Tap Sync** button to push data to server
4. **Logout** and login with different user
5. Verify data isolation works

---

## Database Query Commands

### PostgreSQL (Remote Database)

```bash
# Connect to database
/opt/homebrew/opt/postgresql@16/bin/psql -d todo_poc

# Or run queries directly:
```

**List all users:**
```sql
SELECT id, email, created_timestamp FROM users;
```

**Get categories for a user:**
```sql
SELECT c.id, c.name, c.created_timestamp, c.modified_at 
FROM categories c 
JOIN users u ON c.user_id = u.id 
WHERE u.email = 'your@email.com' AND c.is_deleted = FALSE;
```

**Get todos for a user:**
```sql
SELECT t.id, t.name, t.details, t.done, c.name as category_name
FROM todos t
JOIN users u ON t.user_id = u.id
LEFT JOIN categories c ON t.category_id = c.id
WHERE u.email = 'your@email.com' AND t.is_deleted = FALSE;
```

**Count records per user:**
```sql
SELECT u.email,
       COUNT(DISTINCT c.id) as category_count,
       COUNT(DISTINCT t.id) as todo_count
FROM users u
LEFT JOIN categories c ON c.user_id = u.id AND c.is_deleted = FALSE
LEFT JOIN todos t ON t.user_id = u.id AND t.is_deleted = FALSE
GROUP BY u.email;
```

---

### WatermelonDB (Local Database on Device/Simulator)

**Step 1: Find the database file**
```bash
find ~/Library/Developer/CoreSimulator/Devices -name "watermelonTodoPOC.db" 2>/dev/null
```

**Step 2: Set the path variable**
```bash
# Replace with actual path from Step 1
DB_PATH="/Users/aman/Library/Developer/CoreSimulator/Devices/356EE00B-EC2D-4BA4-AB1E-C84C32ADFCDD/data/Containers/Data/Application/2DDD4159-BD72-48C3-8846-B2B2CFFA2373/Documents/watermelonTodoPOC.db"
```

**Step 3: Query the database**

```bash
# List all tables
sqlite3 "$DB_PATH" ".tables"

# View categories (local uses 'title', not 'name')
sqlite3 "$DB_PATH" -header -column "SELECT id, title, _status FROM categories;"

# View todos
sqlite3 "$DB_PATH" -header -column "SELECT id, title, description, is_completed, _status FROM todos;"

# View sync events (conflict audit log)
sqlite3 "$DB_PATH" -header -column "SELECT * FROM sync_events;"

# Interactive mode
sqlite3 "$DB_PATH"
```

**Important columns in local DB:**
- `_status`: `synced` | `created` | `updated` | `deleted` - tracks sync state
- `_changed`: comma-separated list of changed fields

---

## Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│  Set Token  │────▶│  Auto-Sync  │
│   Screen    │     │  on HTTP    │     │  (Pull)     │
└─────────────┘     │  Transport  │     └─────────────┘
                    └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Logout    │────▶│ Clear Auth  │────▶│ Clear Local │────▶│ Clear Sync  │
│   Button    │     │  Tokens     │     │  Database   │     │  State      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**Key Files:**
- `src/services/authService.ts` - Login, logout, token management
- `src/db/database.ts` - `resetDatabase()` clears all local data
- `src/sync/syncEngine.ts` - `clearLastPulledAt()` resets sync state

---

## Sync Protocol Details

### Pull Request
```
POST /api/sync/pull
Authorization: Bearer <userId>

{
  "lastPulledAt": 1706450000000,  // null for first sync
  "schemaVersion": 1
}
```

### Pull Response
```json
{
  "changes": {
    "categories": {
      "created": [{ "id": "...", "title": "Work", "created_at": 123, "updated_at": 456 }],
      "updated": [],
      "deleted": ["id1", "id2"]
    },
    "todos": {
      "created": [],
      "updated": [{ "id": "...", "title": "Buy milk", ... }],
      "deleted": []
    }
  },
  "timestamp": 1706450100000
}
```

### Push Request
```
POST /api/sync/push
Authorization: Bearer <userId>

{
  "changes": {
    "categories": {
      "created": [...],
      "updated": [...],
      "deleted": ["id1"]
    },
    "todos": { ... }
  },
  "lastPulledAt": 1706450100000
}
```

### Push Response
```json
{
  "ok": true,
  "conflicts": [
    {
      "recordId": "abc",
      "collection": "todos",
      "winner": "local",
      "localUpdatedAt": 1706450200000,
      "remoteUpdatedAt": 1706450100000,
      "reason": "Local timestamp > remote"
    }
  ]
}
```

---

## Troubleshooting

### Backend Issues

**PostgreSQL not running:**
```bash
brew services start postgresql@16
```

**Database doesn't exist:**
```bash
/opt/homebrew/opt/postgresql@16/bin/createdb todo_poc
cd /Users/aman/Desktop/POCs-backend && npm run migrate
```

**Port 3000 already in use:**
```bash
lsof -i :3000
kill -9 <PID>
```

### Frontend Issues

**Metro bundler cache issues:**
```bash
npx react-native start --reset-cache
```

**Pod install fails:**
```bash
cd ios
pod deintegrate
pod install --repo-update
cd ..
```

**Simulator reset:**
```bash
xcrun simctl erase all
```

### Sync Issues

**Check if sync is working:**
1. Create a todo in the app
2. Tap Sync
3. Query PostgreSQL: `SELECT * FROM todos;`
4. Verify the record appears with correct `name` field (mapped from `title`)

**Check local sync status:**
```bash
sqlite3 "$DB_PATH" "SELECT id, title, _status FROM todos;"
```
- `_status = 'synced'` means it was pushed successfully
- `_status = 'created'` means it's pending push

---

## API Endpoints Reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login, get token | No |
| GET | `/api/categories` | List user's categories | Yes |
| POST | `/api/categories` | Create category | Yes |
| PUT | `/api/categories/:id` | Update category | Yes |
| DELETE | `/api/categories/:id` | Soft delete category | Yes |
| GET | `/api/todos` | List user's todos | Yes |
| POST | `/api/todos` | Create todo | Yes |
| PUT | `/api/todos/:id` | Update todo | Yes |
| DELETE | `/api/todos/:id` | Soft delete todo | Yes |
| POST | `/api/sync/pull` | Pull changes from server | Yes |
| POST | `/api/sync/push` | Push changes to server | Yes |

**Auth Header:** `Authorization: Bearer <userId>`

---

## Future Enhancements

- [ ] Add real password hashing (bcrypt)
- [ ] Implement JWT tokens with expiration
- [ ] Add optimistic UI updates
- [ ] Implement batch sync for large datasets
- [ ] Add retry logic for failed syncs
- [ ] Implement real-time sync with WebSockets
- [ ] Add data encryption for local database

---

*Last Updated: January 2026*
