# LOCK 'EM UP LOUIS - Complete Technical Reference

## Application Architecture

### Three Integrated Modules

**Lock 'em up Louis** is a unified PyQt6 application with three distinct functional modules running in a single window:

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCK 'EM UP LOUIS 👮 - LLM Productivity Suite                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  👮 LOUIS       │  │  🎨 CONNIE      │  │  📚 CARL        │  │
│  │   (Warden)      │  │  (Converter)    │  │ (Contextualizer)│  │
│  │                 │  │                 │  │                 │  │
│  │ • Lock/Unlock   │  │ • Scan DBs      │  │ • Select Files  │  │
│  │ • File Status   │  │ • Convert to MD │  │ • Generate      │  │
│  │ • New File      │  │ • Export JSON   │  │   Context       │  │
│  │   Alerts        │  │ • Export SQL    │  │ • Copy to       │  │
│  │ • Git Hook      │  │ • Export CSV    │  │   Clipboard     │  │
│  │ • Protection    │  │ • Timestamps    │  │ • Preview       │  │
│  │   Summary       │  │                 │  │                 │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module 1: LOUIS THE WARDEN 👮

### Purpose
Protects your "Frozen Core" - the essential, error-free files that should never be accidentally modified.

### Key Features

#### File Protection System
```python
# File States:
✅ LOCKED      (chmod 444) - Read-only, protected
⚠️  UNLOCKED   (chmod 644) - Writable, vulnerable
❓ MISSING     - File path doesn't exist
```

#### Configuration
- **Config Location:** `~/.louis-control/`
- **Protected List:** `~/.louis-control/protected-files.txt`
- **Project Root:** `~/JFDI - Collabkit/Application` (configurable)

#### Watch Folders (Auto-Scanned)
```
src/platform/        → Platform Core APIs
src/components/      → Shell Components
src-tauri/src/       → Rust Backend
src/                 → Application Shell
```

#### Operations

**Lock a File:**
```python
warden.lock_file("src/platform/types.ts")
# Sets chmod 444 (read-only)
# Returns: (success: bool, message: str)
```

**Unlock a File:**
```python
warden.unlock_file("src/platform/types.ts")
# Sets chmod 644 (read-write)
# Returns: (success: bool, message: str)
```

**Lock All Files:**
```python
locked_count, failed_count = warden.lock_all()
```

**Install Git Hook:**
```python
success, msg = warden.install_git_hook()
# Creates pre-commit hook to prevent commits to protected files
```

#### UI Components

**File Status Table:**
- Column 1: Status indicator (✅/⚠️/❓)
- Column 2: File path
- Column 3: Exists (✓/✗)
- Column 4: Action button (Lock/Unlock)

**System Status Bar:**
- Shows current protection state
- "🔒 SYSTEM SECURE" (all locked)
- "⚠️  SYSTEM VULNERABLE" (files unlocked)

**Action Buttons:**
- 🔄 **Refresh** - Reload file states
- 🔒 **Lock All Files** - Secure everything (big red button)
- 🔧 **Install Git Hook** - Add git safety net
- 🔍 **Scan for New Files** - Find unprotected files

#### Workflow

**Basic Protection:**
```
1. Launch Louis
2. Click "🔄 Refresh" to see current state
3. Any yellow ⚠️ symbols? Click them to lock
4. Done! Click "🔒 Lock All Files" to be 100% sure
```

**When You Need to Modify Core:**
```
1. In Louis, click the ✅ green lock next to the file you need
2. Confirm the unlock (safety prompt)
3. File is now unlocked (yellow ⚠️)
4. Tell your LLM: "UNLOCK: src/platform/types.ts"
5. LLM makes the change
6. Review the change carefully
7. Click the ⚠️ warning to lock it again
```

---

## Module 2: CONNIE THE CONVERTER 🎨

### Purpose
Keep your SQLite databases in LLM-friendly formats. Auto-detects, converts, and manages database context.

### Key Features

#### Database Detection
- Scans project root and subdirectories
- Finds `*.db` and `*.sqlite` files
- Avoids `.git`, `node_modules`, other noise
- Shows last modified timestamp

#### Conversion Engine

**Supported Output Formats:**

1. **Markdown** (Primary for LLMs)
   - Schema with column types
   - Sample data (first 10 rows)
   - Human-readable
   - Perfect for LLM context

2. **JSON** (Structured Data)
   - All data as JSON objects
   - Preserves data types
   - Complete database dump

3. **SQL** (Complete Backup)
   - Full `sqlite3 .dump` output
   - Can recreate database exactly
   - Good for version control

4. **CSV** (Per-Table Files)
   - One CSV per table
   - Easy to import elsewhere
   - Spreadsheet-friendly

#### Operations

**Convert Database:**
```python
connie = ConnieConverter(Path("/path/to/database.db"))

# Generate formats
markdown = connie.export_markdown()
json_str = connie.export_json()
sql_str = connie.export_sql()
csv_paths = connie.export_csv(output_dir)
```

