# Sonic Build Report — Custom Source Build for Maestro Scaffolder

**Date:** 2026-05-09  
**Source Version:** sonic-server v1.4.9  
**License:** MPL-2.0  
**Target Platform:** Fedora Workstation (x86-64)

---

## 1. Build Commands (Reproducible)

### Prerequisites

```bash
# Fedora packages required
sudo dnf install -y clang clang-devel llvm-devel rocksdb-devel rust cargo
```

### Exact Build Command

```bash
cd "/home/bozertron/Software Projects/maestro-scaffolder-tool/sonic-master"

BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/clang/21/include" \
  cargo build --release \
  --no-default-features \
  --features tokenizer-chinese
```

### Why These Flags

| Flag | Reason |
|------|--------|
| `--no-default-features` | Disables `allocator-jemalloc` which fails in paths with spaces (jemalloc configure breaks on space-containing `OUT_DIR`). System allocator is sufficient for desktop use. |
| `--features tokenizer-chinese` | Enables jieba-rs for CJK tokenization. Not strictly needed for code search but useful for multilingual comment indexing. |
| `BINDGEN_EXTRA_CLANG_ARGS` | Points bindgen (used by rocksdb-sys) to the correct clang headers on Fedora 43. |

### Build Output

```
target/release/sonic
```

---

## 2. Binary Size & Resource Usage

| Metric | Value |
|--------|-------|
| Binary size | **19 MB** (stripped, LTO optimized) |
| Runtime RSS (idle) | **~19 MB** |
| Runtime RSS (3 objects indexed) | **~19 MB** |
| CPU (idle) | **0.0%** |
| Link type | Dynamically linked (glibc, libstdc++) |
| Profile | release (opt-level=3, LTO=true, strip=true) |

**Verdict:** Extremely lightweight. Appropriate for desktop app bundling.

---

## 3. Verification Results

### Health Check
```
CONNECTED <sonic-server v1.4.9>
START search → STARTED search protocol(1) buffer(20000)
PING → PONG
```

### Ingest/Query Cycle
```
PUSH testcol default obj:1 "hello world from maestro scaffolder" → OK
PUSH testcol default obj:2 "compositionAnalyzer handles graph traversal" → OK
PUSH testcol default obj:3 "sonic search integration for code symbols" → OK
TRIGGER consolidate → OK
QUERY testcol default "maestro" → EVENT QUERY obj:1 ✓
QUERY testcol default "graph" → EVENT QUERY obj:2 ✓
```

All operations confirmed working.

---

## 4. Source Architecture Overview

```
sonic-master/src/
├── main.rs              # Entry point, CLI args, thread spawning
├── channel/             # TCP protocol layer
│   ├── command.rs       # Command parsing (QUERY, PUSH, POP, etc.)
│   ├── handle.rs        # Per-connection handler
│   ├── listen.rs        # TCP listener
│   ├── message.rs       # Response formatting
│   └── mode.rs          # search/ingest/control modes
├── config/              # TOML config reader
├── executor/            # Business logic
│   ├── search.rs        # Term→IID resolution, AND intersection
│   ├── push.rs          # Index ingestion
│   ├── pop.rs           # Index removal
│   ├── suggest.rs       # Auto-complete
│   ├── count.rs         # Collection counting
│   └── flush*.rs        # Flush operations
├── lexer/               # Text processing
│   ├── token.rs         # Tokenizer (UAX#29, JieBa, Lindera)
│   ├── stopwords.rs     # Stop-word filtering
│   └── ranges.rs        # Unicode script detection
├── query/               # Query building
│   ├── builder.rs       # Query dispatch orchestration
│   └── types.rs         # Type definitions
├── store/               # Persistence
│   ├── kv.rs            # RocksDB key-value store
│   ├── fst.rs           # FST (finite state transducer) for word completion
│   ├── keyer.rs         # Key construction (term→IID, OID↔IID maps)
│   └── identifiers.rs   # Hash functions (xxHash32)
├── stopwords/           # 70 language stop-word files
└── tasker/              # Background consolidation scheduler
```

---

## 5. Customization Opportunities (Ranked by Value vs. Effort)

### Rank 1: Custom Code Tokenizer (HIGH VALUE / MEDIUM EFFORT)

