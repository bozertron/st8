'use strict';

/**
 * Tier 1 signal tests — schema contracts at internal handoffs (ticket 21).
 *
 * Tier 2 (check-invariants.js) and Tier 6 (force-checks) test runtime artifacts
 * after the indexer has produced them. Tier 1 sits ABOVE both: it asserts that
 * the SHAPES exchanged between modules at internal boundaries are still
 * compatible — i.e. that a producer's emitted fields are exactly the ones a
 * consumer expects, and vice versa.
 *
 * The named handoffs (per ticket 21 / docs/components/refactor-toolkit.md):
 *
 *   H1. indexer → manifestGenerator
 *       indexer emits file objects → manifest-generator.generateConnectionState()
 *       projects a subset into connection-state.json. If indexer drops a field
 *       (or renames one) and manifest-generator still reads the old name, the
 *       per-file projection silently degrades.
 *
 *   H2. parserPersistence → graphPersister
 *       Both write to the same SQLite. parser-persistence owns
 *       ProjectFiles/Stores/Routes/Commands/Imports/Exports; graph-persister
 *       owns GraphNodes/GraphEdges/MigrationPlans/IntegrationSnapshots. The
 *       contract is that graph-persister's node_type enum can encode every
 *       entity-kind that parser-persistence produces; otherwise the graph
 *       layer can't represent the parser's output.
 *
 *   H3. St8SchemaCard ↔ manifest-generator's load-bearing omissions
 *       The canonical St8SchemaCard carries lifecyclePhase + birthTimestamp,
 *       BUT manifest-generator intentionally omits these from the
 *       connection-state.json projection (documented in both files). If
 *       someone "fixes" the perceived gap by adding them to the projection,
 *       the documented design-decision is violated and downstream identity
 *       contracts (Wave 3A's fingerprint-as-canonical) break. This test
 *       enforces the OMISSION as a contract.
 *
 * These tests fail-loud on contract drift. Probes are independent of
 * runtime indexing — they read the modules statically and assert shape
 * compatibility. No SQLite, no spawn(), no FS writes.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const indexer = require(path.join(REPO_ROOT, 'src', 'features', 'indexing', 'indexer.js'));
const manifestGenerator = require(path.join(REPO_ROOT, 'src', 'features', 'schema-cards', 'manifest-generator.js'));
const st8Types = require(path.join(REPO_ROOT, 'src', 'shared', 'types', 'st8-types.js'));

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Read a JS file as text and return the field keys referenced inside a given
 * object-literal map call. Specifically: extracts keys from
 *   .map(<param> => ({ key1: ..., key2: ... }))
 * Returns the set of `<param>.<key>` reads inside the object literal so we
 * can assert what fields the consumer relies on from the producer's records.
 *
 * This is intentionally a structural string check — it catches contract drift
 * (rename, removal) on the consumer side without needing to actually run the
 * indexer.
 */
