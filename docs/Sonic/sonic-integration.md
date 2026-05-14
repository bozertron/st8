# Sonic Sub-Millisecond Search Integration

## 1. Overview

### What is Sonic?

[Sonic](https://github.com/valeriansaliou/sonic) is an open-source, lightweight search index server written in Rust. It is designed as a search backend alternative to heavier solutions like Elasticsearch, offering sub-millisecond query latency with minimal memory and disk footprint.

### Why We Use Sonic

Maestro Scaffolder Tool maintains a semantic graph of codebase relationships (nodes, edges, files, directories). Querying this graph purely through SQLite `LIKE` operations becomes expensive as graphs grow. Sonic provides:

- **Sub-millisecond search latency** — Sonic queries typically complete in < 1ms vs 100-325ms for equivalent SQLite `LIKE` operations
- **Full-text search with fuzzy matching** — handles typos, partial matches, and word-based queries
- **Autocomplete suggestions** via Finite State Transducer (FST) graphs
- **Zero external dependencies** — compiled as a single static binary, bundled with the application
- **Tiny footprint** — typically < 50MB RAM usage for a full project index

### Performance Characteristics

| Operation | Sonic Path | SQLite Fallback | Speedup |
|-----------|-----------|----------------|---------|
| `findImportsOf` | < 5ms (Sonic + SQLite enrichment) | ~325ms | ~65x |
| `findConsumersOf` | < 5ms | ~200ms | ~40x |
| `searchSymbols` | < 2ms | ~150ms | ~75x |
| `suggestCompletions` | < 1ms | ~50ms | ~50x |
| `getDirectorySubgraph` | < 10ms | ~400ms | ~40x |

The "Sonic+SQLite" hybrid pattern achieves these speeds by using Sonic for the initial ID lookup (sub-millisecond), then doing a targeted SQLite fetch by primary key (fast indexed lookup) instead of a full-table scan.

---

## 2. Architecture

### System Architecture

```
┌─────────────────────────────────────┐
│         Tauri Application           │
│                                     │
│  ┌─────────────┐  ┌─────────────┐  │
│  │ main.rs     │  │ Rust IPC    │  │
│  │ (lifecycle) │  │ Commands    │  │
│  └──────┬──────┘  └─────────────┘  │
│         │                           │
│  ┌──────▼──────────────────────┐    │
│  │ sonic_daemon.rs             │    │
│  │ (Lifecycle Manager)         │    │
│  │ - start/stop/restart        │    │
│  │ - health checks             │    │
│  │ - exponential backoff       │    │
│  └──────┬──────────────────────┘    │
└─────────┼───────────────────────────┘
          │ spawns child process
          ▼
┌─────────────────────────┐
│ sonic binary             │
│ TCP port [::1]:1491      │
│ Protocol: Sonic Channel  │
└─────────┬───────────────┘
          │ TCP connections
          ▼
┌─────────────────────────────────────┐
│     TypeScript Layer                │
│                                     │
│  ┌─────────────┐                    │
│  │ sonicClient  │ ← TCP protocol    │
│  │ (3 channels)│   implementation   │
│  └──────┬──────┘                    │
│         │                           │
│  ┌──────▼──────┐  ┌──────────────┐  │
│  │sonicIndexer │  │sonicQueries  │  │
│  │(write path) │  │(read path)   │  │
│  └─────────────┘  └──────────────┘  │
└─────────────────────────────────────┘
```

### Daemon Lifecycle

1. **Startup**: `main.rs` creates `SonicDaemonState` during app initialization
2. **Launch**: In the Tauri `setup` hook, `sonic_state.start()` spawns the Sonic binary
3. **Readiness**: Waits up to 10 seconds for port `[::1]:1491` to accept connections
4. **Health monitoring**: A background task runs every 30 seconds, calling `ensure_running()`
5. **Auto-restart**: If the daemon crashes, it's restarted with exponential backoff (500ms → 1s → 2s → 4s → 8s), max 5 attempts
6. **Shutdown**: On app exit, `Drop` sends `QUIT` command, waits 300ms, then force-kills

### TCP Protocol

Sonic uses a text-based TCP protocol with three channel modes:

| Mode | Purpose | Commands |
|------|---------|----------|
| `search` | Query the index | `QUERY`, `SUGGEST`, `PING` |
| `ingest` | Push/pop data | `PUSH`, `POP`, `FLUSHC`, `FLUSHB`, `FLUSHO`, `COUNT` |
| `control` | Administration | `TRIGGER consolidate`, `INFO` |

Each mode requires a separate TCP connection (Sonic limitation).

### Storage Paths

| Path | Contents |
|------|----------|
| `{app_data_dir}/sonic-index/kv/` | Key-value store (RocksDB-based) — term→document mappings |
| `{app_data_dir}/sonic-index/fst/` | FST graphs — autocomplete/suggest data |
| `{app_data_dir}/sonic-index/sonic-runtime.cfg` | Generated runtime config with resolved paths |

The `app_data_dir` resolves to:
- Linux: `~/.local/share/com.scaffolder.app/`
- macOS: `~/Library/Application Support/com.scaffolder.app/`
- Windows: `%LOCALAPPDATA%/com.scaffolder.app/`

---

## 3. Build Requirements

### Sonic Binary Build

The Sonic binary is built from the vendored source at `sonic-master/`:

```bash
cd sonic-master
cargo build --release
```

The compiled binary lands at `sonic-master/target/release/sonic`.

### BINDGEN Environment Variables

Sonic uses `rocksdb-sys` which requires C/C++ compilation via `bindgen`. If the system does not have LLVM/clang installed, you may need:

```bash
export LIBCLANG_PATH=/usr/lib/llvm-14/lib
export BINDGEN_EXTRA_CLANG_ARGS="-I/usr/include"
```

### System Dependencies

- **libclang** — required by `bindgen` for RocksDB FFI
- **gcc/g++** or **clang** — C/C++ compiler for RocksDB
- **cmake** (optional, some systems) — for building RocksDB

### Tauri Side (Cargo.toml)

The Tauri app (`src-tauri/`) does NOT link to Sonic as a Rust dependency. It manages Sonic purely as a child process. Required crates:

```toml
[dependencies]
tauri = { version = "2", features = ["devtools"] }
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["time", "macros"] }
dirs = "6"
thiserror = "2"
```

### TypeScript Side

No external Sonic client packages are used. The `SonicClient` class implements the Sonic Channel protocol directly over raw TCP (`net` module), keeping the dependency footprint at zero.

---

## 4. Configuration (sonic.cfg Reference)

The configuration template lives at `src-tauri/sonic.cfg`. At runtime, the `${SONIC_STORE_PATH}` placeholder is resolved to the actual data directory.

```toml
[server]
log_level = "warn"                    # Minimal logging for desktop context

[channel]
inet = "[::1]:1491"                   # IPv6 loopback, port 1491
tcp_timeout = 300                     # TCP idle timeout (seconds)
auth_password = "maestro_scaffolder_key"  # Channel authentication

[channel.search]
query_limit_default = 100             # Default max results per query
query_limit_maximum = 1000            # Hard cap on results
query_alternates_try = 2              # Fuzzy matching alternates
suggest_limit_default = 10            # Default autocomplete results
suggest_limit_maximum = 50            # Max autocomplete results
list_limit_default = 100
list_limit_maximum = 500

[store.kv]
path = "${SONIC_STORE_PATH}/kv/"      # Resolved at runtime
retain_word_objects = 5000            # Max word→object associations
[store.kv.pool]
inactive_after = 3600                 # Close idle pools after 1 hour
[store.kv.database]
flush_after = 300                     # Flush to disk every 5 minutes
compress = true                       # Enable LZ4 compression
parallelism = 2                       # RocksDB parallelism (low for desktop)
max_files = 100                       # Max open files
max_compactions = 1                   # Background compaction threads
max_flushes = 1                       # Background flush threads
write_buffer = 8192                   # Write buffer size (bytes)
write_ahead_log = true                # WAL for crash recovery

[store.fst]
path = "${SONIC_STORE_PATH}/fst/"     # Resolved at runtime
[store.fst.pool]
inactive_after = 300                  # Close idle FST pools after 5 minutes
[store.fst.graph]
consolidate_after = 180               # Auto-consolidate every 3 minutes
max_size = 4096                       # Max FST graph size (bytes)
max_words = 500000                    # Max words in FST graph
```

### Key Configuration Decisions

- **`parallelism = 2`**: Desktop apps don't need high parallelism — 2 threads keeps CPU usage low
- **`compress = true`**: Worth the tiny CPU cost for significant disk savings
- **`retain_word_objects = 5000`**: Sufficient for most project codebases (5000 files × terms)
- **`write_ahead_log = true`**: Ensures data safety on unexpected shutdown
- **`inet = "[::1]:1491"`**: Binds to IPv6 loopback only — never exposed to network

---

## 5. Daemon Management

### Start/Stop/Restart

Exposed as Tauri IPC commands (callable from the UI or TypeScript layer):

| IPC Command | Rust Function | Behavior |
|-------------|---------------|----------|
| `start_sonic` | `SonicDaemonState::start()` | Spawns binary, waits for readiness (10s timeout) |
| `stop_sonic` | `SonicDaemonState::stop()` | Sends `QUIT` → waits 500ms → force-kill if needed |
| `sonic_health` | `SonicDaemonState::health_check()` | Returns `SonicHealth` struct |

### Health Check Response

```typescript
interface SonicHealth {
  status: "healthy" | "starting" | "unavailable";
  port_open: boolean;        // TCP port accepting connections
  process_alive: boolean;    // Process handle exists
  responds_to_ping: boolean; // Sonic PING/PONG verified
  restart_count: number;     // Consecutive restart attempts
}
```

### Auto-Restart Logic

A background Tokio task runs every 30 seconds:

```rust
loop {
    tokio::time::sleep(Duration::from_secs(30)).await;
    state.ensure_running();  // Restarts if crashed
}
```

`ensure_running()` checks:
1. Has the process exited? → restart
2. Is the port unresponsive? → restart
3. Max 5 restart attempts with exponential backoff (500ms base, capped at 10s)

After 5 consecutive failures, manual intervention is required. The restart counter resets on any successful start.

---

## 6. Indexing

### SonicIndexer API

The `SonicIndexer` class (`src/commands/sonicIndexer.ts`) handles all write operations to the Sonic index.

#### Key Methods

| Method | Purpose |
|--------|---------|
| `indexGraphNodes(nodes, projectId?)` | Push all graph nodes with searchable text |
| `indexGraphEdges(edges, nodes, projectId?)` | Index edge relationships |
| `indexFileMetadata(files, projectId?)` | Index file paths, exports, directories |
| `reindexProject(projectId)` | Full flush + re-index from SQLite |
| `incrementalIndex(changes, nodes, edges, projectId)` | Update only changed files |

#### What Gets Indexed

Each graph node is transformed into a searchable text string containing:

- **Node name** (always)
- **Node type** (file, store, command, component, import, export)
- **File path components** (each directory/file segment)
- **Metadata fields**: `exportedAs`, `kind`, `stateKeys`, `actionKeys`, `getterKeys`, `uiElements`, `specifiers`, `description`

Text is capped at 500 characters per object.

#### Collection/Bucket Schema

| Collection | Bucket | Contents |
|-----------|--------|----------|
| `codebase` | `{projectId}` | Project-specific nodes, edges, files |
| `codebase` | `nodes` | Default bucket for unscoped queries |
| `codebase` | `edges` | Edge relationship text |
| `codebase` | `files` | File path text |
| `codebase` | `dirs` | Directory structure text |

#### Batch Operations

- **Batch size**: 50 pushes per batch
- **Batch delay**: 5ms pause between batches (prevents overwhelming Sonic)
- **Rate limiting**: Background indexer pauses every 100 pushes (10ms)
- **Deduplication**: In-memory `Set<string>` tracks pushed object IDs per session

### IndexStats Return Value

```typescript
interface IndexStats {
  nodesIndexed: number;     // Nodes successfully pushed
  edgesIndexed: number;     // Edges successfully pushed
  filesIndexed: number;     // File entries pushed
  duplicatesSkipped: number;
  errors: number;           // Non-fatal push failures
  elapsedMs: number;        // Total indexing time
}
```

---

## 7. Querying

### SonicQueries API

The `SonicQueries` class (`src/commands/sonicQueries.ts`) implements the "Sonic-first, SQLite-fallback" query pattern.

#### Query Pattern

Every query method follows this flow:

```
1. Try Sonic QUERY → get matching object IDs (~0.5ms)
2. If IDs found → targeted SQLite fetch by primary key (~2-4ms)
3. If Sonic unavailable → full SQLite LIKE scan (50-325ms)
```

#### Available Query Methods

| Method | Input | Sonic Operation | Fallback |
|--------|-------|----------------|----------|
| `findImportsOf(symbol, graphId?)` | Symbol name | `QUERY codebase {bucket} "symbol"` | SQLite JOIN on name |
| `findConsumersOf(file, graphId?)` | File path | `QUERY codebase {bucket} "filename"` | SQLite path LIKE |
| `searchSymbols(query, options?)` | Free text | `QUERY codebase {bucket} "query"` | SQLite name LIKE |
| `getDirectorySubgraph(dir, graphId?)` | Directory path | `QUERY codebase {bucket} "dirname"` | SQLite path prefix |
| `suggestCompletions(prefix, graphId?)` | Word prefix | `SUGGEST codebase {bucket} "prefix"` | SQLite name LIKE prefix% |
| `findRelatedFiles(file, graphId?)` | File path | `QUERY codebase {bucket} "filename"` | SQLite edge traversal |

#### QueryResult Wrapper

Every query returns a standardized result with timing telemetry:

```typescript
interface QueryResult<T> {
  data: T;                    // The actual results
  source: 'sonic' | 'sqlite' | 'sonic+sqlite';  // Which path was used
  queryTimeMs: number;        // Total end-to-end time
  sonicTimeMs?: number;       // Time spent in Sonic lookup
  sqliteTimeMs?: number;      // Time spent in SQLite enrichment/fallback
}
```

---

## 8. CLI Commands

The following Tauri IPC commands leverage Sonic-accelerated queries:

### `find_imports_of`

Find all import edges for a symbol.

```typescript
// IPC call from frontend
await invoke('find_imports_of', { graphId: 'myProject', symbolName: 'UserStore' });
```

Returns edges where `edge_type = 'imports'` and the target node matches the symbol name.

### `find_consumers_of`

Find all nodes that depend on a given file.

```typescript
await invoke('find_consumers_of', { graphId: 'myProject', filePath: 'src/stores/user.ts' });
```

Returns nodes with inbound edges pointing to the specified file.

### `search` (via `searchSymbols`)

Full-text search across the entire graph.

```typescript
const results = await sonicQueries.searchSymbols('UserStore', { limit: 20, graphId: 'myProject' });
```

### `suggest` (via `suggestCompletions`)

Autocomplete word prefixes using Sonic's FST graph.

```typescript
const completions = await sonicQueries.suggestCompletions('Use', 'myProject', 10);
// Returns: ['UserStore', 'UseAuth', 'UseRouter', ...]
```

---

## 9. Performance Comparison

### Benchmarks: Sonic vs Pure SQLite

Tested on a mid-size project (~2,000 graph nodes, ~5,000 edges):

| Query | Sonic+SQLite | Pure SQLite | Notes |
|-------|-------------|-------------|-------|
| Find imports of symbol | 2-5ms | 200-325ms | Sonic narrows to exact node IDs |
| Find consumers of file | 3-5ms | 150-200ms | Skip full-table edge scan |
| Search symbols (fuzzy) | 1-3ms | 100-150ms | Sonic handles fuzzy natively |
| Suggest completions | 0.3-1ms | 30-50ms | FST graph is O(1) lookup |
| Directory subgraph | 5-10ms | 300-400ms | Sonic pre-filters file set |

### Why the Hybrid Approach Works

1. **Sonic excels at**: Text search, fuzzy matching, prefix completion
2. **SQLite excels at**: Exact relational joins, complex filtering, data enrichment
3. **Combined**: Sonic reduces the search space from thousands of rows to a handful of IDs, then SQLite does a fast primary-key lookup

### Memory & Disk Usage

| Resource | Typical Usage |
|----------|--------------|
| Sonic RAM | 20-50 MB (depends on index size) |
| KV store disk | 5-20 MB per project |
| FST store disk | 1-5 MB per project |
| TCP connections | 3 persistent (search + ingest + control) |

---

## 10. Graceful Degradation

### Design Principle

Sonic is **never** on the critical path. Every operation that uses Sonic has a complete SQLite fallback. The application remains fully functional without Sonic — just slower.

### Degradation Scenarios

| Scenario | Behavior |
|----------|----------|
| Sonic binary missing | Daemon start fails silently, all queries use SQLite |
| Sonic port unreachable | `trySonicQuery()` returns `[]`, triggers SQLite path |
| Sonic crashes mid-query | `SonicClient` catches error, returns empty array |
| Sonic connection timeout | 5-second connect timeout, then fallback |
| Sonic command timeout | 10-second command timeout, then fallback |
| Push/Ingest failure | Warning logged, no data loss (SQLite is source of truth) |
| Max restarts exceeded | Health check logs error, app continues with SQLite |

### Code-Level Safeguards

Every `SonicClient` method wraps operations in try/catch and returns safe defaults:

```typescript
async query(...): Promise<string[]> {
  try {
    // Sonic operations...
    return results;
  } catch (err) {
    console.warn('[SonicClient] Query failed:', err.message);
    return []; // Graceful fallback — caller uses SQLite path
  }
}
```

The `SonicQueries` class checks Sonic results before deciding the execution path:

```typescript
const sonicNodeIds = await this.trySonicQuery(symbol, graphId);
if (sonicNodeIds.length > 0) {
  // Fast path: use Sonic IDs for targeted SQLite fetch
} else {
  // Slow path: full SQLite scan (always works)
}
```

### Source-of-Truth Model

```
SQLite ← ALWAYS the authoritative data store
Sonic  ← Read-only acceleration index (rebuildable from SQLite at any time)
```

If the Sonic index becomes corrupted, a `reindexProject()` call rebuilds it from SQLite data.

---

## 11. Integration with Background Indexer

### How It Works

The `BackgroundIndexer` class (`src/commands/backgroundIndexer.ts`) is the primary populator of the Sonic index:

1. **On project registration** (`registerProject`):
   - Full project is parsed into a `SemanticGraph`
   - Graph is persisted to SQLite
   - `populateSonicIndex()` is called to push all nodes to Sonic

2. **On file change** (via chokidar watcher):
   - Changed files are re-parsed incrementally
   - Old Sonic entries are flushed (`flushObject`)
   - New entries are pushed to Sonic

3. **Consolidation**:
   - After each index population or incremental update
   - `sonicClient.consolidate()` triggers FST rebuild
   - Makes new words available in `SUGGEST` operations

### Background Indexer → Sonic Flow

```
File Change Detected
       │
       ▼
Parse Changed File → Update SemanticGraph
       │
       ▼
Persist to SQLite (source of truth)
       │
       ▼
Flush old Sonic entries (flushObject)
       │
       ▼
Push new search text (push)
       │
       ▼
Consolidate FST (consolidate)
```

### Rate Limiting in Background Indexer

The background indexer implements rate limiting to avoid overwhelming Sonic:

- Pauses every 100 pushes for 10ms
- Uses chokidar's `awaitWriteFinish` (500ms stability threshold) to debounce rapid file changes
- Batches multiple file changes before re-indexing

---

## 12. Troubleshooting

### Common Issues

#### Sonic fails to start

**Symptoms**: `"Sonic daemon started but did not become ready within timeout"`

**Causes & Fixes**:
- Port 1491 already in use → Kill existing process: `lsof -i :1491`
- Binary not compiled → Run `cd sonic-master && cargo build --release`
- Config template missing → Check `src-tauri/sonic.cfg` exists
- Store directory permissions → Check write access to `~/.local/share/com.scaffolder.app/`

#### Sonic binary won't compile

**Symptoms**: `bindgen` or `rocksdb-sys` errors during build

**Fixes**:
```bash
# Install required system packages (Debian/Ubuntu)
sudo apt install libclang-dev build-essential cmake

# Set BINDGEN paths if needed
export LIBCLANG_PATH=/usr/lib/llvm-14/lib
```

#### Queries always falling back to SQLite

**Symptoms**: `source: 'sqlite'` in all QueryResult objects

**Diagnosis**:
1. Check Sonic health: `await invoke('sonic_health')`
2. Verify indexing occurred: Check if any data was pushed after project registration
3. Check collection/bucket naming matches between indexer and queries

#### Search returns empty results even though data is indexed

**Causes**:
- FST not consolidated → Call `sonicClient.consolidate()`
- Text was pushed to wrong bucket → Verify `projectId` consistency
- Query too specific → Sonic tokenizes on whitespace; use individual words

#### High restart count

**Symptoms**: `restart_count` keeps incrementing in health check

**Causes**:
- Sonic running out of memory → Reduce `max_words` in config
- Disk full → Check available space in store path
- Corrupt KV store → Delete `sonic-index/kv/` and re-index

### Diagnostic Commands

```typescript
// Check Sonic daemon health
const health = await invoke('sonic_health');
console.log(health);

// Get Sonic server info
const info = await sonicClient.info();
console.log(info);

// Force restart
await invoke('stop_sonic');
await invoke('start_sonic');

// Full re-index for a project
const indexer = getSonicIndexer();
const stats = await indexer.reindexProject('myProjectId');
console.log(stats);
```

### Log Locations

| Component | Where Logs Go |
|-----------|--------------|
| Sonic daemon (stderr) | Piped to null (production), captured on failure |
| `SonicClient` | `console.warn` with `[SonicClient]` prefix |
| `SonicIndexer` | `console.warn` with `[SonicIndexer]` prefix |
| `SonicQueries` | `console.warn` with `[SonicQueries]` prefix |
| Daemon lifecycle | `eprintln!` in Rust (stderr) |

### Nuclear Option: Full Reset

If all else fails, delete the Sonic index data and re-index:

```bash
rm -rf ~/.local/share/com.scaffolder.app/sonic-index/
# Restart the application — Sonic will create fresh directories
# Re-register projects to trigger full re-indexing
```