**What:** Add a `tokenizer-code` feature that splits camelCase, PascalCase, snake_case, kebab-case identifiers into constituent words.

**Where:** `src/lexer/token.rs` — the `TokenLexerWords` enum and `TokenLexer::new()` function.

**How:**
- Add a new variant: `TokenLexerWords::CodeSymbol(IntoIter<&'a str>)`
- Implement splitting logic: `parseHTTPResponse` → `["parse", "http", "response"]`
- Trigger based on a new `LANG(code)` meta-parameter in PUSH/QUERY commands
- The `TokenLexerMode::from_query_lang()` already supports custom Lang hints

**Impact:** Direct benefit for searching code symbols. Without this, "composition" won't match `compositionAnalyzer` as the current UAX#29 tokenizer treats it as one word (lowercase → "compositionanalyzer" → single token).

**Effort:** ~200 lines of Rust. Add regex-based split on case boundaries. Feature-gate with `tokenizer-code`.

---

### Rank 2: Project-Aware Collections (HIGH VALUE / LOW EFFORT)

**What:** Use Sonic's existing `collection` + `bucket` hierarchy to organize per-project, per-file-type indexes automatically.

**Where:** No source changes needed — this is a client-side convention.

**Convention:**
```
Collection: "maestro" (project name)
Buckets: "ts-files", "rust-files", "config-files", "symbols", "comments"
Objects: file paths or symbol identifiers
```

**Impact:** Enables type-aware search (search only in TypeScript files, or only in symbols).

**Effort:** Zero Sonic modifications. Client IPC layer maps file types to buckets.

---

### Rank 3: Relevance/Scoring Modifications (MEDIUM VALUE / HIGH EFFORT)

**What:** Boost exact matches over fuzzy/alternate results. Currently all results are returned in IID insertion order (no scoring).

**Where:** `src/executor/search.rs` lines 48-156 — the search executor uses `LinkedHashSet` which preserves insertion order but has no scoring.

**Current behavior:**
1. Exact term match via hash lookup → IIDs
2. If insufficient results, FST suggests alternates (Levenshtein distance ≤ max_typo_factor)
3. All alternate IIDs are mixed into the same set
4. AND intersection across terms
5. Results returned in insertion order

**Modification options:**
- **Option A (simple):** Return exact-match results first, alternates after. ~50 lines change.
- **Option B (full scoring):** Add a score field per IID, weight by: exact match (10), prefix match (5), fuzzy (1). Requires changing the `LinkedHashSet<StoreObjectIID>` to a scored structure. ~300 lines.

**Impact:** Better search quality for code-specific queries where exact matches matter more.

**Effort:** Option A is feasible for MVP. Option B is a larger refactor.

---

### Rank 4: Metadata on Indexed Objects (MEDIUM VALUE / HIGH EFFORT)

**What:** Store additional metadata (file type, language, module, last-modified) with each indexed object.

**Where:** `src/store/keyer.rs` — the `StoreKeyerIdx` enum defines the current key types. Would need a new `OIDToMeta` mapping.

**Current schema (per bucket in RocksDB):**
```
MetaToValue: { IIDIncr → u32 }
TermToIIDs:  { term_hash → [iid1, iid2, ...] }
OIDToIID:    { oid_string → iid }
IIDToOID:    { iid → oid_string }
IIDToTerms:  { iid → [term_hash1, term_hash2, ...] }
```

**What's needed:** A new `IIDToMeta` or `OIDToMeta` key space storing serialized metadata.

**Impact:** Enables filtering search results by metadata (e.g., "find 'handler' but only in .ts files"). Currently achievable via bucket separation (Rank 2) which is much simpler.

**Effort:** Significant (~500+ lines). Touches keyer, KV store, push/pop executors, and protocol. Not recommended for MVP.

---

### Rank 5: Protocol Extension (LOW VALUE / MEDIUM EFFORT)

**What:** Add custom commands (e.g., `STATS`, `REINDEX`, `METADATA`).

**Where:** `src/channel/command.rs` — the `COMMANDS_MODE_*` vectors define available commands per mode. Command dispatch is in large `match` blocks.

**How extensible:**
- Adding a new command requires: (1) add to command list, (2) add dispatch function, (3) add executor
- The protocol is text-based and simple — easy to extend
- No versioning/negotiation mechanism exists (clients just need to know the extensions)

