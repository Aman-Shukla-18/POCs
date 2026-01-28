# Quick Reference - Database Query Cheat Sheet

## PostgreSQL (Remote/Server Database)

### Connect
```bash
/opt/homebrew/opt/postgresql@16/bin/psql -d todo_poc
```

### Common Queries
```sql
-- All users
SELECT id, email, created_timestamp FROM users;

-- All categories (with user email)
SELECT u.email, c.id, c.name, c.modified_at, c.is_deleted
FROM categories c JOIN users u ON c.user_id = u.id;

-- All todos (with user email)
SELECT u.email, t.id, t.name, t.details, t.done, t.modified_at
FROM todos t JOIN users u ON t.user_id = u.id;

-- Categories for specific user
SELECT * FROM categories WHERE user_id = '<USER_ID>' AND is_deleted = FALSE;

-- Todos for specific user
SELECT * FROM todos WHERE user_id = '<USER_ID>' AND is_deleted = FALSE;

-- Count per user
SELECT u.email, 
       COUNT(DISTINCT c.id) as categories, 
       COUNT(DISTINCT t.id) as todos
FROM users u
LEFT JOIN categories c ON c.user_id = u.id AND c.is_deleted = FALSE
LEFT JOIN todos t ON t.user_id = u.id AND t.is_deleted = FALSE
GROUP BY u.email;

-- Exit
\q
```

---

## WatermelonDB (Local/Device Database)

### Find Database File
```bash
find ~/Library/Developer/CoreSimulator/Devices -name "watermelonTodoPOC.db" 2>/dev/null
```

### Set Path Variable
```bash
DB_PATH="<paste path from above>"
```

### Common Queries
```bash
# List tables
sqlite3 "$DB_PATH" ".tables"

# All categories
sqlite3 "$DB_PATH" -header -column "SELECT id, title, _status FROM categories;"

# All todos
sqlite3 "$DB_PATH" -header -column "SELECT id, title, is_completed, _status FROM todos;"

# Pending sync records (not yet pushed)
sqlite3 "$DB_PATH" "SELECT * FROM todos WHERE _status != 'synced';"

# Sync events (conflict log)
sqlite3 "$DB_PATH" -header -column "SELECT * FROM sync_events ORDER BY created_at DESC LIMIT 10;"

# Interactive mode
sqlite3 "$DB_PATH"
```

---

## Field Mapping Reference

| Local (WatermelonDB) | Remote (PostgreSQL) |
|---------------------|---------------------|
| `title` | `name` |
| `description` | `details` |
| `is_completed` | `done` |
| `created_at` | `created_timestamp` |
| `updated_at` | `modified_at` |

---

## Sync Status Values (Local DB)

| _status | Meaning |
|---------|---------|
| `synced` | Successfully synced with server |
| `created` | New record, pending push |
| `updated` | Modified record, pending push |
| `deleted` | Deleted locally, pending push |

---

## Quick Health Checks

```bash
# Backend running?
curl http://localhost:3000/health

# Metro running?
curl http://localhost:8081/status

# PostgreSQL running?
brew services list | grep postgresql
```

---

## Start Everything

```bash
# Terminal 1: PostgreSQL (if not running)
brew services start postgresql@16

# Terminal 2: Backend
cd /Users/aman/Desktop/POCs-backend && npm run dev

# Terminal 3: Metro
cd /Users/aman/Desktop/POCs && npx react-native start

# Terminal 4: iOS App
cd /Users/aman/Desktop/POCs && npx react-native run-ios
```