**Get Database Schema:**
```python
schema = connie.get_schema()
# Returns: Dict[table_name] -> List[column_info]
```

#### Output Location

**Default Output Directory:**
```
Project Root/
└── Louis_Context/
    ├── database_name.md
    ├── database_name.json
    ├── database_name.sql
    └── database_name_CSV/
        ├── table1.csv
        ├── table2.csv
        └── ...
```

#### UI Components

**Database Table:**
- Column 1: Database name
- Column 2: Relative path
- Column 3: Last updated (timestamp)
- Column 4: "🔄 Refresh Context" button

**Action Buttons:**
- 🔄 **Refresh Database List** - Rescan for DBs
- ➕ **Add Database** - Manually select a DB file

**Conversion Worker:**
- Runs in background thread
- Shows progress (Markdown → JSON → SQL → CSV)
- Non-blocking UI

#### Workflow

**Convert Your First Database:**
```
1. Launch Louis
2. Go to "🎨 Connie" tab
3. See any databases listed? Great!
4. Click "🔄 Refresh Context" next to the database
5. Connie converts to 4 formats
6. Look in Louis_Context/ folder
7. Use the .md file to feed your LLM!
```

**Add Database Manually:**
```
1. Click "➕ Add Database"
2. Select your .db file
3. Click "🔄 Refresh Context"
4. Done!
```

**Use with LLM:**
```
You:  Copy the contents of database.md
You:  Paste into LLM chat with your question
LLM:  "I see your database schema. Here's what you should do..."
```

---

## Module 3: CARL THE CONTEXTUALIZER 📚

### Purpose
Generate perfect, focused context for LLM conversations. Bundle code, schemas, and guidelines into a single clipboard-ready package.

### Key Features

#### Context Generation

**Automatic File Discovery:**
- Reads your protected files from Louis
- Finds database conversions from Connie
- Lists important context files:
  - API references
  - Sandbox guidelines
  - Type definitions
  - Database schemas

#### File Selection
- Checkboxes for each file
- "Select All" and "Clear All" buttons
- Shows file paths clearly

#### Context Formatting

**Output Format (XML-wrapped):**
```xml
╔════════════════════════════════════════════════════════════════╗
║  LOCK 'EM UP LOUIS - LLM CONTEXT PACKAGE                      ║
║  Generated: 2025-12-20 17:30:45                               ║
╚════════════════════════════════════════════════════════════════╝

<file path="src/platform/types.ts">
// [actual file contents here]
</file>

<file path="A277_Database.md">
# Database Schema
// [actual file contents here]
</file>

<file path="07_SANDBOX_DEVELOPMENT_GUIDELINES.txt">
// [actual file contents here]
</file>
```

#### Operations

**Generate Context:**
```python
carl = CarlContextualizer(project_root)
selected_files = ["src/platform/types.ts", "database.md", "guidelines.txt"]
context = carl.generate_context(selected_files, include_header=True)

# Copy to clipboard
clipboard = QApplication.clipboard()
clipboard.setText(context)
```

**Read Individual File:**
```python
content = carl.read_file("src/platform/types.ts")
```

#### UI Components

**File Selection Table:**
- Column 1: Checkbox
- Column 2: File path (with relative path)

**Control Buttons:**
- ✅ **Select All** - Check all files
- 🗑️ **Clear All** - Uncheck all files
- 📋 **Generate & Copy Context** - Create and copy to clipboard
- 👁️  **Preview** - Show in dialog before copying

**Status Label:**
```
✅ Context copied to clipboard (8 files, 45,382 chars)
```

#### Workflow

**Basic Context Generation:**
```
1. Go to "📚 Carl" tab
2. Check boxes next to:
   - src/platform/types.ts (for type info)
   - A277_Database.md (for data schema)
   - 07_SANDBOX_DEVELOPMENT_GUIDELINES.txt (for rules)
3. Click "📋 Generate & Copy Context"
4. Go to your LLM chat
5. Paste (Ctrl+V)
6. Say: "Here's my codebase context. I need to..."
7. LLM responds with perfect understanding!
```

**Advanced: Context by Feature**

Create multiple context bundles:

**For API Development:**
```
Selected:
- src/platform/types.ts
- src/platform/useModule.ts
- src/platform/registry.ts
```

**For Database Work:**
```
Selected:
- A277_Database.md
- src-tauri/src/storage.rs
- 06_CODEBASE_API_REFERENCE.txt
```

**For New Module Creation:**
```
Selected:
- 07_SANDBOX_DEVELOPMENT_GUIDELINES.txt
- src/modules/_template/
- A277_Database.md
```

---

## Data Flow Diagrams