function extractProjectionFields(sourceText, funcSignature) {
  const idx = sourceText.indexOf(funcSignature);
  if (idx === -1) return null;
  // Find the .map(... => ({ ... })) block after the function declaration.
  const after = sourceText.slice(idx);
  const mapMatch = after.match(/files\.map\(f\s*=>\s*\(\{([\s\S]*?)\}\)\)/);
  if (!mapMatch) return null;
  const body = mapMatch[1];
  // Collect `f.identifier` reads:
  const reads = new Set();
  const reRead = /\bf\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m;
  while ((m = reRead.exec(body)) !== null) reads.add(m[1]);
  // Collect projected key names (the LHS of each `key:` pair at depth 1):
  const projected = new Set();
  // crude but works: split on top-level commas
  let depth = 0;
  let cur = '';
  const parts = [];
  for (const ch of body) {
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  for (const p of parts) {
    const km = p.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    if (km) projected.add(km[1]);
  }
  return { reads, projected };
}

describe('Tier 1 signal tests — schema contracts at internal handoffs (ticket 21)', () => {

  // ═════════════════════════════════════════════════════════════
  // H1: indexer → manifestGenerator
  // ═════════════════════════════════════════════════════════════
  describe('H1 — indexer → manifest-generator field contract', () => {

    it('P1.1 — indexer.generateManifest produces files[] with required surface', () => {
      // Synthesize a minimal indexer-style file record (matching what
      // src/features/indexing/indexer.js `walk()` / `analyzeImports()` produce).
      const indexedFiles = [
        {
          filepath: 'alpha.js',
          filename: 'alpha.js',
          status: 'GREEN',
          reachabilityScore: 0.95,
          impactRadius: 0,
          sha256Hash: 'a'.repeat(64),
          imports: [],
          importedBy: [],
        },
      ];
      const manifest = indexer.generateManifest(indexedFiles, '/tmp/x');
      const f = manifest.files[0];
      // CONTRACT: these field names are what downstream consumers
      // (manifest-generator, schema-cards, identity-risk) rely on. If indexer
      // renames one (e.g. status → state), this test fails.
      for (const required of ['filepath', 'filename', 'status', 'reachabilityScore', 'impactRadius', 'sha256Hash', 'imports', 'importedBy']) {
        assert.ok(required in f, `indexer.generateManifest must expose '${required}' on each file entry (drift)`);
      }
    });

    it('P1.2 — manifest-generator.generateConnectionState consumes only indexer-exposed fields', () => {
      // Read the consumer's source and confirm every `f.<x>` read is a field
      // the producer (indexer/parser-persistence) is contracted to supply.
      const src = fs.readFileSync(
        path.join(REPO_ROOT, 'src', 'features', 'schema-cards', 'manifest-generator.js'),
        'utf8'
      );
      const extracted = extractProjectionFields(src, 'function generateConnectionState');
      assert.ok(extracted, 'expected to locate generateConnectionState projection');

      const producerSupplies = new Set([
        // From indexer.generateManifest projection (verified by P1.1):
        'filepath', 'filename', 'status', 'reachabilityScore', 'impactRadius',
        'sha256Hash', 'imports', 'importedBy',
        // Augmented later in the pipeline (parser-persistence + schema-card emitter):
        'fingerprint', 'intent',
      ]);

      const unknownReads = [...extracted.reads].filter((f) => !producerSupplies.has(f));
      assert.deepEqual(
        unknownReads, [],
        `manifest-generator.generateConnectionState reads field(s) the producer is not contracted to supply: ${unknownReads.join(', ')}`
      );
    });

    it('P1.3 — manifest-generator.generateConnectionState end-to-end shape on representative input', () => {
      // Real handoff: feed manifest-generator a record shaped like what the
      // full pipeline (indexer + schema-card emitter) actually produces.
      const realisticInput = [{
        fingerprint: 'alpha.js||1747000000000',
        filepath: 'alpha.js',
        filename: 'alpha.js',
        status: 'GREEN',
        reachabilityScore: 0.95,
        impactRadius: 0,
        sha256Hash: 'a'.repeat(64),
        imports: [],
        importedBy: [],
        intent: { purpose: 'test', dependsOnBehavior: '', valueStatement: '' },
      }];
      const out = manifestGenerator.generateConnectionState(realisticInput, '/tmp/x');
      assert.equal(out.files.length, 1);
      const f = out.files[0];
      // The projection MUST include these keys for downstream consumers:
      for (const required of ['fingerprint', 'filepath', 'filename', 'status', 'reachabilityScore', 'impactRadius', 'sha256Hash', 'imports', 'importedBy', 'intent']) {
        assert.ok(required in f, `manifest projection missing '${required}' (downstream consumers will break)`);
      }
    });
  });

  // ═════════════════════════════════════════════════════════════
  // H2: parserPersistence → graphPersister
  // ═════════════════════════════════════════════════════════════
  describe('H2 — parser-persistence → graph-persister schema contract', () => {

    it('P2.1 — graph-persister node_type enum covers every parser-persistence entity kind', () => {
      const graphSrc = fs.readFileSync(
        path.join(REPO_ROOT, 'src', 'core', 'database', 'graph-persister.js'),
        'utf8'
      );
      // Pull the CHECK constraint enum from the GraphNodes DDL.
      const m = graphSrc.match(/node_type TEXT NOT NULL CHECK\(node_type IN \(([^)]+)\)\)/);
      assert.ok(m, 'expected GraphNodes.node_type CHECK constraint in graph-persister.js');
      const enumValues = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
      const enumSet = new Set(enumValues);

      // Parser-persistence emits these entity kinds (parser table names map to
      // node_type singulars). If a new parser is added that produces a new
      // entity kind (say, 'effect' for side-effect tracking) without updating
      // graph-persister's node_type enum, the graph layer can't store it.
      const parserKinds = ['file', 'store', 'route', 'command', 'type', 'import', 'export'];
      const missing = parserKinds.filter((k) => !enumSet.has(k));
      assert.deepEqual(
        missing, [],
        `graph-persister.node_type enum is missing kinds that parser-persistence emits: ${missing.join(', ')}.`
      );
    });

    it('P2.2 — parser-persistence ProjectFiles columns match the indexer\'s overview output', () => {
      // parser-persistence.persistOverviewData(projectId, snapshotId, fileList) writes:
      //   project_id, snapshot_id, file_path, file_name
      // The indexer's overview emits filepath + filename. Contract: the
      // column names in the INSERT must match the parser's source code shape.
      const parserSrc = fs.readFileSync(
        path.join(REPO_ROOT, 'src', 'features', 'indexing', 'parser-persistence.js'),
        'utf8'
      );
      const insert = parserSrc.match(/INSERT INTO ProjectFiles \(([^)]+)\) VALUES/);
      assert.ok(insert, 'expected ProjectFiles INSERT statement');
      const cols = insert[1].split(',').map((c) => c.trim());
      // Required columns the indexer→parser handoff depends on:
      for (const c of ['project_id', 'snapshot_id', 'file_path', 'file_name']) {
        assert.ok(cols.includes(c), `ProjectFiles INSERT missing column '${c}' (handoff broken)`);
      }
    });

    it('P2.3 — graph-persister edge_type enum covers expected edge kinds from analysis layer', () => {
      const graphSrc = fs.readFileSync(
        path.join(REPO_ROOT, 'src', 'core', 'database', 'graph-persister.js'),
        'utf8'
      );
      const m = graphSrc.match(/edge_type TEXT NOT NULL CHECK\(edge_type IN \(([^)]+)\)\)/);
      assert.ok(m, 'expected GraphEdges.edge_type CHECK constraint');
      const enumSet = new Set(m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')));
      // The analysis/graph-builder layer emits these edge kinds:
      const expected = ['depends_on', 'imports', 'exports', 'invokes', 'contains'];
      const missing = expected.filter((k) => !enumSet.has(k));
      assert.deepEqual(
        missing, [],
        `graph-persister.edge_type enum missing kinds: ${missing.join(', ')}`
      );
    });
  });

  // ═════════════════════════════════════════════════════════════
  // H3: St8SchemaCard ↔ manifest-generator load-bearing omissions
  // ═════════════════════════════════════════════════════════════
  describe('H3 — load-bearing omissions in connection-state.json', () => {

    it('P3.1 — St8SchemaCard canonical shape carries both lifecyclePhase and birthTimestamp', () => {
      // These two fields are the load-bearing-omission contract subjects.
      // If they ever leave the canonical shape, the "omission" stops being an
      // omission and this test should fail to surface that.
      const keys = Object.keys(st8Types.St8SchemaCard);
      assert.ok(keys.includes('lifecyclePhase'), 'St8SchemaCard must keep lifecyclePhase as canonical');
      assert.ok(keys.includes('birthTimestamp'), 'St8SchemaCard must keep birthTimestamp as canonical');
    });

    it('P3.2 — manifest-generator INTENTIONALLY omits lifecyclePhase + birthTimestamp from generateConnectionState projection', () => {
      const src = fs.readFileSync(
        path.join(REPO_ROOT, 'src', 'features', 'schema-cards', 'manifest-generator.js'),
        'utf8'
      );
      const extracted = extractProjectionFields(src, 'function generateConnectionState');
      assert.ok(extracted, 'expected to locate generateConnectionState projection');
      // Per the load-bearing comment block, these must NOT appear in the
      // projected file entries. If a future PR adds them, that PR must also
      // edit the comment block first (and this test) — it's a deliberate
      // gate, not a forgotten field.
      assert.ok(!extracted.projected.has('lifecyclePhase'),
        'manifest-generator must NOT project lifecyclePhase (see load-bearing-omission block at top of file)');
      assert.ok(!extracted.projected.has('birthTimestamp'),
        'manifest-generator must NOT project birthTimestamp (encoded in fingerprint per Wave-3A contract)');
    });

    it('P3.3 — fingerprint round-trip preserves birthTimestamp (so omission is safe)', () => {
      // The reason manifest-generator can omit birthTimestamp is that it is
      // already encoded inside `fingerprint`. If parseFingerprint drifts, the
      // omission becomes a data loss.
      const fp = st8Types.generateFingerprint('src/foo.js', '1747000000000');
      const parsed = st8Types.parseFingerprint(fp);
      assert.equal(parsed.filepath, 'src/foo.js');
      assert.equal(parsed.birthTimestamp, '1747000000000');
    });
  });
});
