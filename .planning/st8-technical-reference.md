# ST8 Connection Tracker: Technical Reference
**Date:** May 11, 2026  
**Purpose:** Detailed code patterns, function signatures, and implementation specifics

---

## 1. SHARED TYPES (types.ts)

```typescript
// File identity and state
export interface FileEntry {
  fileId: string;                    // UUID or content hash
  filePath: string;                  // Relative: src/commands/foo.ts
  fileName: string;
  sha256Hash: string;                // Content fingerprint
  fileSizeBytes: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
  reachabilityScore: number;         // 0.0 to 1.0
  impactRadius: number;              // Transitive dependents
  isEntryPoint: boolean;
  indexedAt: string;                 // ISO timestamp
  updatedAt: string;
}

// Connection between files
export interface Connection {
  connectionId: string;              // UUID
  sourceFileId: string;
  targetFileId: string;
  connectionType: 'import' | 'require' | 'export-from';
  importSpecifier: string;           // "{ foo, bar }"
  isResolved: boolean;               // Target file exists?
  confidenceScore: number;           // 0.3-1.0
  createdAt: string;
}

// Import/export data from parser
export interface ImportSpec {
  source: string;                    // "./path" or "module"
  names: string[];                   // ['foo', 'bar']
  isDefault: boolean;
}

export interface ExportSpec {
  name: string;
  type: 'named' | 'default' | 'star';
  isDefault: boolean;
}

// Classification result
export interface ClassificationResult {
  fileId: string;
  status: 'GREEN' | 'YELLOW' | 'RED';
  reachabilityScore: number;
  impactRadius: number;
  consumers: string[];               // File IDs that import this
  dependencies: string[];            // File IDs this imports
}

// API response structure
export interface ConnectionStateManifest {
  metadata: {
    timestamp: string;
    targetDirectory: string;
    totalFiles: number;
    statusCounts: { GREEN: number; YELLOW: number; RED: number };
    reindexDurationMs: number;
    databaseVersion: number;
  };
  files: Array<FileEntry & {
    connections: {
      importedBy: Connection[];
      imports: Connection[];
      missingConnections: string[];
    };
    context: string;                 // First N lines
  }>;
  entryPoint: {
    fileId: string;
    filePath: string;
    reachableFileCount: number;
    orphanedFileCount: number;
  };
  pathToSuccess: {
    recentChanges: Array<{
      timestamp: string;
      action: string;
      file?: string;
      message?: string;
    }>;
  };
}
```

---

## 2. PERSISTENCE LAYER (persistence.ts)