### The Three Systems Work Together

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR CODEBASE                                 │
│                                                                   │
│  src/platform/        src-tauri/        src/modules/            │
│  (Frozen Core)        (Frozen Core)     (Sandbox - Free!)       │
└─────────────────────────────────────────────────────────────────┘
       ↓                     ↓                    ↓
    LOUIS           (Auto-Protected)        (No Protection)
    ┌───────────────────────────────────────────────────────────┐
    │ Scans → Detects New Files → Asks to Protect               │
    └───────────────────────────────────────────────────────────┘
           ↓ (Status)
       ✅/⚠️ Display

┌─────────────────────────────────────────────────────────────────┐
│                 YOUR DATABASES (.db files)                       │
└─────────────────────────────────────────────────────────────────┘
       ↓
    CONNIE
    ┌───────────────────────────────────────────────────────────┐
    │ Scans → Converts → Exports to MD/JSON/SQL/CSV             │
    └───────────────────────────────────────────────────────────┘
           ↓ (Markdown Output)
    Louis_Context/database.md

┌─────────────────────────────────────────────────────────────────┐
│                 CODE + CONTEXT FILES                             │
│                                                                   │
│  Louis Protected Files + Connie Output + Guidelines             │
└─────────────────────────────────────────────────────────────────┘
       ↓
    CARL
    ┌───────────────────────────────────────────────────────────┐
    │ Selects → Bundles → Wraps XML → Copies Clipboard         │
    └───────────────────────────────────────────────────────────┘
           ↓ (Context Package)
       Your LLM Chat
           ↓
      Perfect Response!
```

---

## Configuration Files

### ~/.louis-control/ Directory

```
~/.louis-control/
├── protected-files.txt      (List of files to protect)
└── lock-history.log        (Audit trail)
```

### protected-files.txt Format

```
# Lock 'em up Louis - Protected Files
# Generated: 2025-12-20 17:30:45
# Edit this list to add/remove protected files

# Root Config
index.html
package.json
vite.config.ts

# Platform Core
src/platform/types.ts
src/platform/useModule.ts

# Rust Backend
src-tauri/src/main.rs
src-tauri/src/lib.rs
```

**Rules:**
- One file per line
- Lines starting with `#` are comments
- Empty lines are ignored
- Paths are relative to project root

### Editing Configuration

```bash
# View current protected files
cat ~/.louis-control/protected-files.txt

# Edit the list
nano ~/.louis-control/protected-files.txt

# View lock history
tail ~/.louis-control/lock-history.log
```

---

## System Requirements

| Requirement | Details |
|------------|---------|
| **OS** | Linux (Fedora 43+ recommended) |
| **Python** | 3.8+ |
| **Dependencies** | PyQt6 (auto-installable) |
| **Storage** | ~200MB (application + context) |
| **RAM** | ~150MB idle |

### Installation

```bash
# Install dependencies
pip install --user PyQt6

# Make executable
chmod +x ~/lock_em_up_louis.py

# Launch
~/lock_em_up_louis.py
```

---

## Keyboard Shortcuts & Tips

### Global Shortcuts
- **Tab Navigation:** Click the three tabs at top
- **Copy to Clipboard:** Automatic when Carl generates context

### Louis Shortcuts
- **Quick Lock All:** Click big red button (🔒 Lock All Files)
- **Quick Refresh:** Click 🔄 Refresh button
- **Quick Scan:** Click 🔍 Scan for New Files

### Connie Shortcuts
- **Refresh All DBs:** Click 🔄 Refresh Database List
- **Refresh One DB:** Click 🔄 button next to database name

### Carl Shortcuts
- **Select All Files:** Click ✅ Select All
- **Deselect All:** Click 🗑️ Clear All
- **Preview Before Copy:** Click 👁️ Preview

---

## Troubleshooting

### Louis won't start
```bash
python3 ~/lock_em_up_louis.py
# Check console output for errors
```

### PyQt6 not found
```bash
pip install --user PyQt6
```

### Project root path wrong
Edit `lock_em_up_louis.py`, find this line:
```python
self.project_root = Path.home() / "JFDI - Collabkit" / "Application"
```
Change to your actual path.

### Connie finds 0 databases
- Manually add with "➕ Add Database"
- Or create a test DB: `sqlite3 ~/test.db "CREATE TABLE t (id INTEGER);"`

### Carl shows no files
- Make sure Louis config is loaded properly
- Check `~/.louis-control/protected-files.txt` exists

### Files showing MISSING in Louis
- File was deleted or path changed
- Edit `~/.louis-control/protected-files.txt` to update paths

### Can't unlock a file
- File might be in use
- Try closing the file in your editor
- Or run: `lsof ~/JFDI\ -\ Collabkit/Application/src/platform/types.ts`

---

## Version History

### v1.0 (2025-12-20)
- ✅ Initial release
- ✅ All three modules functional
- ✅ Dark theme UI
- ✅ Full database conversion
- ✅ Context generation

---

## License & Credits

**Created:** December 2025  
**Application:** Lock 'em up Louis 👮  
**Status:** ✅ Production Ready

---

**Lock 'em up, Louis!** 👮🔒
