#!/usr/bin/env python3
"""
╔════════════════════════════════════════════════════════════════════════════╗
║                   LOCK 'EM UP LOUIS 👮 v2.0 (FIXED v2)                     ║
║                  LLM Productivity Suite (Enhanced)                         ║
║                                                                            ║
║  FIXES IN THIS VERSION:                                                    ║
║  ✅ Setup wizard timing fixed (blocks properly)                           ║
║  ✅ Directory handling and validation correct                             ║
║  ✅ All tabs initialize AFTER config confirmed                           ║
║  ✅ Layout clearing handles None safely                                   ║
║  ✅ folder_checkboxes initialized before use                             ║
║  ✅ Parent directory scanning works correctly                             ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import sys
import os
import json
import stat
import sqlite3
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set
from datetime import datetime
from dataclasses import dataclass, asdict

from PyQt6.QtWidgets import (
    QApplication,
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QTabWidget,
    QTableWidget,
    QTableWidgetItem,
    QPushButton,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QFileDialog,
    QMessageBox,
    QCheckBox,
    QScrollArea,
    QFrame,
    QComboBox,
    QSpinBox,
    QTextEdit,
    QProgressBar,
    QHeaderView,
    QDialog,
    QRadioButton,
    QButtonGroup,
    QSizePolicy,
    QLineEdit,
    QListWidgetItem,
    QStyledItemDelegate,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer, QSize, QRect
from PyQt6.QtGui import QIcon, QColor, QFont, QTextCursor


# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION & DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════


@dataclass
class FileProtectionState:
    """Represents the state of a single file"""

    path: str
    is_locked: bool
    exists: bool
    is_new: bool = False
    last_checked: str = ""


class LouisConfig:
    """Configuration management for Louis v2.0"""

    def __init__(self):
        self.config_dir = Path.home() / ".louis-control"
        self.config_dir.mkdir(exist_ok=True)
        self.config_file = self.config_dir / "louis-config.json"
        self.protected_files_path = self.config_dir / "protected-files.txt"
        self.log_file = self.config_dir / "lock-history.log"

        self.project_root = None
        self.protected_folders = []
        self.ignore_patterns = []
        self.setup_complete = False

        self.load_or_create()

    def load_or_create(self):
        """Load configuration or mark as needing setup"""
        if self.config_file.exists():
            try:
                self.load_config()
                self.setup_complete = True
            except:
                self.setup_complete = False
        else:
            self.setup_complete = False

    def load_config(self):
        """Load configuration from file"""
        try:
            with open(self.config_file, "r") as f:
                config = json.load(f)
                self.project_root = Path(config.get("project_root", str(Path.home())))
                self.protected_folders = config.get("protected_folders", [])
                self.ignore_patterns = config.get(
                    "ignore_patterns", self.get_default_ignore_patterns()
                )
        except Exception as e:
            print(f"Error loading config: {e}")
            self.setup_complete = False

    def save_config(
        self,
        project_root: Path,
        protected_folders: List[str],
        ignore_patterns: List[str],
    ):
        """Save configuration to file"""
        config = {
            "project_root": str(project_root),
            "protected_folders": protected_folders,
            "ignore_patterns": ignore_patterns,
            "version": "2.0",
            "created": datetime.now().isoformat(),
        }

        with open(self.config_file, "w") as f:
            json.dump(config, f, indent=2)

        self.project_root = project_root
        self.protected_folders = protected_folders
        self.ignore_patterns = ignore_patterns
        self.setup_complete = True

    def get_default_ignore_patterns(self) -> List[str]:
        """Get default ignore patterns"""
        return [
            "node_modules/",
            ".git/",
            "__pycache__/",
            "dist/",
            "build/",
            ".venv/",
            "venv/",
            "*.egg-info/",
            ".pytest_cache/",
            ".mypy_cache/",
            ".coverage",
            "target/",
        ]

    def get_protected_files(self) -> List[str]:
        """Get list of protected files from protected-files.txt"""
        if not self.protected_files_path.exists():
            return []

        files = []
        with open(self.protected_files_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    files.append(line)
        return files

    def scan_protected_folders(self) -> List[str]:
        """Recursively scan protected folders and generate file list"""
        if not self.project_root or not self.protected_folders:
            return []

        protected_files = []

        for folder in self.protected_folders:
            folder_path = self.project_root / folder

            if not folder_path.exists():
                continue

            for file in folder_path.rglob("*"):
                if not file.is_file():
                    continue

                try:
                    rel_path = str(file.relative_to(self.project_root))
                except ValueError:
                    continue

                # Check if file matches any ignore pattern
                if self._should_ignore(rel_path):
                    continue

                protected_files.append(rel_path)

        return sorted(protected_files)

    def _should_ignore(self, file_path: str) -> bool:
        """Check if file should be ignored"""
        for pattern in self.ignore_patterns:
            pattern_clean = pattern.rstrip("/")
            if pattern_clean in file_path or file_path.startswith(pattern_clean):
                return True
        return False

    def generate_protected_files_list(self) -> Tuple[bool, str]:
        """Generate protected-files.txt from scanned folders"""
        try:
            protected_files = self.scan_protected_folders()

            with open(self.protected_files_path, "w") as f:
                f.write("# Lock 'em up Louis - Protected Files List\n")
                f.write(
                    f"# Auto-generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                )
                f.write(f"# Protected Folders: {', '.join(self.protected_folders)}\n")
                f.write(f"# Ignore Patterns: {', '.join(self.ignore_patterns)}\n\n")

                for file in protected_files:
                    f.write(f"{file}\n")

            return True, f"✅ Generated {len(protected_files)} protected files"
        except Exception as e:
            return False, f"❌ Error: {str(e)}"

    def log_action(self, action: str):
        """Log an action to history"""
        try:
            with open(self.log_file, "a") as f:
                f.write(f"{datetime.now().isoformat()} - {action}\n")
        except:
            pass


# ═══════════════════════════════════════════════════════════════════════════
# SETUP WIZARD DIALOG (FIXED v2)
# ═══════════════════════════════════════════════════════════════════════════


class SetupWizardDialog(QDialog):
    """Interactive setup wizard for Louis configuration"""

    def __init__(self, parent=None, existing_config: Optional[LouisConfig] = None):
        super().__init__(parent)
        self.config = existing_config or LouisConfig()
        self.setWindowTitle("Lock 'em up Louis - Setup Wizard 👮")
        self.setModal(True)
        self.resize(700, 600)
        self.setStyleSheet(self.get_dark_stylesheet())

        self.project_root = None
        self.protected_folders = []
        self.ignore_patterns = self.config.get_default_ignore_patterns()
        self.folder_checkboxes = {}  # FIXED: Initialize here!

        self.current_step = 1
        self.total_steps = 3

        self.init_ui()
        self.load_existing_config()

    def init_ui(self):
        """Initialize UI"""
        layout = QVBoxLayout()

        # Header
        self.header = QLabel("Step 1/3: Choose Project Root")
        header_font = QFont()
        header_font.setPointSize(14)
        header_font.setBold(True)
        self.header.setFont(header_font)
        layout.addWidget(self.header)

        # Description
        self.description = QLabel("")
        layout.addWidget(self.description)

        # Content area
        self.content_layout = QVBoxLayout()
        layout.addLayout(self.content_layout)

        # Buttons
        button_layout = QHBoxLayout()

        self.back_btn = QPushButton("⬅️  Back")
        self.back_btn.clicked.connect(self.previous_step)
        button_layout.addWidget(self.back_btn)

        button_layout.addStretch()

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(self.cancel_btn)

        self.next_btn = QPushButton("Next ➜")
        self.next_btn.setStyleSheet(
            "background-color: #3498db; color: white; font-weight: bold;"
        )
        self.next_btn.clicked.connect(self.next_step)
        button_layout.addWidget(self.next_btn)

        layout.addLayout(button_layout)

        self.setLayout(layout)
        self.show_step_1()

    def show_step_1(self):
        """Step 1: Choose project root"""
        self.current_step = 1
        self.header.setText("Step 1/3: Choose Project Root")
        self.description.setText("Where is your master project directory?")

        self.back_btn.setEnabled(False)
        self.next_btn.setText("Next ➜")

        # Clear content - FIXED: Handle None safely
        while self.content_layout.count():
            item = self.content_layout.takeAt(0)
            if item and item.widget():
                item.widget().deleteLater()

        # Project root selector
        root_layout = QHBoxLayout()
        self.root_input = QLineEdit()
        self.root_input.setPlaceholderText("Select project root...")
        if self.project_root:
            self.root_input.setText(str(self.project_root))
        root_layout.addWidget(self.root_input)

        browse_btn = QPushButton("📁 Browse")
        browse_btn.clicked.connect(self.browse_project_root)
        root_layout.addWidget(browse_btn)

        self.content_layout.addLayout(root_layout)
        self.content_layout.addStretch()

    def show_step_2(self):
        """Step 2: Select protection folders"""
        self.current_step = 2
        self.header.setText("Step 2/3: Select Folders to Protect")
        self.description.setText("Choose which folders should be protected:")

        self.back_btn.setEnabled(True)
        self.next_btn.setText("Next ➜")

        # Clear content - FIXED: Handle None safely
        while self.content_layout.count():
            item = self.content_layout.takeAt(0)
            if item and item.widget():
                item.widget().deleteLater()

        if not self.project_root:
            error_label = QLabel("❌ Please select a project root first")
            self.content_layout.addWidget(error_label)
            self.content_layout.addStretch()
            self.next_btn.setEnabled(False)
            return

        self.next_btn.setEnabled(True)
        project_path = Path(self.project_root)

        # List all top-level folders
        try:
            folders = sorted(
                [
                    d.name
                    for d in project_path.iterdir()
                    if d.is_dir() and not d.name.startswith(".")
                ]
            )
        except Exception as e:
            error_label = QLabel(f"❌ Error reading directory: {str(e)}")
            self.content_layout.addWidget(error_label)
            self.content_layout.addStretch()
            return

        self.folder_checkboxes = {}  # FIXED: Clear and reinitialize!

        # Create scrollable area for checkboxes
        scroll_widget = QWidget()
        scroll_layout = QVBoxLayout()

        for folder in folders:
            checkbox = QCheckBox(folder)
            if folder in self.protected_folders:
                checkbox.setChecked(True)
            self.folder_checkboxes[folder] = checkbox
            scroll_layout.addWidget(checkbox)

        scroll_layout.addStretch()
        scroll_widget.setLayout(scroll_layout)

        scroll_area = QScrollArea()
        scroll_area.setWidget(scroll_widget)
        scroll_area.setWidgetResizable(True)
        self.content_layout.addWidget(scroll_area)

    def show_step_3(self):
        """Step 3: Configure ignore patterns"""
        self.current_step = 3
        self.header.setText("Step 3/3: Configure Ignore Patterns")
        self.description.setText("Files matching these patterns will be ignored:")

        self.back_btn.setEnabled(True)
        self.next_btn.setText("✅ Finish")

        # Clear content - FIXED: Handle None safely
        while self.content_layout.count():
            item = self.content_layout.takeAt(0)
            if item and item.widget():
                item.widget().deleteLater()

        # Ignore patterns list
        self.patterns_text = QTextEdit()
        self.patterns_text.setPlainText("\n".join(self.ignore_patterns))
        self.patterns_text.setToolTip(
            "One pattern per line (e.g., node_modules/, .git/, dist/)"
        )
        self.content_layout.addWidget(QLabel("Patterns (one per line):"))
        self.content_layout.addWidget(self.patterns_text)

        # Preset buttons
        preset_layout = QHBoxLayout()

        def add_preset(name: str, patterns: List[str]):
            current = set(
                line
                for line in self.patterns_text.toPlainText().split("\n")
                if line.strip()
            )
            for p in patterns:
                if p:
                    current.add(p)
            self.patterns_text.setPlainText("\n".join(sorted(current)))

        presets = {
            "Node.js": ["node_modules/", "npm-debug.log"],
            "Python": ["__pycache__/", ".venv/", "venv/", "*.pyc"],
            "Build": ["dist/", "build/", "out/"],
            "Git": [".git/", ".gitignore"],
        }

        for name, patterns in presets.items():
            btn = QPushButton(f"+ {name}")
            btn.clicked.connect(lambda checked, n=name, p=patterns: add_preset(n, p))
            preset_layout.addWidget(btn)

        self.content_layout.addLayout(preset_layout)

    def browse_project_root(self):
        """Browse for project root"""
        folder = QFileDialog.getExistingDirectory(self, "Select Project Root")
        if folder:
            self.project_root = Path(folder)
            self.root_input.setText(str(self.project_root))

    def next_step(self):
        """Move to next step"""
        if self.current_step == 1:
            if not self.root_input.text().strip():
                QMessageBox.warning(self, "Error", "Please select a project root")
                return

            root_path = Path(self.root_input.text().strip())
            if not root_path.exists():
                QMessageBox.warning(self, "Error", f"Path does not exist: {root_path}")
                return

            self.project_root = root_path
            self.show_step_2()

        elif self.current_step == 2:
            # Save selected folders
            self.protected_folders = [
                folder
                for folder, checkbox in self.folder_checkboxes.items()
                if checkbox.isChecked()
            ]

            if not self.protected_folders:
                QMessageBox.warning(
                    self, "Error", "Please select at least one folder to protect"
                )
                return

            self.show_step_3()

        elif self.current_step == 3:
            # Save configuration
            patterns = [
                p.strip()
                for p in self.patterns_text.toPlainText().split("\n")
                if p.strip()
            ]
            self.ignore_patterns = patterns

            # Save to config
            self.config.save_config(
                self.project_root, self.protected_folders, self.ignore_patterns
            )

            # Generate protected files list
            success, msg = self.config.generate_protected_files_list()

            if success:
                QMessageBox.information(
                    self,
                    "Setup Complete",
                    f"✅ Louis is ready!\n\n"
                    f"Project Root: {self.project_root}\n"
                    f"Protected Folders: {', '.join(self.protected_folders)}\n"
                    f"{msg}",
                )
                self.accept()
            else:
                QMessageBox.critical(self, "Error", msg)

    def previous_step(self):
        """Move to previous step"""
        if self.current_step == 3:
            self.show_step_2()
        elif self.current_step == 2:
            self.show_step_1()

    def load_existing_config(self):
        """Load existing configuration"""
        if self.config.setup_complete and self.config.project_root:
            self.project_root = self.config.project_root
            self.protected_folders = self.config.protected_folders
            self.ignore_patterns = self.config.ignore_patterns

    def get_dark_stylesheet(self) -> str:
        """Dark theme stylesheet"""
        return """
        QDialog, QWidget {
            background-color: #1e1e1e;
            color: #e0e0e0;
        }
        QLabel {
            color: #e0e0e0;
        }
        QLineEdit, QTextEdit {
            background-color: #2d2d2d;
            color: #e0e0e0;
            border: 1px solid #444;
            padding: 5px;
            border-radius: 4px;
        }
        QPushButton {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
        }
        QPushButton:hover {
            background-color: #2980b9;
        }
        QCheckBox {
            color: #e0e0e0;
        }
        QScrollArea {
            background-color: #2d2d2d;
            border: 1px solid #444;
        }
        """


# ═══════════════════════════════════════════════════════════════════════════
# LOUIS - FILE PROTECTION LOGIC
# ═══════════════════════════════════════════════════════════════════════════


class LouisWarden:
    """File protection and locking operations"""

    def __init__(self, config: LouisConfig):
        self.config = config

    def get_file_state(self, rel_path: str) -> FileProtectionState:
        """Get current state of a file"""
        if not self.config.project_root:
            return FileProtectionState(path=rel_path, is_locked=False, exists=False)

        full_path = self.config.project_root / rel_path

        return FileProtectionState(
            path=rel_path,
            is_locked=not self._is_writable(full_path),
            exists=full_path.exists(),
            last_checked=datetime.now().isoformat(),
        )

    def _is_writable(self, path: Path) -> bool:
        """Check if file is writable"""
        if not path.exists():
            return False
        try:
            return os.access(path, os.W_OK)
        except:
            return False

    def lock_file(self, rel_path: str) -> Tuple[bool, str]:
        """Lock a file (chmod 444)"""
        if not self.config.project_root:
            return False, "Project root not configured"

        full_path = self.config.project_root / rel_path

        if not full_path.exists():
            return False, f"File not found: {rel_path}"

        try:
            os.chmod(full_path, stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
            self.config.log_action(f"LOCK: {rel_path}")
            return True, f"✅ Locked: {rel_path}"
        except Exception as e:
            return False, f"❌ Failed to lock: {str(e)}"

    def unlock_file(self, rel_path: str) -> Tuple[bool, str]:
        """Unlock a file (chmod 644)"""
        if not self.config.project_root:
            return False, "Project root not configured"

        full_path = self.config.project_root / rel_path

        if not full_path.exists():
            return False, f"File not found: {rel_path}"

        try:
            os.chmod(
                full_path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH
            )
            self.config.log_action(f"UNLOCK: {rel_path}")
            return True, f"🔓 Unlocked: {rel_path}"
        except Exception as e:
            return False, f"❌ Failed to unlock: {str(e)}"

    def lock_all(self) -> Tuple[int, int]:
        """Lock all protected files"""
        protected = self.config.get_protected_files()
        locked_count = 0
        failed_count = 0

        for file in protected:
            success, _ = self.lock_file(file)
            if success:
                locked_count += 1
            else:
                failed_count += 1

        return locked_count, failed_count

    def install_git_hook(self) -> Tuple[bool, str]:
        """Install git pre-commit hook"""
        if not self.config.project_root:
            return False, "Project root not configured"

        git_hooks_dir = self.config.project_root / ".git" / "hooks"

        if not git_hooks_dir.exists():
            return False, ".git/hooks directory not found"

        pre_commit_path = git_hooks_dir / "pre-commit"

        hook_script = """#!/bin/bash
