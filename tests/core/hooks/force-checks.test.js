'use strict';

/**
 * tests/core/hooks/force-checks.test.js — probes for FC1–FC6 and
 * runForceChecks (tickets 3, 4, 17, 18, 19).
 *
 * Each check is a pure function of `ctx` (modulo filesystem reads under
 * `ctx.targetDir`). We construct a synthetic ctx with a minimal
 * persistence stub and a tmp `.st8/` layout per test. No mocks of the
 * SUT — every check function under test is the real implementation
 * imported from src/core/hooks/force-checks.js.
 *
 * Conventions (tests/README.md):
 *  - node:test + node:assert/strict
 *  - tmp dirs via fs.mkdtempSync + t.after cleanup
 *  - synthetic persistence is a plain object with the methods FC1..FC6
 *    actually call (getAllFiles, getAllConnections)
 *  - no assert.ok(true) — every probe asserts on a real observable
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const path = require('path');

const {
  runForceChecks,
  checkFC1_filesHaveCards,
  checkFC2_cardsHaveFiles,
  checkFC3_manifestCoversFiles,
  checkFC4_gapReportRefsExist,
  checkFC5_connectionsResolve,
  checkFC6_fingerprintFormat,
  FC4_KNOWN_ARCH_REFS,
} = require('../../../src/core/hooks/force-checks');

function freshTargetDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'st8-fc-test-'));
}

function makePersistence({ files = [], connections = null } = {}) {
  // Synthetic persistence — only the methods the checks actually call.
  // FC5: omit getAllConnections to probe the missing-impl path; supply
  // an array (possibly empty) to probe the implemented path.
  const p = {
    getAllFiles: () => files,
  };
  if (connections !== null) {
    p.getAllConnections = () => connections;
  }
  return p;
}

function writeCard(targetDir, filepath) {
  const safe = filepath.replace(/[\/\\]/g, '_');
  const cardsDir = path.join(targetDir, '.st8', 'schema-cards');
  fs.mkdirSync(cardsDir, { recursive: true });
  fs.writeFileSync(path.join(cardsDir, safe + '.json'), JSON.stringify({ filepath }));
}

// ─── FC1: every file has a card ──────────────────────────────────

test('FC1 — passes when every file_registry row has a matching schema card', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const files = [
    { filepath: 'src/a.js', fingerprint: 'src/a.js||t1' },
    { filepath: 'src/b.js', fingerprint: 'src/b.js||t2' },
  ];
  writeCard(dir, 'src/a.js');
  writeCard(dir, 'src/b.js');

  const result = checkFC1_filesHaveCards({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.id, 'FC1');
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(result.issues.length, 0);
});

test('FC1 — fails when a file_registry row is missing its schema card', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const files = [
    { filepath: 'src/a.js', fingerprint: 'src/a.js||t1' },
    { filepath: 'src/b.js', fingerprint: 'src/b.js||t2' },
  ];
  writeCard(dir, 'src/a.js');
  // src/b.js card NOT written

  const result = checkFC1_filesHaveCards({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.ok, false);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].filepath, 'src/b.js');
});

// ─── FC2: every card has a file_registry row ─────────────────────

test('FC2 — fails when a card on disk has no matching file_registry row (stale-card detector)', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // file_registry has just one file, but two cards on disk
  const files = [{ filepath: 'src/a.js', fingerprint: 'src/a.js||t1' }];
  writeCard(dir, 'src/a.js');
  writeCard(dir, 'src/deleted.js');  // orphan

  const result = checkFC2_cardsHaveFiles({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.ok, false);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].card, 'src_deleted.js.json');
});

test('FC2 — returns ok with skipped message when cards dir does not exist', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const result = checkFC2_cardsHaveFiles({ persistence: makePersistence({ files: [] }), targetDir: dir });

  assert.equal(result.ok, true);
  assert.match(result.message, /no cards dir/);
});

// ─── FC3: manifest covers every file_registry row ────────────────

test('FC3 — passes when manifest fingerprints fully cover file_registry', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const files = [
    { filepath: 'src/a.js', fingerprint: 'src/a.js||t1' },
    { filepath: 'src/b.js', fingerprint: 'src/b.js||t2' },
  ];
  fs.writeFileSync(
    path.join(dir, 'connection-state.json'),
    JSON.stringify({ files: [{ fingerprint: 'src/a.js||t1' }, { fingerprint: 'src/b.js||t2' }] })
  );

  const result = checkFC3_manifestCoversFiles({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.ok, true);
  assert.equal(result.staleAccumulationDetected, false);
});

test('FC3 — ticket 17: stale-accumulation signature surfaces in failure message', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // file_registry has TWO rows for the same filepath (different
  // birthTimestamps = different fingerprints) — the cross-run
  // accumulation signature batch 026 fixed via pruneFilesNotIn.
  const files = [
    { filepath: 'src/a.js', fingerprint: 'src/a.js||t1-old' },
    { filepath: 'src/a.js', fingerprint: 'src/a.js||t2-current' },
  ];
  // Manifest carries only the latest fingerprint per filepath.
  fs.writeFileSync(
    path.join(dir, 'connection-state.json'),
    JSON.stringify({ files: [{ fingerprint: 'src/a.js||t2-current' }] })
  );

  const result = checkFC3_manifestCoversFiles({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.ok, false);
  assert.equal(result.staleAccumulationDetected, true, 'must detect stale-accumulation pattern');
  assert.match(result.message, /STALE ACCUMULATION/);
  assert.match(result.message, /pruneFilesNotIn/);
});

test('FC3 — failure WITHOUT stale-accumulation signature gets a different message', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // Each filepath has only one row, but the manifest is missing one
  // fingerprint outright (real manifest-generator skip, not stale rows).
  const files = [
    { filepath: 'src/a.js', fingerprint: 'src/a.js||t1' },
    { filepath: 'src/b.js', fingerprint: 'src/b.js||t2' },
  ];
  fs.writeFileSync(
    path.join(dir, 'connection-state.json'),
    JSON.stringify({ files: [{ fingerprint: 'src/a.js||t1' }] })
  );

  const result = checkFC3_manifestCoversFiles({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.ok, false);
  assert.equal(result.staleAccumulationDetected, false);
  assert.equal(/STALE ACCUMULATION/.test(result.message), false);
  assert.match(result.message, /manifest-generator/);
});

// ─── FC4: gap report refs ────────────────────────────────────────

test('FC4 — passes when every backtick-quoted ref in gap-analysis.md exists in file_registry', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const files = [{ filepath: 'real-file.js', fingerprint: 'real-file.js||t1' }];
  fs.mkdirSync(path.join(dir, '.st8'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.st8', 'gap-analysis.md'),
    'A report referencing `real-file.js` only.\n'
  );

  const result = checkFC4_gapReportRefsExist({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});

test('FC4 — fails when a backtick-quoted ref in gap report is NOT in file_registry', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const files = [{ filepath: 'real-file.js', fingerprint: 'real-file.js||t1' }];
  fs.mkdirSync(path.join(dir, '.st8'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.st8', 'gap-analysis.md'),
    '`real-file.js` is fine but `ghost.js` is broken.\n'
  );

  const result = checkFC4_gapReportRefsExist({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.ok, false);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].ref, 'ghost.js');
});

test('FC4 — ticket 4: /api/* URL-shaped refs are skipped (not flagged)', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const files = [];
  fs.mkdirSync(path.join(dir, '.st8'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.st8', 'gap-analysis.md'),
    '`/api/connection-state.json` is an endpoint, not a file.\n'
  );

  const result = checkFC4_gapReportRefsExist({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.ok, true, '/api/* refs must not be flagged');
});

test('FC4 — ticket 4: allowlisted arch refs from gap-analyzer mapping table are skipped', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // file_registry is EMPTY — there are no real files. But the gap report
  // mentions arch-mapping refs (indexer, persistence, gap-analyzer). The
  // allowlist (FC4_KNOWN_ARCH_REFS) must let these pass.
  const files = [];
  fs.mkdirSync(path.join(dir, '.st8'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.st8', 'gap-analysis.md'),
    'Refs: `src/features/indexing/indexer.js`, `src/core/database/persistence.js`, `src/features/prd/generator.js`.\n'
  );

  const result = checkFC4_gapReportRefsExist({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.ok, true, 'allowlisted arch refs must not be flagged even when absent from registry');
  // Sanity: the allowlist itself contains the refs we used.
  assert.equal(FC4_KNOWN_ARCH_REFS.has('src/features/indexing/indexer.js'), true);
});

test('FC4 — ticket 4: a broken src/... ref NOT in allowlist IS flagged (no more wholesale prefix-skip)', async (t) => {
  // The OLD behavior pre-ticket-4 was: any `src/...` ref was prefix-
  // skipped, silently swallowing real broken refs in the source tree.
  // The new allowlist-based behavior must flag a broken `src/foo.js`
  // ref that isn't in either the registry or the allowlist.
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const files = [];
  fs.mkdirSync(path.join(dir, '.st8'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.st8', 'gap-analysis.md'),
    'This ref is broken: `src/totally-not-in-allowlist.js`.\n'
  );

  const result = checkFC4_gapReportRefsExist({ persistence: makePersistence({ files }), targetDir: dir });

  assert.equal(result.ok, false, 'a real broken src/... ref must be flagged (no wholesale src/ skip)');
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].ref, 'src/totally-not-in-allowlist.js');
});

// ─── FC5: connections endpoints ──────────────────────────────────

test('FC5 — ticket 18: passes when every connection endpoint exists in file_registry', async () => {
  const files = [
    { filepath: 'src/a.js', fingerprint: 'src/a.js||t1' },
    { filepath: 'src/b.js', fingerprint: 'src/b.js||t2' },
  ];
  const connections = [
    { sourceFingerprint: 'src/a.js||t1', targetFingerprint: 'src/b.js||t2', connectionType: 'IMPORT' },
  ];

  const result = checkFC5_connectionsResolve({ persistence: makePersistence({ files, connections }), targetDir: '/tmp' });

  assert.equal(result.ok, true);
  assert.equal(result.count, 1);
  assert.equal(result.issues.length, 0);
});

test('FC5 — ticket 18: fails (with detail) when a connection has a dangling endpoint', async () => {
  const files = [{ filepath: 'src/a.js', fingerprint: 'src/a.js||t1' }];
  // target points at a fingerprint NOT in files → dangling.
  const connections = [
    { sourceFingerprint: 'src/a.js||t1', targetFingerprint: 'src/ghost.js||tX', connectionType: 'IMPORT' },
  ];

  const result = checkFC5_connectionsResolve({ persistence: makePersistence({ files, connections }), targetDir: '/tmp' });

  assert.equal(result.ok, false);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].reason, 'target missing');
});

test('FC5 — ticket 18: FAILS (was silent-pass before) when persistence lacks getAllConnections', async () => {
  // Pre-ticket-18: missing getAllConnections returned ok:true with a
  // "skipped" message — a silent-pass cheat. New contract: fail loudly.
  const files = [];
  // persistence stub WITHOUT getAllConnections (connections:null in our helper omits the method).
  const persistence = makePersistence({ files, connections: null });

  const result = checkFC5_connectionsResolve({ persistence, targetDir: '/tmp' });

  assert.equal(result.ok, false, 'must FAIL when getAllConnections missing (no more silent-pass)');
  assert.equal(result.issues.length, 1);
  assert.match(result.message, /not implemented/);
  assert.match(result.message, /FAIL/);
});

// ─── FC6: fingerprint format ─────────────────────────────────────

test('FC6 — passes when every fingerprint matches <filepath>||<timestamp>', async () => {
  const files = [
    { filepath: 'a.js', fingerprint: 'a.js||2026-05-15T00:00:00Z' },
    { filepath: 'b.js', fingerprint: 'b.js||2026-05-15T00:00:01Z' },
  ];

  const result = checkFC6_fingerprintFormat({ persistence: makePersistence({ files }), targetDir: '/tmp' });

  assert.equal(result.ok, true);
});

test('FC6 — fails when a fingerprint is malformed (no `||` separator)', async () => {
  const files = [
    { filepath: 'a.js', fingerprint: 'a.js||2026-01-01T00:00:00Z' },
    { filepath: 'b.js', fingerprint: 'broken-no-separator' },
    { filepath: 'c.js', fingerprint: null },  // non-string
  ];

  const result = checkFC6_fingerprintFormat({ persistence: makePersistence({ files }), targetDir: '/tmp' });

  assert.equal(result.ok, false);
  assert.equal(result.issues.length, 2);
});

// ─── runForceChecks driver: ticket 19 (async write) + ticket 26 cross-check ───

test('runForceChecks — ticket 19: writes report via async fs.promises (no sync fs.writeFileSync)', async (t) => {
  // We assert two things:
  //  1. The driver writes .st8/force-check.md (file exists + non-empty).
  //  2. The implementation no longer calls fs.writeFileSync — proven by
  //     reading the source. (We cannot reliably observe "did this call
  //     block the event loop?" from inside Node, so the static check
  //     is the strongest negative test we can offer.)
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const files = [];
  const connections = [];
  const ctx = { persistence: makePersistence({ files, connections }), targetDir: dir };

  const result = await runForceChecks(ctx);

  assert.equal(typeof result.okCount, 'number');
  const reportPath = path.join(dir, '.st8', 'force-check.md');
  assert.equal(fs.existsSync(reportPath), true, 'report file must exist');
  const body = await fsp.readFile(reportPath, 'utf8');
  assert.match(body, /^# Force-Check Report/);
  assert.match(body, /\*\*Result: \d+\/6 checks pass\*\*/);

  // Static check: src/core/hooks/force-checks.js uses fs.promises, NOT
  // fs.writeFileSync, for its report write.
  const src = await fsp.readFile(
    path.join(__dirname, '..', '..', '..', 'src', 'core', 'hooks', 'force-checks.js'),
    'utf8'
  );
  // The synchronous write must NOT appear for the report path.
  assert.equal(
    /fs\.writeFileSync\s*\(\s*reportPath/.test(src),
    false,
    'fs.writeFileSync(reportPath, ...) must be gone'
  );
  // The async write must be present.
  assert.match(src, /fsp\.writeFile\s*\(\s*reportPath/);
});

test('runForceChecks — driver runs all 6 checks and returns the summary even when checks fail', async (t) => {
  const dir = freshTargetDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  // File registry references a card that doesn't exist on disk → FC1 fails.
  const files = [{ filepath: 'src/missing.js', fingerprint: 'src/missing.js||t1' }];
  const ctx = { persistence: makePersistence({ files, connections: [] }), targetDir: dir };

  const result = await runForceChecks(ctx);

  assert.equal(result.results.length, 6, 'all 6 checks must have run');
  assert.equal(result.results.map((r) => r.id).sort().join(','), 'FC1,FC2,FC3,FC4,FC5,FC6');
  // FC1 fails because no card exists.
  const fc1 = result.results.find((r) => r.id === 'FC1');
  assert.equal(fc1.ok, false);
});