```typescript
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export class DatabasePersister {
  private db: Database.Database;
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    const dbPath = path.join(dataDir, 'st8.sqlite');
    
    // Ensure directory
    fs.mkdirSync(dataDir, { recursive: true });
    
    // Open DB
    this.db = new Database(dbPath);
    
    // Optimize for concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');
    
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS FileRegistry (
        file_id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        sha256_hash TEXT NOT NULL,
        file_size_bytes INTEGER,
        status TEXT NOT NULL DEFAULT 'GREEN',
        reachability_score REAL,
        impact_radius INTEGER,
        is_entry_point INTEGER DEFAULT 0,
        indexed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS FileConnections (
        connection_id TEXT PRIMARY KEY,
        source_file_id TEXT NOT NULL,
        target_file_id TEXT NOT NULL,
        connection_type TEXT NOT NULL,
        import_specifier TEXT,
        is_resolved INTEGER DEFAULT 1,
        confidence_score REAL DEFAULT 1.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_file_id) REFERENCES FileRegistry(file_id) ON DELETE CASCADE,
        FOREIGN KEY (target_file_id) REFERENCES FileRegistry(file_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ActivityLog (
        log_id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        file_id TEXT,
        old_status TEXT,
        new_status TEXT,
        message TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES FileRegistry(file_id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS ConnectionSnapshots (
        snapshot_id TEXT PRIMARY KEY,
        snapshot_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        green_count INTEGER,
        yellow_count INTEGER,
        red_count INTEGER,
        total_connections INTEGER,
        average_reachability_score REAL,
        snapshot_data TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_file_registry_status ON FileRegistry(status);
      CREATE INDEX IF NOT EXISTS idx_file_registry_sha256 ON FileRegistry(sha256_hash);
      CREATE INDEX IF NOT EXISTS idx_file_connections_source ON FileConnections(source_file_id);
      CREATE INDEX IF NOT EXISTS idx_file_connections_target ON FileConnections(target_file_id);
      CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON ActivityLog(timestamp);
    `);
  }

  // Bulk insert files
  async insertFiles(files: FileEntry[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO FileRegistry
      (file_id, file_path, file_name, sha256_hash, file_size_bytes, status, 
       reachability_score, impact_radius, is_entry_point, indexed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const file of files) {
        insert.run(
          file.fileId, file.filePath, file.fileName, file.sha256Hash,
          file.fileSizeBytes, file.status, file.reachabilityScore,
          file.impactRadius, file.isEntryPoint ? 1 : 0,
          file.indexedAt, file.updatedAt
        );
      }
    });

    tx();
  }

  // Bulk insert connections
  async insertConnections(connections: Connection[]): Promise<void> {
    const insert = this.db.prepare(`
      INSERT INTO FileConnections
      (connection_id, source_file_id, target_file_id, connection_type,
       import_specifier, is_resolved, confidence_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      for (const conn of connections) {
        insert.run(
          conn.connectionId, conn.sourceFileId, conn.targetFileId,
          conn.connectionType, conn.importSpecifier, conn.isResolved ? 1 : 0,
          conn.confidenceScore, conn.createdAt
        );
      }
    });

    tx();
  }

  // Query: Get all files by status
  getFilesByStatus(status: string): FileEntry[] {
    return this.db.prepare(`
      SELECT * FROM FileRegistry WHERE status = ? ORDER BY file_path
    `).all(status) as FileEntry[];
  }

  // Query: Get connections for a file (both directions)
  getConnections(fileId: string): {
    importedBy: Connection[];
    imports: Connection[];
  } {
    const importedBy = this.db.prepare(`
      SELECT * FROM FileConnections WHERE target_file_id = ?
    `).all(fileId) as Connection[];

    const imports = this.db.prepare(`
      SELECT * FROM FileConnections WHERE source_file_id = ?
    `).all(fileId) as Connection[];

    return { importedBy, imports };
  }

  close(): void {
    this.db.close();
  }
}
```

---

## 3. INDEXER PATTERNS (indexer.ts - excerpts)

```typescript
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import * as parser from '@babel/parser';

export class Indexer {
  private targetDir: string;
  private persister: DatabasePersister;

  // Phase 1: Discover all .ts/.js files
  async discoverFiles(): Promise<string[]> {
    const pattern = `${this.targetDir}/**/*.{ts,js,tsx,jsx}`;
    return fg(pattern, {
      ignore: ['**/node_modules/**', '**/.dist/**', '**/.git/**'],
      absolute: false
    });
  }

  // Phase 2: Compute SHA-256 hash per file
  async hashFiles(files: string[]): Promise<Map<string, string>> {
    const hashes = new Map<string, string>();
    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      hashes.set(file, hash);
    }
    return hashes;
  }

  // Phase 3: Parse imports/exports with fallback
  async parseConnections(files: string[]): Promise<Connection[]> {
    const connections: Connection[] = [];

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf-8');
        let imports: ImportSpec[] = [];

        try {
          // Try Babel
          const ast = parser.parse(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
            allowImportExportEverywhere: true,
            allowReturnOutsideFunction: true
          });
          imports = this.extractImportsViaAst(ast);
        } catch {
          // Fall back to regex
          imports = this.extractImportsViaRegex(content);
        }

        // Resolve each import
        for (const imp of imports) {
          const resolved = this.resolveImportPath(imp.source, file);
          connections.push({
            connectionId: crypto.randomUUID(),
            sourceFileId: file,  // Will be replaced with UUID in classification
            targetFileId: resolved || `UNRESOLVED:${imp.source}`,
            connectionType: 'import',
            importSpecifier: imp.names.join(', '),
            isResolved: !!resolved,
            confidenceScore: resolved ? 1.0 : 0.3,
            createdAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error(`[Indexer] Parse error in ${file}:`, err);
      }
    }

    return connections;
  }

  // Extract imports via Babel AST
  private extractImportsViaAst(ast: any): ImportSpec[] {
    const imports: ImportSpec[] = [];
    const traverse = require('@babel/traverse').default;

    traverse(ast, {
      ImportDeclaration: (path: any) => {
        const source = path.node.source.value;
        const names = path.node.specifiers.map((spec: any) =>
          spec.imported?.name || spec.local?.name || 'default'
        );
        imports.push({
          source,
          names,
          isDefault: names.includes('default')
        });
      }
    });

    return imports;
  }

  // Fallback: Extract imports via regex
  private extractImportsViaRegex(content: string): ImportSpec[] {
    const imports: ImportSpec[] = [];
    
    // Match: import { foo, bar } from './path'
    const regex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+)?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      imports.push({
        source: match[1],
        names: [],  // Can't reliably extract names from regex
        isDefault: false
      });
    }

    return imports;
  }

  // Resolve relative imports to actual file paths
  private resolveImportPath(source: string, fromFile: string): string | null {
    if (!source.startsWith('.')) {
      // External package
      return null;
    }

    const dir = path.dirname(fromFile);
    const resolved = path.resolve(dir, source);

    // Try extensions: .ts, .tsx, .js, .jsx
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      const withExt = resolved.endsWith(ext) ? resolved : resolved + ext;
      if (fs.existsSync(withExt)) {
        return path.relative(this.targetDir, withExt);
      }
    }

    // Try as directory with index
    for (const ext of ['.ts', '.js']) {
      const indexPath = path.join(resolved, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        return path.relative(this.targetDir, indexPath);
      }
    }

    return null;  // Unresolved
  }
}
```

---

## 4. GRAPH BUILDER PATTERNS

```typescript
export class GraphAnalyzer {
  /**
   * Build adjacency lists and compute reachability from entry point
   */
  analyzeReachability(
    files: FileEntry[],
    connections: Connection[],
    entryPointId: string
  ): Map<string, FileEntry> {
    // Adjacency lists
    const outgoing = new Map<string, Set<string>>();  // dependencies
    const incoming = new Map<string, Set<string>>();  // consumers

    for (const file of files) {
      outgoing.set(file.fileId, new Set());
      incoming.set(file.fileId, new Set());
    }

    for (const conn of connections) {
      if (conn.isResolved) {
        outgoing.get(conn.sourceFileId)?.add(conn.targetFileId);
        incoming.get(conn.targetFileId)?.add(conn.sourceFileId);
      }
    }

    // BFS from entry point to find reachable files
    const reachable = new Set<string>();
    const queue = [entryPointId];
    reachable.add(entryPointId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const dep of outgoing.get(current) || []) {
        if (!reachable.has(dep)) {
          reachable.add(dep);
          queue.push(dep);
        }
      }
    }

    // Classify files
    const classified = new Map<string, FileEntry>();
    for (const file of files) {
      let status: 'GREEN' | 'YELLOW' | 'RED';
      let score: number;

      if (reachable.has(file.fileId)) {
        status = 'GREEN';
        score = 0.95;
      } else if ((incoming.get(file.fileId)?.size || 0) > 0) {
        status = 'YELLOW';
        score = 0.5;
      } else {
        status = 'RED';
        score = 0.0;
      }

      classified.set(file.fileId, {
        ...file,
        status,
        reachabilityScore: score,
        impactRadius: this.computeImpactRadius(file.fileId, incoming)
      });
    }

    return classified;
  }

  /**
   * Count transitive dependents (BFS from file upward through consumers)
   */
  private computeImpactRadius(fileId: string, incoming: Map<string, Set<string>>): number {
    const visited = new Set<string>();
    const queue = [fileId];
    visited.add(fileId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const consumer of incoming.get(current) || []) {
        if (!visited.has(consumer)) {
          visited.add(consumer);
          queue.push(consumer);
        }
      }
    }

    return visited.size - 1;  // Exclude self
  }
}
```

---

## 5. FILE WATCHER PATTERNS

```typescript
import { watch as chokidarWatch, FSWatcher } from 'chokidar';

export class FileWatcher {
  private watcher: FSWatcher;
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs = 500;
  private pendingChanges: Set<string> = new Set();
  private onReindex: (files: string[]) => Promise<void>;

  constructor(targetDir: string, onReindex: (files: string[]) => Promise<void>) {
    this.onReindex = onReindex;

    this.watcher = chokidarWatch(targetDir, {
      ignored: [
        '**/node_modules',
        '**/.dist',
        '**/.git',
        '**/.env',
        '**/*.map'
      ],
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      },
      depth: 10,
      followSymlinks: false
    });

    this.watcher.on('add', (p) => this.onFileChange(p, 'add'));
    this.watcher.on('change', (p) => this.onFileChange(p, 'change'));
    this.watcher.on('unlink', (p) => this.onFileChange(p, 'unlink'));
    this.watcher.on('error', (err) => console.error('[FileWatcher] Error:', err));
  }

  private onFileChange(filePath: string, type: string): void {
    this.pendingChanges.add(filePath);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => this.flush(), this.debounceMs);
  }

  private async flush(): Promise<void> {
    const changes = Array.from(this.pendingChanges);
    this.pendingChanges.clear();

    console.log(`[FileWatcher] Flushing ${changes.length} changes`);
    try {
      await this.onReindex(changes);
    } catch (err) {
      console.error('[FileWatcher] Reindex failed:', err);
    }
  }

  close(): void {
    if (this.watcher) this.watcher.close();
  }
}
```

---

## 6. MANIFEST GENERATION

```typescript
export class ManifestGenerator {
  constructor(private persister: DatabasePersister) {}

  /**
   * Generate connection-state.json for HTML dashboard
   */
  generateConnectionState(): ConnectionStateManifest {
    const allFiles = this.persister.getFilesByStatus('%');  // All files
    const statusCounts = {
      GREEN: allFiles.filter(f => f.status === 'GREEN').length,
      YELLOW: allFiles.filter(f => f.status === 'YELLOW').length,
      RED: allFiles.filter(f => f.status === 'RED').length
    };

    const files = allFiles.map(file => ({
      ...file,
      connections: this.persister.getConnections(file.fileId),
      context: this.getFileContext(file.filePath, 20)
    }));

    return {
      metadata: {
        timestamp: new Date().toISOString(),
        targetDirectory: this.targetDir,
        totalFiles: allFiles.length,
        statusCounts,
        reindexDurationMs: this.lastReindexMs,
        databaseVersion: 1
      },
      files,
      entryPoint: {
        fileId: 'entry-point-id',
        filePath: 'src/index.ts',
        reachableFileCount: statusCounts.GREEN,
        orphanedFileCount: statusCounts.RED
      },
      pathToSuccess: this.getActivityLog()
    };
  }

  /**
   * Generate ai-signal.toml for LLM consumption
   */
  generateAiSignalToml(): string {
    let toml = `# AI Signal Manifest
version = "1.0"
generated_at = "${new Date().toISOString()}"

[status_distribution]
green = ${this.greenCount}
yellow = ${this.yellowCount}
red = ${this.redCount}

`;

    // Add per-file blocks
    for (const file of this.allFiles) {
      toml += `[[files]]
path = "${file.filePath}"
status = "${file.status}"
reachability_score = ${file.reachabilityScore}
impact_radius = ${file.impactRadius}

[files.ai_signal]
core_responsibility = "${this.getResponsibility(file)}"
can_be_archived = ${file.status === 'RED' && file.impactRadius === 0}
`;
    }

    return toml;
  }

  private getFileContext(filePath: string, lines: number): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines_array = content.split('\n').slice(0, lines);
      return lines_array.join('\n');
    } catch {
      return '(Unable to read file)';
    }
  }

  private getActivityLog() {
    // Query ActivityLog table for recent changes
    const rows = this.persister.getRecentActivity(10);
    return rows.map(row => ({
      timestamp: row.timestamp,
      action: row.action_type,
      file: row.file_id,
      message: row.message
    }));
  }
}
```

---

## 7. HTTP SERVER ENDPOINTS

```typescript
import express from 'express';

export function createServer(
  manifester: ManifestGenerator,
  indexer: Indexer
): express.Express {
  const app = express();

  // GET /api/connection-state.json — Dashboard data
  app.get('/api/connection-state.json', (req, res) => {
    try {
      const manifest = manifester.generateConnectionState();
      res.json(manifest);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/ai-signal.toml — AI consumption
  app.get('/api/ai-signal.toml', (req, res) => {
    try {
      const toml = manifester.generateAiSignalToml();
      res.contentType('text/plain');
      res.send(toml);
    } catch (err) {
      res.status(500).send(String(err));
    }
  });

  // GET /api/health — Server health
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      lastReindex: manifester.lastReindexTime,
      filesIndexed: manifester.totalFilesIndexed
    });
  });

  // POST /api/reindex — Manual reindex
  app.post('/api/reindex', async (req, res) => {
    try {
      const result = await indexer.reindexFull();
      res.json({ status: 'complete', filesIndexed: result.filesIndexed });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return app;
}
```

---

## QUICK START FOR NEXT PHASE

### Immediate next steps:
1. Create `/home/bozertron/1_AT_A_TIME/st8/backend/` directory
2. Create types.ts (copy from Section 1 above)
3. Create persistence.ts (copy from Section 2)
4. Create indexer.ts (copy from Section 3)
5. Update package.json with dependencies
6. Run: `npm install && npm run build`
7. Test: `node dist/backend/indexer.js /path/to/maestro/src/commands`

---

END TECHNICAL REFERENCE