# Lock 'em up Louis - Git Pre-Commit Hook
# Prevents commits to protected files

PROTECTED_FILES="$HOME/.louis-control/protected-files.txt"

if [ ! -f "$PROTECTED_FILES" ]; then
    exit 0
fi

STAGED_FILES=$(git diff --cached --name-only)
BLOCKED_FILES=""

while IFS= read -r protected; do
    [[ "$protected" =~ ^#.*$ ]] && continue
    [[ -z "${protected// }" ]] && continue
    
    if echo "$STAGED_FILES" | grep -qxF "$protected"; then
        BLOCKED_FILES="$BLOCKED_FILES\\n  • $protected"
    fi
done < "$PROTECTED_FILES"

if [ -n "$BLOCKED_FILES" ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                    COMMIT BLOCKED                              ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Protected files in your commit:"
    echo -e "$BLOCKED_FILES"
    echo ""
    echo "Commit aborted."
    exit 1
fi

exit 0
"""

        try:
            with open(pre_commit_path, "w") as f:
                f.write(hook_script)
            os.chmod(
                pre_commit_path,
                stat.S_IRWXU
                | stat.S_IRGRP
                | stat.S_IXGRP
                | stat.S_IROTH
                | stat.S_IXOTH,
            )
            return True, "✅ Git hook installed successfully"
        except Exception as e:
            return False, f"❌ Failed to install git hook: {str(e)}"


# ═══════════════════════════════════════════════════════════════════════════
# CONNIE - DATABASE CONVERSION LOGIC
# ═══════════════════════════════════════════════════════════════════════════


class ConnieConverter:
    """SQLite to Markdown/JSON/SQL/CSV conversion"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.conn = None

    def _connect(self):
        """Connect to database"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
            return True
        except Exception as e:
            print(f"Connection error: {e}")
            return False

    def _disconnect(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

    def get_schema(self) -> Dict:
        """Get database schema"""
        if not self._connect():
            return {}

        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()

        schema = {}
        for table in tables:
            table_name = table[0]
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            schema[table_name] = [
                {"name": col[1], "type": col[2], "notnull": col[3], "pk": col[5]}
                for col in columns
            ]

        self._disconnect()
        return schema

    def export_markdown(self) -> str:
        """Export database to Markdown"""
        if not self._connect():
            return "# Error: Could not connect to database\n"

        output = f"# Database: {self.db_path.name}\n\n"
        output += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()

        for table in tables:
            table_name = table[0]
            output += f"## Table: `{table_name}`\n\n"

            # Get schema
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()

            output += "### Schema\n\n"
            output += "| Column | Type | Null | PK |\n"
            output += "|--------|------|------|----|\n"
            for col in columns:
                col_name, col_type, notnull, pk = col[1], col[2], col[3], col[5]
                output += f"| {col_name} | {col_type} | {'Yes' if not notnull else 'No'} | {'Yes' if pk else 'No'} |\n"

            output += "\n### Sample Data\n\n"

            # Get sample data (first 10 rows)
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 10")
            rows = cursor.fetchall()

            if rows:
                col_names = [col[0] for col in cursor.description]
                output += "| " + " | ".join(col_names) + " |\n"
                output += "|" + "|".join(["---" for _ in col_names]) + "|\n"

                for row in rows:
                    output += (
                        "| "
                        + " | ".join(str(v) if v is not None else "NULL" for v in row)
                        + " |\n"
                    )
            else:
                output += "*No data*\n"

            output += "\n"

        self._disconnect()
        return output

    def export_json(self) -> str:
        """Export database to JSON"""
        if not self._connect():
            return "{}"

        output = {}
        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()

        for table in tables:
            table_name = table[0]
            cursor.execute(f"SELECT * FROM {table_name}")
            rows = cursor.fetchall()

            output[table_name] = [dict(row) for row in rows]

        self._disconnect()
        return json.dumps(output, indent=2, default=str)

    def export_sql(self) -> str:
        """Export database to SQL dump"""
        if not self._connect():
            return "-- Error: Could not connect to database\n"

        output = "-- SQL Dump from Lock 'em up Louis v2.0\n"
        output += f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

        for line in self.conn.iterdump():
            output += line + "\n"

        self._disconnect()
        return output

    def export_csv(self, output_dir: Path) -> List[str]:
        """Export each table to CSV"""
        if not self._connect():
            return []

        output_dir.mkdir(parents=True, exist_ok=True)
        files_created = []

        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()

        for table in tables:
            table_name = table[0]
            csv_path = output_dir / f"{table_name}.csv"

            cursor.execute(f"SELECT * FROM {table_name}")
            rows = cursor.fetchall()

            with open(csv_path, "w") as f:
                if rows:
                    headers = [col[0] for col in cursor.description]
                    f.write(",".join(headers) + "\n")

                    for row in rows:
                        f.write(
                            ",".join(str(v) if v is not None else "" for v in row)
                            + "\n"
                        )

                    files_created.append(str(csv_path))

        self._disconnect()
        return files_created


# ═══════════════════════════════════════════════════════════════════════════
# WORKER THREADS
# ═══════════════════════════════════════════════════════════════════════════


class ConversionWorker(QThread):
    """Background thread for database conversion"""

    progress = pyqtSignal(str)
    finished = pyqtSignal(bool, str)

    def __init__(self, db_path: Path, output_dir: Path):
        super().__init__()
        self.db_path = db_path
        self.output_dir = output_dir

    def run(self):
        try:
            connie = ConnieConverter(self.db_path)
            db_name = self.db_path.stem

            self.progress.emit("Converting to Markdown...")
            md_content = connie.export_markdown()
            md_path = self.output_dir / f"{db_name}.md"
            with open(md_path, "w") as f:
                f.write(md_content)

            self.progress.emit("Converting to JSON...")
            json_content = connie.export_json()
            json_path = self.output_dir / f"{db_name}.json"
            with open(json_path, "w") as f:
                f.write(json_content)

            self.progress.emit("Converting to SQL...")
            sql_content = connie.export_sql()
            sql_path = self.output_dir / f"{db_name}.sql"
            with open(sql_path, "w") as f:
                f.write(sql_content)

            self.progress.emit("Converting to CSV...")
            csv_dir = self.output_dir / f"{db_name}_CSV"
            connie.export_csv(csv_dir)

            self.finished.emit(True, f"✅ Conversion complete!")
        except Exception as e:
            self.finished.emit(False, f"❌ Error: {str(e)}")


# ═══════════════════════════════════════════════════════════════════════════
# UI COMPONENTS - TAB 1: LOUIS
# ═══════════════════════════════════════════════════════════════════════════


class LouisTab(QWidget):
    """File protection interface"""

    def __init__(self, config: LouisConfig):
        super().__init__()
        self.config = config
        self.warden = LouisWarden(config)
        self.file_states = {}

        self.init_ui()
        self.refresh_file_list()

    def init_ui(self):
        """Initialize UI"""
        layout = QVBoxLayout()

        # Header
        header = QLabel("👮 LOUIS THE WARDEN - File Protection System v2.0")
        header_font = QFont()
        header_font.setPointSize(14)
        header_font.setBold(True)
        header.setFont(header_font)
        layout.addWidget(header)

        # Status box
        status_box = QFrame()
        status_box.setStyleSheet(
            "background-color: #2d2d2d; border: 1px solid #444; border-radius: 4px; padding: 10px;"
        )
        status_layout = QVBoxLayout()

        self.status_label = QLabel("🔒 SYSTEM SECURE")
        self.status_label.setStyleSheet(
            "color: #2ecc71; font-size: 12px; font-weight: bold;"
        )
        status_layout.addWidget(self.status_label)

        self.protection_label = QLabel("")
        self.protection_label.setStyleSheet("color: #95a5a6; font-size: 11px;")
        status_layout.addWidget(self.protection_label)

        status_box.setLayout(status_layout)
        layout.addWidget(status_box)

        # File table
        self.file_table = QTableWidget()
        self.file_table.setColumnCount(4)
        self.file_table.setHorizontalHeaderLabels(
            ["Status", "File Path", "Exists", "Actions"]
        )
        self.file_table.horizontalHeader().setSectionResizeMode(
            1, QHeaderView.ResizeMode.Stretch
        )
        layout.addWidget(self.file_table)

        # Control buttons
        button_layout = QHBoxLayout()

        self.refresh_btn = QPushButton("🔄 Refresh")
        self.refresh_btn.clicked.connect(self.refresh_file_list)
        button_layout.addWidget(self.refresh_btn)

        self.reconfigure_btn = QPushButton("⚙️  Reconfigure")
        self.reconfigure_btn.clicked.connect(self.show_setup_wizard)
        button_layout.addWidget(self.reconfigure_btn)

        self.lock_all_btn = QPushButton("🔒 Lock All Files")
        self.lock_all_btn.setStyleSheet(
            "background-color: #c0392b; color: white; font-weight: bold; padding: 10px;"
        )
        self.lock_all_btn.clicked.connect(self.lock_all_files)
        button_layout.addWidget(self.lock_all_btn)

        self.install_hook_btn = QPushButton("🔧 Install Git Hook")
        self.install_hook_btn.clicked.connect(self.install_git_hook)
        button_layout.addWidget(self.install_hook_btn)

        layout.addLayout(button_layout)

        self.setLayout(layout)

    def update_status_display(self):
        """Update status display"""
        if self.config.protected_folders and self.config.project_root:
            folders_text = ", ".join(self.config.protected_folders)
            patterns_count = len(self.config.ignore_patterns)
            self.protection_label.setText(
                f"📁 Protecting: {folders_text} | 🚫 Ignoring {patterns_count} patterns"
            )
        else:
            self.protection_label.setText("⚙️  Configuration incomplete")

    def refresh_file_list(self):
        """Refresh file list"""
        protected_files = self.config.get_protected_files()
        self.file_table.setRowCount(len(protected_files))

        unlocked_count = 0

        for row, file_path in enumerate(protected_files):
            state = self.warden.get_file_state(file_path)
            self.file_states[file_path] = state

            # Status column
            if state.exists:
                status_text = "🔒" if state.is_locked else "⚠️"
                status_color = "#2ecc71" if state.is_locked else "#e74c3c"
                if not state.is_locked:
                    unlocked_count += 1
            else:
                status_text = "❓"
                status_color = "#f39c12"

            status_item = QTableWidgetItem(status_text)
            status_item.setBackground(QColor(status_color))
            status_item.setForeground(QColor("white"))
            self.file_table.setItem(row, 0, status_item)

            # Path column
            self.file_table.setItem(row, 1, QTableWidgetItem(file_path))

            # Exists column
            exists_text = "✓" if state.exists else "✗"
            self.file_table.setItem(row, 2, QTableWidgetItem(exists_text))

            # Actions column
            action_btn = QPushButton("🔓 Unlock" if state.is_locked else "🔒 Lock")
            action_btn.clicked.connect(
                lambda checked, f=file_path: self.toggle_file_lock(f)
            )
            self.file_table.setCellWidget(row, 3, action_btn)

        # Update status
        if unlocked_count == 0:
            self.status_label.setText("🔒 SYSTEM SECURE - All files locked")
            self.status_label.setStyleSheet(
                "color: #2ecc71; font-size: 12px; font-weight: bold;"
            )
        else:
            self.status_label.setText(
                f"⚠️  SYSTEM VULNERABLE - {unlocked_count} file(s) unlocked"
            )
            self.status_label.setStyleSheet(
                "color: #e74c3c; font-size: 12px; font-weight: bold;"
            )

        self.update_status_display()

    def toggle_file_lock(self, file_path: str):
        """Toggle lock status"""
        state = self.file_states.get(file_path)
        if not state:
            return

        if state.is_locked:
            success, msg = self.warden.unlock_file(file_path)
        else:
            success, msg = self.warden.lock_file(file_path)

        if success:
            self.refresh_file_list()
            QMessageBox.information(self, "Success", msg)
        else:
            QMessageBox.critical(self, "Error", msg)

    def lock_all_files(self):
        """Lock all files"""
        reply = QMessageBox.question(
            self,
            "Confirm",
            "Lock ALL protected files?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )

        if reply == QMessageBox.StandardButton.Yes:
            locked, failed = self.warden.lock_all()
            QMessageBox.information(
                self, "Complete", f"✅ Locked {locked} files\n❌ Failed: {failed}"
            )
            self.refresh_file_list()

    def install_git_hook(self):
        """Install git hook"""
        success, msg = self.warden.install_git_hook()

        if success:
            QMessageBox.information(self, "Success", msg)
        else:
            QMessageBox.critical(self, "Error", msg)

    def show_setup_wizard(self):
        """Show setup wizard"""
        wizard = SetupWizardDialog(self, self.config)
        if wizard.exec() == QDialog.DialogCode.Accepted:
            self.refresh_file_list()


# ═══════════════════════════════════════════════════════════════════════════
# UI COMPONENTS - TAB 2: CONNIE
# ═══════════════════════════════════════════════════════════════════════════


class ConnieTab(QWidget):
    """SQLite database conversion"""

    def __init__(self, config: LouisConfig):
        super().__init__()
        self.config = config
        self.databases = []

        self.init_ui()
        self.scan_databases()

    def init_ui(self):
        """Initialize UI"""
        layout = QVBoxLayout()

        # Header
        header = QLabel("🎨 CONNIE THE CONVERTER - Database Context")
        header_font = QFont()
        header_font.setPointSize(14)
        header_font.setBold(True)
        header.setFont(header_font)
        layout.addWidget(header)

        # Database list
        self.db_table = QTableWidget()
        self.db_table.setColumnCount(4)
        self.db_table.setHorizontalHeaderLabels(
            ["Database", "Path", "Last Updated", "Actions"]
        )
        self.db_table.horizontalHeader().setSectionResizeMode(
            1, QHeaderView.ResizeMode.Stretch
        )
        layout.addWidget(self.db_table)

        # Control buttons
        button_layout = QHBoxLayout()

        self.refresh_btn = QPushButton("🔄 Refresh Database List")
        self.refresh_btn.clicked.connect(self.scan_databases)
        button_layout.addWidget(self.refresh_btn)

        self.add_db_btn = QPushButton("➕ Add Database")
        self.add_db_btn.clicked.connect(self.add_database)
        button_layout.addWidget(self.add_db_btn)

        layout.addLayout(button_layout)

        self.progress_label = QLabel("")
        layout.addWidget(self.progress_label)

        self.setLayout(layout)

    def scan_databases(self):
        """Scan for databases"""
        self.databases = []

        if not self.config.project_root:
            self.db_table.setRowCount(1)
            self.db_table.setItem(0, 0, QTableWidgetItem("⚠️ Configure Louis first!"))
            return

        for db_file in self.config.project_root.rglob("*.db"):
            if ".git" not in str(db_file) and "node_modules" not in str(db_file):
                self.databases.append(db_file)

        for db_file in self.config.project_root.rglob("*.sqlite"):
            if ".git" not in str(db_file) and "node_modules" not in str(db_file):
                self.databases.append(db_file)

        self.update_database_table()

    def update_database_table(self):
        """Update database table"""
        self.db_table.setRowCount(len(self.databases))

        for row, db_path in enumerate(self.databases):
            # Name
            self.db_table.setItem(row, 0, QTableWidgetItem(db_path.name))

            # Path
            try:
                rel_path = (
                    db_path.relative_to(self.config.project_root)
                    if self.config.project_root
                    else db_path
                )
            except:
                rel_path = db_path
            self.db_table.setItem(row, 1, QTableWidgetItem(str(rel_path)))

            # Last updated
            mtime = db_path.stat().st_mtime
            updated = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
            self.db_table.setItem(row, 2, QTableWidgetItem(updated))

            # Actions
            action_btn = QPushButton("🔄 Refresh Context")
            action_btn.clicked.connect(
                lambda checked, p=db_path: self.convert_database(p)
            )
            self.db_table.setCellWidget(row, 3, action_btn)

    def convert_database(self, db_path: Path):
        """Convert database"""
        if not self.config.project_root:
            QMessageBox.warning(self, "Error", "Configure Louis first!")
            return

        output_dir = self.config.project_root / "Louis_Context"
        output_dir.mkdir(exist_ok=True)

        self.progress_label.setText(f"Converting {db_path.name}...")

        self.worker = ConversionWorker(db_path, output_dir)
        self.worker.progress.connect(lambda msg: self.progress_label.setText(msg))
        self.worker.finished.connect(self.on_conversion_complete)
        self.worker.start()

    def on_conversion_complete(self, success: bool, message: str):
        """Handle conversion completion"""
        self.progress_label.setText(message)

        if success:
            QMessageBox.information(self, "Success", message)
        else:
            QMessageBox.critical(self, "Error", message)

    def add_database(self):
        """Add database manually"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Select Database File", str(Path.home()), "SQLite (*.db *.sqlite)"
        )

        if file_path:
            db_path = Path(file_path)
            if db_path not in self.databases:
                self.databases.append(db_path)
                self.update_database_table()


# MAIN APPLICATION WINDOW
# ═══════════════════════════════════════════════════════════════════════════


class LockEmUpLouis(QMainWindow):
    """Main application window"""

    def __init__(self):
        super().__init__()
        self.config = LouisConfig()

        # CRITICAL: Show setup wizard BEFORE creating tabs
        if not self.config.setup_complete or not self.config.project_root:
            self.show_setup_wizard_and_wait()

        self.setWindowTitle("Lock 'em up Louis 👮 - LLM Productivity Suite v2.0")
        self.resize(1200, 700)

        # Now create UI with confirmed configuration
        self.init_main_ui()

        # Apply dark theme
        self.apply_dark_theme()

    def show_setup_wizard_and_wait(self):
        """Show setup wizard and wait for completion"""
        wizard = SetupWizardDialog(self, self.config)
        result = wizard.exec()

        if result != QDialog.DialogCode.Accepted:
            sys.exit(0)

    def init_main_ui(self):
        """Initialize main UI (after config confirmed)"""
        central_widget = QWidget()
        layout = QVBoxLayout()

        # Title bar
        title = QLabel("LOCK 'EM UP LOUIS 👮 v2.0 - LLM Productivity Suite")
        title_font = QFont()
        title_font.setPointSize(16)
        title_font.setBold(True)
        title.setFont(title_font)
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)

        # Tabs - NOW created with valid config
        self.tabs = QTabWidget()

        self.louis_tab = LouisTab(self.config)
        self.connie_tab = ConnieTab(self.config)

        self.tabs.addTab(self.louis_tab, "👮 Louis (Warden)")
        self.tabs.addTab(self.connie_tab, "🎨 Connie (Converter)")

        layout.addWidget(self.tabs)

        # Footer
        footer = QLabel(
            "Lock 'em up Louis v2.0 | Configuration-based protection | "
            "Folder selection | Ignore patterns | Louis protects himself!"
        )
        footer.setStyleSheet("color: #666; font-size: 10px; margin-top: 10px;")
        footer.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(footer)

        central_widget.setLayout(layout)
        self.setCentralWidget(central_widget)

    def apply_dark_theme(self):
        """Apply dark theme"""
        dark_stylesheet = """
        QMainWindow, QWidget {
            background-color: #1e1e1e;
            color: #e0e0e0;
        }
        QTabWidget::pane {
            border: 1px solid #333;
        }
        QTabBar::tab {
            background-color: #2d2d2d;
            color: #e0e0e0;
            padding: 8px 20px;
            border: 1px solid #444;
        }
        QTabBar::tab:selected {
            background-color: #3498db;
            color: white;
        }
        QTableWidget {
            background-color: #2d2d2d;
            gridline-color: #444;
            color: #e0e0e0;
        }
        QHeaderView::section {
            background-color: #444;
            color: #e0e0e0;
            padding: 5px;
            border: 1px solid #555;
        }
        QTableWidgetItem {
            padding: 5px;
        }
        QPushButton {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
        }
        QPushButton:hover {
            background-color: #2980b9;
        }
        QPushButton:pressed {
            background-color: #1a5276;
        }
        QLabel {
            color: #e0e0e0;
        }
        QCheckBox {
            color: #e0e0e0;
        }
        QCheckBox::indicator {
            width: 18px;
            height: 18px;
        }
        QCheckBox::indicator:unchecked {
            background-color: #2d2d2d;
            border: 1px solid #555;
        }
        QCheckBox::indicator:checked {
            background-color: #2ecc71;
            border: 1px solid #27ae60;
        }
        QTextEdit {
            background-color: #2d2d2d;
            color: #e0e0e0;
            border: 1px solid #444;
        }
        QLineEdit {
            background-color: #2d2d2d;
            color: #e0e0e0;
            border: 1px solid #444;
            padding: 5px;
            border-radius: 4px;
        }
        QDialog {
            background-color: #1e1e1e;
        }
        QFrame {
            background-color: #2d2d2d;
            border: 1px solid #444;
            border-radius: 4px;
        }
        """

        QApplication.instance().setStyleSheet(dark_stylesheet)


# ═══════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    app = QApplication(sys.argv)

    window = LockEmUpLouis()
    window.show()

    sys.exit(app.exec())
