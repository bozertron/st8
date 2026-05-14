# 🚀 LOCK 'EM UP LOUIS - Installation & Quick Start Guide

## Welcome! 👮

You now have **Lock 'em up Louis**, the complete LLM Productivity Suite that combines:
- **👮 Louis** - Protects your codebase from accidental modifications
- **🎨 Connie** - Converts your databases to AI-friendly formats
- **📚 Carl** - Generates perfect context for your LLM chats

---

## ⚡ Quick Installation (5 minutes)

### Step 1: Install PyQt6 (One-time)

```bash
pip install --user PyQt6
```

### Step 2: Make the Application Executable

```bash
chmod +x ~/lock_em_up_louis.py
```

### Step 3: Launch Louis!

```bash
~/lock_em_up_louis.py
```

**That's it!** A beautiful window should appear. Welcome to the Warden's Office! 👮

---

## 🎯 What You're Now Seeing

### The Three Tabs (Your New Command Center)

#### 1️⃣ **LOUIS THE WARDEN** 👮
**Purpose:** Protect your frozen core from accidental changes.

**What it does:**
- Shows all files in your protected list
- Green ✅ = Locked (Read-only, safe)
- Yellow ⚠️ = Unlocked (Writable, vulnerable)
- Click any warning symbol to instantly lock the file
- Click any green lock to unlock (with confirmation)
- Big red "Lock All Files" button for security lockdown

**How to use:**
1. See a file you need to modify? Click the ⚠️ symbol
2. Need to secure everything? Click "🔒 Lock All Files"
3. Not sure what's locked? Click "🔄 Refresh" to check
4. New files detected? Louis tells you and asks if you want to protect them!

---

#### 2️⃣ **CONNIE THE CONVERTER** 🎨
**Purpose:** Keep your databases LLM-ready.

**What it does:**
- Auto-detects SQLite `.db` files in your project
- Shows "Last Updated" timestamp for each database
- One-click "🔄 Refresh Context" to update the Markdown file
- Exports to 4 formats: Markdown (for LLMs!), JSON, SQL, CSV

**How to use:**
1. Connie scans your project and finds all `.db` files
2. Click the "🔄 Refresh Context" button next to any database
3. Connie creates a `[database_name].md` file
4. Use that `.md` file to feed database schema & data to your LLM

**Where the files go:**
```
Your Project Root/
└── Louis_Context/
    ├── my_database.md      ← Use this for LLM!
    ├── my_database.json
    ├── my_database.sql
    └── my_database_CSV/
```

---

#### 3️⃣ **CARL THE CONTEXTUALIZER** 📚
**Purpose:** Bundle perfect context for your LLM chats.

**What it does:**
- Shows all your important code files
- Checkboxes to select which files you want to include
- "📋 Generate & Copy Context" button that instantly copies everything to your clipboard
- Preview button to see what will be sent

**How to use:**
1. Check the boxes next to important files (API reference, types, guidelines, etc.)
2. Click "📋 Generate & Copy Context"
3. Paste directly into your LLM chat
4. The LLM now has PERFECT context about your codebase!

**Example workflow:**
```
You:    "I need to add a new widget to the platform"
        (Select: types.ts, API reference, Sandbox guidelines)
        (Click: Generate & Copy Context)
        (Paste into LLM chat)

LLM:    "Perfect! I see your type system, the API, and sandbox rules.
         Here's the new Widget interface..."
```

---

## 📋 Default Setup Checklist

- [ ] Installed PyQt6
- [ ] Made `lock_em_up_louis.py` executable
- [ ] Launched the app (see the three tabs?)
- [ ] Clicked "🔄 Refresh" in Louis tab (see your protected files?)
- [ ] Scanned for databases in Connie tab (any `.db` files found?)
- [ ] Checked Carl tab (see your code files?)

**Everything working?** You're ready to be productive! 🚀

---

## 🔧 Configuration (Optional but Recommended)

### Customize Your Protected Files List

Louis reads from: `~/.louis-control/protected-files.txt`

This file contains the list of files that should be protected. To add/remove files:

```bash
nano ~/.louis-control/protected-files.txt
```

Add one file path per line:
```
src/platform/types.ts
src/components/MyComponent.vue
index.html
```

Save and exit. Next time you click "🔄 Refresh" in Louis, the new list is loaded.

### Change Your Project Root

By default, Louis looks for your Collabkit project at:
```
~/JFDI - Collabkit/Application
```

If your project is elsewhere, edit the first few lines of `lock_em_up_louis.py`:

```python
self.project_root = Path.home() / "YOUR" / "PATH" / "HERE"
```

---

## 📖 The Three Workflows

### Workflow 1: Daily Development (No Unlocking)

You're building a new feature in the **sandbox** (e.g., `src/modules/whiteboard/`):

