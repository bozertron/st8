'use strict';

/**
 * data-ingestion config-exposure tests — ticket 16.
 *
 * configureDataIngestion / getDataIngestionConfig / resetDataIngestionConfig
 * were added to make circuit-breaker + adaptive-retry tuning observable
 * at runtime (instead of forking the file). These probes pin:
 *
 *   - default config matches DATA_INGESTION_DEFAULTS
 *   - partial updates leave other fields intact
 *   - validators throw RangeError on out-of-bounds values
 *   - getDataIngestionConfig returns a deep copy (no mutation leakage)
 *   - resetDataIngestionConfig restores factory defaults
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const di = require('../../../src/features/indexing/data-ingestion');

test.afterEach(() => di.resetDataIngestionConfig());

test('default config matches DATA_INGESTION_DEFAULTS', () => {
    const cfg = di.getDataIngestionConfig();
    assert.equal(cfg.circuitBreaker.failureThreshold, di.DATA_INGESTION_DEFAULTS.circuitBreaker.failureThreshold);
    assert.equal(cfg.circuitBreaker.resetTimeoutMs, di.DATA_INGESTION_DEFAULTS.circuitBreaker.resetTimeoutMs);
    assert.equal(cfg.adaptiveRetry.maxRetries, di.DATA_INGESTION_DEFAULTS.adaptiveRetry.maxRetries);
});

test('partial circuit-breaker tune leaves other fields intact', () => {
    di.configureDataIngestion({ circuitBreaker: { failureThreshold: 7 } });
    const cfg = di.getDataIngestionConfig();
    assert.equal(cfg.circuitBreaker.failureThreshold, 7);
    assert.equal(cfg.circuitBreaker.resetTimeoutMs, 30000, 'unmodified field must keep default');
    assert.equal(cfg.circuitBreaker.halfOpenMaxAttempts, 1);
});

test('partial adaptive-retry tune leaves other fields intact', () => {
    di.configureDataIngestion({ adaptiveRetry: { maxRetries: 0 } });
    const cfg = di.getDataIngestionConfig();
    assert.equal(cfg.adaptiveRetry.maxRetries, 0);
    assert.equal(cfg.adaptiveRetry.baseDelayMs, 200);
});

test('errorDelayMap and skipErrors are replaceable', () => {
    di.configureDataIngestion({
        adaptiveRetry: {
            errorDelayMap: { EBUSY: 2 },
            skipErrors: ['EBUSY'],
        },
    });
    const cfg = di.getDataIngestionConfig();
    assert.deepEqual(cfg.adaptiveRetry.errorDelayMap, { EBUSY: 2 });
    assert.deepEqual(cfg.adaptiveRetry.skipErrors, ['EBUSY']);
});

test('validators throw on out-of-bounds failureThreshold (< 1)', () => {
    assert.throws(() => di.configureDataIngestion({ circuitBreaker: { failureThreshold: 0 } }), /failureThreshold/);
    assert.throws(() => di.configureDataIngestion({ circuitBreaker: { failureThreshold: -3 } }), /failureThreshold/);
});

test('validators throw on out-of-bounds resetTimeoutMs (< 0)', () => {
    assert.throws(() => di.configureDataIngestion({ circuitBreaker: { resetTimeoutMs: -1 } }), /resetTimeoutMs/);
});

test('validators throw on out-of-bounds maxRetries (< 0)', () => {
    assert.throws(() => di.configureDataIngestion({ adaptiveRetry: { maxRetries: -1 } }), /maxRetries/);
});

test('validators throw on wrong-type errorDelayMap and skipErrors', () => {
    assert.throws(() => di.configureDataIngestion({ adaptiveRetry: { errorDelayMap: 'oops' } }), /errorDelayMap/);
    assert.throws(() => di.configureDataIngestion({ adaptiveRetry: { skipErrors: 'oops' } }), /skipErrors/);
});

test('getDataIngestionConfig returns a deep copy — mutating the result does NOT poison module state', () => {
    const snap = di.getDataIngestionConfig();
    snap.circuitBreaker.failureThreshold = 999;
    snap.adaptiveRetry.errorDelayMap.EBUSY = 99;
    const fresh = di.getDataIngestionConfig();
    assert.equal(fresh.circuitBreaker.failureThreshold, 3);
    assert.equal(fresh.adaptiveRetry.errorDelayMap.EBUSY, undefined);
});

test('resetDataIngestionConfig restores ALL fields', () => {
    di.configureDataIngestion({
        circuitBreaker: { failureThreshold: 9, resetTimeoutMs: 100, halfOpenMaxAttempts: 4 },
        adaptiveRetry: { baseDelayMs: 1, maxRetries: 0, errorDelayMap: { X: 1 }, skipErrors: ['X'] },
    });
    di.resetDataIngestionConfig();
    const cfg = di.getDataIngestionConfig();
    assert.equal(cfg.circuitBreaker.failureThreshold, 3);
    assert.equal(cfg.circuitBreaker.resetTimeoutMs, 30000);
    assert.equal(cfg.circuitBreaker.halfOpenMaxAttempts, 1);
    assert.equal(cfg.adaptiveRetry.baseDelayMs, 200);
    assert.equal(cfg.adaptiveRetry.maxRetries, 3);
    assert.deepEqual(cfg.adaptiveRetry.skipErrors, ['ENOENT', 'ENOTDIR', 'EISDIR']);
});

test('configureDataIngestion returns the resulting effective config', () => {
    const result = di.configureDataIngestion({ circuitBreaker: { failureThreshold: 4 } });
    assert.equal(result.circuitBreaker.failureThreshold, 4);
    assert.equal(result.circuitBreaker.resetTimeoutMs, 30000);
});