**Impact:** Useful for admin tooling but not critical for search functionality.

**Effort:** ~100-200 lines per new command.

---

## 6. Recommendation: Custom Build vs. Off-the-Shelf

### Verdict: **Custom build for MVP, with targeted modifications**

| Approach | Pros | Cons |
|----------|------|------|
| Off-the-shelf | Zero maintenance, fast start | No code tokenization, insertion-order results |
| Custom build | Code-aware tokenization, scoring control | Fork maintenance, build complexity |
| **Recommended: Light fork** | Best of both worlds | Small maintenance surface |

### MVP Custom Build Scope:
1. **Use off-the-shelf build immediately** (what we have now works)
2. **Add `tokenizer-code` feature** (Rank 1) as a single PR — this is the killer feature that makes Sonic useful for code search
3. **Apply bucket conventions** (Rank 2) — zero source changes
4. **Optionally add simple scoring boost** (Rank 3, Option A) in a second iteration

### Long-term:
- Track upstream releases and rebase our fork periodically
- The codebase is well-structured and ~5000 lines total — manageable
- MPL-2.0 license allows proprietary use with file-level copyleft (our additions can stay in separate files)

---

## 7. RPM Packaging Notes (Fedora Workstation Target)

### Binary Packaging Strategy

```bash
# Install location
/usr/local/bin/sonic

# Config location
/etc/maestro-scaffolder/sonic.cfg

# Data directory
/var/lib/maestro-scaffolder/sonic/

# SystemD unit (optional, for standalone mode)
/usr/lib/systemd/system/maestro-sonic.service
```

### RPM Spec Key Sections

```spec
Name:           maestro-sonic
Version:        1.4.9
Release:        1%{?dist}
Summary:        Sonic search backend (Maestro custom build)
License:        MPL-2.0
BuildRequires:  rust >= 1.70, cargo, clang-devel, rocksdb-devel

%build
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/clang/$(clang --version | grep -oP '\d+' | head -1)/include" \
  cargo build --release --no-default-features --features tokenizer-chinese

%install
install -Dm755 target/release/sonic %{buildroot}/usr/local/bin/sonic

%files
/usr/local/bin/sonic
```

### Bundling with Tauri (Preferred for Desktop)

For the Tauri app, Sonic should be bundled as a sidecar binary:
1. Copy `target/release/sonic` to `src-tauri/binaries/sonic-x86_64-unknown-linux-gnu`
2. Configure in `tauri.conf.json` under `bundle.externalBin`
3. Tauri manages lifecycle (start on app launch, kill on exit)
4. Config with resolved paths generated at runtime

### Build Automation (CI)

```yaml
# GitHub Actions / CI snippet
- name: Build Sonic
  run: |
    cd sonic-master
    BINDGEN_EXTRA_CLANG_ARGS="-I$(clang -print-resource-dir)/include" \
      cargo build --release --no-default-features --features tokenizer-chinese
  env:
    CARGO_INCREMENTAL: 0
```

---

## 8. Key Technical Findings

| Finding | Detail |
|---------|--------|
| Tokenization is pluggable | `TokenLexerWords` enum is feature-gated; new tokenizers slot in cleanly |
| Search is unscored | Results are AND-intersected IID sets in insertion order |
| FST handles auto-complete | Levenshtein automaton + prefix matching |
| Storage is RocksDB | Well-proven, handles concurrent reads, compresses with zstd |
| Protocol is synchronous per-command | Each QUERY gets a PENDING + EVENT response pair |
| Word length limit is 40 chars | May need increase for long symbol names |
| No built-in Unicode normalization for code | camelCase → single token → hashed as-is |
| Collection/bucket/object hierarchy | Maps perfectly to project/filetype/filepath |

---

## 9. Next Steps

1. [ ] Implement `tokenizer-code` feature (camelCase/snake_case splitting)
2. [ ] Wire Tauri sidecar binary management for Sonic
3. [ ] Define collection/bucket naming convention in IPC bridge
4. [ ] Test with real codebase (index all .ts files in src/)
5. [ ] Benchmark query latency at 10K, 50K, 100K indexed objects
6. [ ] Consider increasing `WORD_LIMIT_LENGTH` from 40 to 64 for long identifiers
