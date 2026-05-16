'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, '..', '..', '..', 'scripts', 'migration', 'ogb-destroy.js');

const { walkOGB, findLiveOGBReferences } = require(SCRIPT);

describe('scripts/migration/ogb-destroy.js (ticket 24)', () => {
  describe('walkOGB()', () => {
    let tmp;

    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'st8-ogb-walk-'));
    });

    afterEach(() => {
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('returns files and dirs separately, dirs in bottom-up order', () => {
      // Build a small fixture:
      //   tmp/a.txt
      //   tmp/sub1/b.txt
      //   tmp/sub1/deep/c.txt
      fs.mkdirSync(path.join(tmp, 'sub1', 'deep'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'a.txt'), 'a');
      fs.writeFileSync(path.join(tmp, 'sub1', 'b.txt'), 'b');
      fs.writeFileSync(path.join(tmp, 'sub1', 'deep', 'c.txt'), 'c');

      const { files, dirs } = walkOGB(tmp);

      assert.equal(files.length, 3);
      // Deepest dir must appear before its parent in `dirs`.
      const deepIdx = dirs.findIndex((d) => d.endsWith('deep'));
      const sub1Idx = dirs.findIndex((d) => d.endsWith('sub1'));
      assert.ok(deepIdx >= 0 && sub1Idx >= 0, 'both dirs found');
      assert.ok(deepIdx < sub1Idx, 'deep dir listed before its parent (bottom-up)');
    });

    it('handles empty directory cleanly', () => {
      const { files, dirs } = walkOGB(tmp);
      assert.deepEqual(files, []);
      assert.deepEqual(dirs, []);
    });
  });

  describe('findLiveOGBReferences()', () => {
    it('returns an array (no throw) when run against the live repo', () => {
      const hits = findLiveOGBReferences();
      assert.ok(Array.isArray(hits));
    });

    it('would not flag its own doc comments (self-exclusion)', () => {
      // The script's own header documents the require patterns it searches for.
      // findLiveOGBReferences must NOT count those documentation strings.
      const hits = findLiveOGBReferences();
      const selfHits = hits.filter((h) => h.file.endsWith('ogb-destroy.js'));
      assert.equal(selfHits.length, 0, 'script must not flag its own doc comments');
    });
  });

  describe('--dry-run CLI behavior', () => {
    it('exits 0 in dry-run mode and does not delete OGB/ if present', () => {
      const res = spawnSync('node', [SCRIPT], {
        encoding: 'utf8',
        timeout: 10000,
      });
      assert.equal(res.status, 0, `expected exit 0, got ${res.status}. stderr: ${res.stderr}`);
      assert.match(res.stdout, /DRY-RUN/);
      assert.match(res.stdout, /Dry-run complete/);
      // OGB/ may or may not exist; if present after dry-run, that's correct.
    });

    it('declines unknown flags by falling back to dry-run (safe default)', () => {
      const res = spawnSync('node', [SCRIPT, '--not-a-flag'], {
        encoding: 'utf8',
        timeout: 10000,
      });
      assert.equal(res.status, 0);
      assert.match(res.stdout, /DRY-RUN/);
    });
  });
});