```
1. Launch Louis
2. Check that all FROZEN CORE files are locked (they are!)
3. Tell Connie to refresh your databases
4. Work in src/modules/ - no protection here, you're free!
5. When done, tell Carl to bundle your context for the LLM
```

No unlocking needed. Fast and safe. ✅

---

### Workflow 2: Core Changes (Unlock Required)

You need to modify a protected file like `src/platform/types.ts`:

```
1. Launch Louis
2. Click the ⚠️ symbol next to types.ts
3. Tell the LLM: "UNLOCK: src/platform/types.ts"
4. LLM makes the change
5. Review the change carefully
6. Come back to Louis and click the ✅ symbol (Lock it)
7. Commit with confidence
```

Deliberate. Safe. Your LLM knows it's a big deal. ✅

---

### Workflow 3: Context-First Development (Best Practice)

You're giving your LLM perfect context:

```
1. Open Louis, Connie, Carl in three side-by-side windows
2. In Louis: Verify all core files are locked ✅
3. In Connie: Click "Refresh" on your database 🔄
4. In Carl: Select all relevant files and copy context 📋
5. Paste context into LLM chat
6. LLM now has PERFECT awareness of your system
7. Start building features in sandbox
```

Professional. Productive. Your LLM is bulletproof. ✅

---

## 🚨 Common Questions

**Q: I see a file is unlocked. What do I do?**
A: Click the yellow ⚠️ symbol to lock it. Don't unlock unless you intend to modify it.

**Q: Can I modify sandbox files freely?**
A: Yes! `src/modules/` and `src/features/` are yours to hack on. Connie and Carl won't interfere.

**Q: How do I know which files I should add to the protected list?**
A: Louis will scan and tell you! Click "🔍 Scan for New Files" and it'll alert you to anything suspicious.

**Q: Can I modify the protected-files.txt manually?**
A: Yes! `~/.louis-control/protected-files.txt` is just a text file. Edit it, save, click "Refresh" in Louis.

**Q: What if I accidentally modify a protected file?**
A: Don't worry! Git will catch it. The pre-commit hook prevents commits to protected files. Revert with `git checkout <file>`.

**Q: Does Louis slow down my system?**
A: No! Louis is lightweight. It only scans when you click buttons.

**Q: Can I use Louis on a team?**
A: Yes! The protected-files.txt can be version-controlled. Share it via Git!

---

## 🎓 Advanced Features

### Auto-Git-Hook Installation

Louis can install a Git pre-commit hook that prevents commits to protected files:

```
Click: "🔧 Install Git Hook" in Louis tab
```

Now, if you accidentally try to commit a protected file, Git will block it automatically. Double safety net! 🎯

### Dynamic File Scanning

Louis automatically detects new files in your protected folders:

- Rename a file in `src/platform/`? Louis notices!
- Create a new component? Louis asks if you want to protect it!
- Check the status anytime with "🔄 Refresh"

### Database Versioning with Connie

Every time you click "🔄 Refresh Context", Connie creates a new Markdown snapshot:

```
Louis_Context/
├── my_database.md          (Latest)
├── my_database_backup.md   (Previous)
└── my_database_2025.md     (Timestamped)
```

Perfect for tracking schema changes over time!

---

## 📞 Support & Troubleshooting

### Louis won't start

```bash
python3 ~/lock_em_up_louis.py
```

(Run with explicit Python to see error messages)

### "ModuleNotFoundError: PyQt6"

```bash
pip install --user PyQt6
```

### Files showing as "MISSING" in Louis

The files don't exist yet, or the path is wrong. Edit `protected-files.txt` to match your actual project structure.

### Connie found 0 databases

Connie looks for `*.db` and `*.sqlite` files. If you don't have any, create a test one:

```bash
sqlite3 ~/test.db "CREATE TABLE test (id INTEGER, name TEXT);"
```

### Carl shows no files

Your project root might be wrong. Edit the first lines of `lock_em_up_louis.py` to point to your actual project.

---

## 🎉 You're All Set!

**Welcome to the Lock 'em up Louis command center!** 

You now have:
- ✅ A warden protecting your code
- ✅ A converter making your databases AI-friendly
- ✅ A contextualizer bundling perfect LLM input

**Ready to be productive?** 

1. Launch Louis: `~/lock_em_up_louis.py`
2. Check each tab
3. Start building features in the sandbox
4. Use Carl to feed your LLM perfect context
5. Sleep soundly knowing your core is protected 😴

---

## 📬 Version Info

- **Application:** Lock 'em up Louis v1.0
- **Created:** December 2025
- **Dependencies:** Python 3.8+, PyQt6
- **Platform:** Linux (Tested on Fedora 43)
- **Status:** ✅ Production Ready

---

**Lock 'em up, Louis!** 👮🔒
