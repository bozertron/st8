// src/commands/sonicQueries.ts
// Sonic-powered query layer: fast Sonic lookup → SQLite enrichment, with graceful fallback.
// Each function: try Sonic first, fall back to pure SQLite if Sonic unavailable.
// Performance metrics: track and log query times for Sonic vs SQLite paths.

import Database from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { SonicClient, sonicClient } from './sonicClient.js';
import { getSharedDatabasePath } from './integr8/databasePersister.js';
import { NodeQueryResult, EdgeQueryResult } from './types.js';

// ============ TYPES ============

export interface QueryOptions {
  limit?: number;
  type?: 'symbol' | 'file' | 'dir';
  graphId?: string;
}

export interface QueryResult<T> {
  data: T;
  source: 'sonic' | 'sqlite' | 'sonic+sqlite';
  queryTimeMs: number;
  sonicTimeMs?: number;
  sqliteTimeMs?: number;
}

export interface SymbolSearchResult {
  nodeId: number;
  graphId: string;
  name: string;
  nodeType: string;
  path: string | null;
  metadata?: Record<string, any>;
}

export interface RelatedFileResult {
  filePath: string;
  nodeId: number;
  relationship: string;
  direction: 'inbound' | 'outbound';
}

// ============ CONSTANTS ============

const COLLECTION = 'codebase';

// ============ PLATFORM AVAILABILITY CHECK ============

/**
 * Check if Sonic search is available on this platform.
 * Sonic is a Linux-only binary; on other platforms we gracefully degrade to SQLite-only.
 */
function checkSonicAvailability(): { available: boolean; reason?: string } {
  const platform = os.platform();

  // Sonic binary is Linux-only
  if (platform !== 'linux') {
    return { available: false, reason: `Sonic not supported on platform: ${platform} (Linux-only). Using SQLite fallback.` };
  }

  // Check if sonic binary exists in common paths
  const sonicPaths = [
    '/usr/local/bin/sonic',
    '/usr/bin/sonic',
    path.join(os.homedir(), '.local', 'bin', 'sonic'),
    path.join(process.cwd(), 'sonic-master', 'target', 'release', 'sonic'),
    path.join(process.cwd(), 'sonic-master', 'target', 'debug', 'sonic'),
  ];

  const binaryFound = sonicPaths.some(p => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  if (!binaryFound) {
    return { available: false, reason: 'Sonic binary not found. Using SQLite fallback for all queries.' };
  }

  return { available: true };
}

// Perform check once at module load
const _sonicCheck = checkSonicAvailability();
let _sonicAvailabilityLogged = false;

function isSonicAvailable(): boolean {
  if (!_sonicCheck.available && !_sonicAvailabilityLogged) {
    console.warn(`[SonicQueries] ${_sonicCheck.reason}`);
    _sonicAvailabilityLogged = true;
  }
  return _sonicCheck.available;
}

// ============ QUERY CLASS ============

export class SonicQueries {
  private client: SonicClient;
  private dbPath: string;

  constructor(client?: SonicClient, dbPath?: string) {
    this.client = client ?? sonicClient;
    this.dbPath = dbPath ?? getSharedDatabasePath();
  }

  // ─── findImportsOf ──────────────────────────────────────────────────────────

  /**
   * Find all import edges for a given symbol.
   * Sonic query → SQLite edge fetch (<5ms target vs 325ms pure SQLite).
   */
  async findImportsOf(
    symbol: string,
    graphId?: string
  ): Promise<QueryResult<EdgeQueryResult[]>> {
    const startTime = performance.now();
    let sonicTimeMs: number | undefined;
    let sqliteTimeMs: number | undefined;
    let source: 'sonic' | 'sqlite' | 'sonic+sqlite' = 'sqlite';

    // Try Sonic first
    const sonicNodeIds = await this.trySonicQuery(symbol, graphId);

    if (sonicNodeIds.length > 0) {
      sonicTimeMs = performance.now() - startTime;
      source = 'sonic+sqlite';

      // Use Sonic IDs to do targeted SQLite edge fetch
      const sqlStart = performance.now();
      const edges = this.fetchImportEdgesForNodeIds(sonicNodeIds, graphId);
      sqliteTimeMs = performance.now() - sqlStart;

      return {
        data: edges,
        source,
        queryTimeMs: performance.now() - startTime,
        sonicTimeMs,
        sqliteTimeMs,
      };
    }

    // Fallback: pure SQLite
    const sqlStart = performance.now();
    const edges = this.findImportsSQLite(symbol, graphId);
    sqliteTimeMs = performance.now() - sqlStart;

    return {
      data: edges,
      source: 'sqlite',
      queryTimeMs: performance.now() - startTime,
      sqliteTimeMs,
    };
  }

  // ─── findConsumersOf ────────────────────────────────────────────────────────

  /**
   * Find all nodes that consume (import/depend on) a given file.
   * Sonic query → SQLite relationship fetch.
   */
  async findConsumersOf(
    file: string,
    graphId?: string
  ): Promise<QueryResult<NodeQueryResult[]>> {
    const startTime = performance.now();
    let sonicTimeMs: number | undefined;
    let sqliteTimeMs: number | undefined;

    // Try Sonic to find the file's node IDs
    const fileName = path.basename(file);
    const sonicNodeIds = await this.trySonicQuery(fileName, graphId);

    if (sonicNodeIds.length > 0) {
      sonicTimeMs = performance.now() - startTime;

      const sqlStart = performance.now();
      const consumers = this.fetchConsumersForNodeIds(sonicNodeIds, file, graphId);
      sqliteTimeMs = performance.now() - sqlStart;

      return {
        data: consumers,
        source: 'sonic+sqlite',
        queryTimeMs: performance.now() - startTime,
        sonicTimeMs,
        sqliteTimeMs,
      };
    }

    // Fallback: pure SQLite
    const sqlStart = performance.now();
    const consumers = this.findConsumersSQLite(file, graphId);
    sqliteTimeMs = performance.now() - sqlStart;

    return {
      data: consumers,
      source: 'sqlite',
      queryTimeMs: performance.now() - startTime,
      sqliteTimeMs,
    };
  }

  // ─── searchSymbols ──────────────────────────────────────────────────────────

  /**
   * Full-text symbol search with fuzzy matching.
   * Uses Sonic for initial lookup, SQLite for full details.
   */
  async searchSymbols(
    query: string,
    options?: QueryOptions
  ): Promise<QueryResult<SymbolSearchResult[]>> {
    const startTime = performance.now();
    const limit = options?.limit ?? 20;
    const graphId = options?.graphId;
    let sonicTimeMs: number | undefined;
    let sqliteTimeMs: number | undefined;

    // Try Sonic first
    const sonicIds = await this.trySonicQuery(query, graphId, limit);

    if (sonicIds.length > 0) {
      sonicTimeMs = performance.now() - startTime;

      const sqlStart = performance.now();
      const results = this.fetchSymbolDetails(sonicIds, options);
      sqliteTimeMs = performance.now() - sqlStart;

      return {
        data: results,
        source: 'sonic+sqlite',
        queryTimeMs: performance.now() - startTime,
        sonicTimeMs,
        sqliteTimeMs,
      };
    }

    // Fallback: SQLite LIKE search
    const sqlStart = performance.now();
    const results = this.searchSymbolsSQLite(query, options);
    sqliteTimeMs = performance.now() - sqlStart;

    return {
      data: results,
      source: 'sqlite',
      queryTimeMs: performance.now() - startTime,
      sqliteTimeMs,
    };
  }

  // ─── getDirectorySubgraph ───────────────────────────────────────────────────

  /**
   * Fast directory content lookup.
   * Uses Sonic to find file IDs in a directory, then SQLite for full graph data.
   */
  async getDirectorySubgraph(
    dir: string,
    graphId?: string
  ): Promise<QueryResult<{ nodes: NodeQueryResult[]; edges: EdgeQueryResult[] }>> {
    const startTime = performance.now();
    let sonicTimeMs: number | undefined;
    let sqliteTimeMs: number | undefined;

    // Extract directory name for Sonic lookup
    const dirName = path.basename(dir) || dir;
    const sonicIds = await this.trySonicQuery(dirName, graphId, 100);

    if (sonicIds.length > 0) {
      sonicTimeMs = performance.now() - startTime;

      const sqlStart = performance.now();
      const result = this.fetchDirectorySubgraphSQLite(dir, sonicIds, graphId);
      sqliteTimeMs = performance.now() - sqlStart;

      return {
        data: result,
        source: 'sonic+sqlite',
        queryTimeMs: performance.now() - startTime,
        sonicTimeMs,
        sqliteTimeMs,
      };
    }

    // Fallback: pure SQLite path scan
    const sqlStart = performance.now();
    const result = this.fetchDirectorySubgraphSQLite(dir, [], graphId);
    sqliteTimeMs = performance.now() - sqlStart;

    return {
      data: result,
      source: 'sqlite',
      queryTimeMs: performance.now() - startTime,
      sqliteTimeMs,
    };
  }

  // ─── suggestCompletions ─────────────────────────────────────────────────────

  /**
   * Autocomplete via Sonic suggest().
   * Pure Sonic operation — no SQLite fallback needed for suggestions.
   */
  async suggestCompletions(
    prefix: string,
    graphId?: string,
    limit?: number
  ): Promise<QueryResult<string[]>> {
    const startTime = performance.now();
    const bucket = graphId || 'nodes';
    const maxResults = limit ?? 10;

    try {
      const suggestions = await this.client.suggest(COLLECTION, bucket, prefix, maxResults);

      return {
        data: suggestions,
        source: 'sonic',
        queryTimeMs: performance.now() - startTime,
        sonicTimeMs: performance.now() - startTime,
      };
    } catch {
      // Fallback: SQLite prefix search
      const sqlStart = performance.now();
      const results = this.suggestFromSQLite(prefix, graphId, maxResults);

      return {
        data: results,
        source: 'sqlite',
        queryTimeMs: performance.now() - startTime,
        sqliteTimeMs: performance.now() - sqlStart,
      };
    }
  }

  // ─── findRelatedFiles ──────────────────────────────────────────────────────

  /**
   * Find files connected to a given file via imports/exports.
   */
  async findRelatedFiles(
    file: string,
    graphId?: string
  ): Promise<QueryResult<RelatedFileResult[]>> {
    const startTime = performance.now();
    let sonicTimeMs: number | undefined;
    let sqliteTimeMs: number | undefined;

    const fileName = path.basename(file);
    const sonicIds = await this.trySonicQuery(fileName, graphId);

    if (sonicIds.length > 0) {
      sonicTimeMs = performance.now() - startTime;

      const sqlStart = performance.now();
      const related = this.fetchRelatedFilesSQLite(sonicIds, file, graphId);
      sqliteTimeMs = performance.now() - sqlStart;

      return {
        data: related,
        source: 'sonic+sqlite',
        queryTimeMs: performance.now() - startTime,
        sonicTimeMs,
        sqliteTimeMs,
      };
    }

    // Fallback
    const sqlStart = performance.now();
    const related = this.fetchRelatedFilesSQLite([], file, graphId);
    sqliteTimeMs = performance.now() - sqlStart;

    return {
      data: related,
      source: 'sqlite',
      queryTimeMs: performance.now() - startTime,
      sqliteTimeMs,
    };
  }

  // ─── Sonic Helpers ──────────────────────────────────────────────────────────

  private async trySonicQuery(
    terms: string,
    graphId?: string,
    limit?: number
  ): Promise<string[]> {
    // Skip Sonic entirely if platform/binary not available
    if (!isSonicAvailable()) {
      return [];
    }
    try {
      const bucket = graphId || 'nodes';
      const results = await this.client.query(COLLECTION, bucket, terms, limit);
      return results;
    } catch {
      return [];
    }
  }

  // ─── SQLite Query Implementations ───────────────────────────────────────────

  private getDb(): Database.Database {
    return new Database(this.dbPath, { readonly: true });
  }

  private fetchImportEdgesForNodeIds(
    sonicObjectIds: string[],
    graphId?: string
  ): EdgeQueryResult[] {
    const db = this.getDb();
    try {
      // Parse node IDs from Sonic object IDs (format: "node:projectId:nodeId" or "projectId:nodeId")
      const nodeIds = this.extractNodeIds(sonicObjectIds);
      if (nodeIds.length === 0) return [];

      const placeholders = nodeIds.map(() => '?').join(',');
      let query = `SELECT * FROM GraphEdges WHERE edge_type = 'imports' AND to_node_id IN (${placeholders})`;
      const params: any[] = [...nodeIds];

      if (graphId) {
        query += ' AND graph_id = ?';
        params.push(graphId);
      }

      return db.prepare(query).all(...params) as EdgeQueryResult[];
    } catch (err: any) {
      console.warn(`[SonicQueries] fetchImportEdges failed: ${err.message}`);
      return [];
    } finally {
      db.close();
    }
  }

  private findImportsSQLite(symbol: string, graphId?: string): EdgeQueryResult[] {
    const db = this.getDb();
    try {
      let query: string;
      const params: any[] = [];

      if (graphId) {
        query = `
          SELECT e.* FROM GraphEdges e
          JOIN GraphNodes n ON e.to_node_id = n.node_id AND e.graph_id = n.graph_id
          WHERE e.edge_type = 'imports' AND n.name = ? AND e.graph_id = ?
        `;
        params.push(symbol, graphId);
      } else {
        query = `
          SELECT e.* FROM GraphEdges e
          JOIN GraphNodes n ON e.to_node_id = n.node_id AND e.graph_id = n.graph_id
          WHERE e.edge_type = 'imports' AND n.name = ?
        `;
        params.push(symbol);
      }

      return db.prepare(query).all(...params) as EdgeQueryResult[];
    } catch (err: any) {
      console.warn(`[SonicQueries] findImportsSQLite failed: ${err.message}`);
      return [];
    } finally {
      db.close();
    }
  }

  private fetchConsumersForNodeIds(
    sonicObjectIds: string[],
    filePath: string,
    graphId?: string
  ): NodeQueryResult[] {
    const db = this.getDb();
    try {
      // First find the target file nodes
      let fileQuery: string;
      const fileParams: any[] = [];

      if (graphId) {
        fileQuery = `SELECT node_id FROM GraphNodes WHERE (path LIKE ? OR name = ?) AND graph_id = ?`;
        fileParams.push(`%${path.basename(filePath)}`, filePath, graphId);
      } else {
        fileQuery = `SELECT node_id FROM GraphNodes WHERE (path LIKE ? OR name = ?)`;
        fileParams.push(`%${path.basename(filePath)}`, filePath);
      }

      const fileNodes = db.prepare(fileQuery).all(...fileParams) as any[];
      const fileNodeIds = fileNodes.map((r: any) => r.node_id);

      if (fileNodeIds.length === 0) return [];

      // Find all edges pointing TO these file nodes
      const placeholders = fileNodeIds.map(() => '?').join(',');
      let edgeQuery = `SELECT DISTINCT from_node_id FROM GraphEdges WHERE to_node_id IN (${placeholders})`;
      const edgeParams: any[] = [...fileNodeIds];

      if (graphId) {
        edgeQuery += ' AND graph_id = ?';
        edgeParams.push(graphId);
      }

      const edgeRows = db.prepare(edgeQuery).all(...edgeParams) as any[];
      const consumerIds = edgeRows.map((r: any) => r.from_node_id).filter(
        (id: number) => !fileNodeIds.includes(id)
      );

      if (consumerIds.length === 0) return [];

      const cPlaceholders = consumerIds.map(() => '?').join(',');
      let nodeQuery = `SELECT * FROM GraphNodes WHERE node_id IN (${cPlaceholders})`;
      const nodeParams: any[] = [...consumerIds];

      if (graphId) {
        nodeQuery += ' AND graph_id = ?';
        nodeParams.push(graphId);
      }

      return db.prepare(nodeQuery).all(...nodeParams) as NodeQueryResult[];
    } catch (err: any) {
      console.warn(`[SonicQueries] fetchConsumers failed: ${err.message}`);
      return [];
    } finally {
      db.close();
    }
  }

  private findConsumersSQLite(filePath: string, graphId?: string): NodeQueryResult[] {
    return this.fetchConsumersForNodeIds([], filePath, graphId);
  }

  private fetchSymbolDetails(
    sonicObjectIds: string[],
    options?: QueryOptions
  ): SymbolSearchResult[] {
    const db = this.getDb();
    try {
      const nodeIds = this.extractNodeIds(sonicObjectIds);
      if (nodeIds.length === 0) return [];

      const placeholders = nodeIds.map(() => '?').join(',');
      let query = `SELECT * FROM GraphNodes WHERE node_id IN (${placeholders})`;
      const params: any[] = [...nodeIds];

      if (options?.graphId) {
        query += ' AND graph_id = ?';
        params.push(options.graphId);
      }

      if (options?.type) {
        query += ' AND node_type = ?';
        params.push(options.type);
      }

      if (options?.limit) {
        query += ` LIMIT ${options.limit}`;
      }

      const rows = db.prepare(query).all(...params) as any[];
      return rows.map(this.mapToSymbolResult);
    } catch (err: any) {
      console.warn(`[SonicQueries] fetchSymbolDetails failed: ${err.message}`);
      return [];
    } finally {
      db.close();
    }
  }

  private searchSymbolsSQLite(query: string, options?: QueryOptions): SymbolSearchResult[] {
    const db = this.getDb();
    try {
      const limit = options?.limit ?? 20;
      let sql: string;
      const params: any[] = [];

      if (options?.graphId) {
        sql = `SELECT * FROM GraphNodes WHERE name LIKE ? AND graph_id = ?`;
        params.push(`%${query}%`, options.graphId);
      } else {
        sql = `SELECT * FROM GraphNodes WHERE name LIKE ?`;
        params.push(`%${query}%`);
      }

      if (options?.type) {
        sql += ' AND node_type = ?';
        params.push(options.type);
      }

      sql += ` LIMIT ${limit}`;

      const rows = db.prepare(sql).all(...params) as any[];
      return rows.map(this.mapToSymbolResult);
    } catch (err: any) {
      console.warn(`[SonicQueries] searchSymbolsSQLite failed: ${err.message}`);
      return [];
    } finally {
      db.close();
    }
  }

  private fetchDirectorySubgraphSQLite(
    dir: string,
    _sonicIds: string[],
    graphId?: string
  ): { nodes: NodeQueryResult[]; edges: EdgeQueryResult[] } {
    const db = this.getDb();
    try {
      // Find all nodes whose path starts with this directory
      let nodeQuery: string;
      const nodeParams: any[] = [];

      if (graphId) {
        nodeQuery = `SELECT * FROM GraphNodes WHERE path LIKE ? AND graph_id = ?`;
        nodeParams.push(`${dir}%`, graphId);
      } else {
        nodeQuery = `SELECT * FROM GraphNodes WHERE path LIKE ?`;
        nodeParams.push(`${dir}%`);
      }

      const nodes = db.prepare(nodeQuery).all(...nodeParams) as NodeQueryResult[];
      const nodeIdSet = new Set(nodes.map(n => n.node_id));

      if (nodes.length === 0) {
        return { nodes: [], edges: [] };
      }

      // Find edges where both endpoints are in this directory
      const placeholders = nodes.map(() => '?').join(',');
      let edgeQuery = `SELECT * FROM GraphEdges WHERE from_node_id IN (${placeholders}) OR to_node_id IN (${placeholders})`;
      const edgeParams: any[] = [...nodes.map(n => n.node_id), ...nodes.map(n => n.node_id)];

      if (graphId) {
        edgeQuery += ' AND graph_id = ?';
        edgeParams.push(graphId);
      }

      const allEdges = db.prepare(edgeQuery).all(...edgeParams) as EdgeQueryResult[];
      // Filter to only edges internal to the directory
      const edges = allEdges.filter(
        e => nodeIdSet.has(e.from_node_id) && nodeIdSet.has(e.to_node_id)
      );

      return { nodes, edges };
    } catch (err: any) {
      console.warn(`[SonicQueries] fetchDirectorySubgraph failed: ${err.message}`);
      return { nodes: [], edges: [] };
    } finally {
      db.close();
    }
  }

  private suggestFromSQLite(prefix: string, graphId?: string, limit?: number): string[] {
    const db = this.getDb();
    try {
      const maxResults = limit ?? 10;
      let query: string;
      const params: any[] = [];

      if (graphId) {
        query = `SELECT DISTINCT name FROM GraphNodes WHERE name LIKE ? AND graph_id = ? LIMIT ?`;
        params.push(`${prefix}%`, graphId, maxResults);
      } else {
        query = `SELECT DISTINCT name FROM GraphNodes WHERE name LIKE ? LIMIT ?`;
        params.push(`${prefix}%`, maxResults);
      }

      const rows = db.prepare(query).all(...params) as any[];
      return rows.map((r: any) => r.name);
    } catch (err: any) {
      console.warn(`[SonicQueries] suggestFromSQLite failed: ${err.message}`);
      return [];
    } finally {
      db.close();
    }
  }

  private fetchRelatedFilesSQLite(
    sonicObjectIds: string[],
    filePath: string,
    graphId?: string
  ): RelatedFileResult[] {
    const db = this.getDb();
    try {
      // Find the target file's node IDs
      let fileQuery: string;
      const fileParams: any[] = [];

      if (graphId) {
        fileQuery = `SELECT node_id FROM GraphNodes WHERE (path LIKE ? OR path = ?) AND graph_id = ?`;
        fileParams.push(`%${path.basename(filePath)}`, filePath, graphId);
      } else {
        fileQuery = `SELECT node_id FROM GraphNodes WHERE (path LIKE ? OR path = ?)`;
        fileParams.push(`%${path.basename(filePath)}`, filePath);
      }

      const fileNodes = db.prepare(fileQuery).all(...fileParams) as any[];
      const fileNodeIds = fileNodes.map((r: any) => r.node_id);

      if (fileNodeIds.length === 0) return [];

      const results: RelatedFileResult[] = [];
      const placeholders = fileNodeIds.map(() => '?').join(',');

      // Outbound: edges FROM this file
      let outQuery = `
        SELECT e.edge_type, n.node_id, n.path
        FROM GraphEdges e
        JOIN GraphNodes n ON e.to_node_id = n.node_id AND e.graph_id = n.graph_id
        WHERE e.from_node_id IN (${placeholders}) AND n.path IS NOT NULL
      `;
      const outParams: any[] = [...fileNodeIds];
      if (graphId) {
        outQuery += ' AND e.graph_id = ?';
        outParams.push(graphId);
      }

      const outRows = db.prepare(outQuery).all(...outParams) as any[];
      for (const row of outRows) {
        if (row.path && !fileNodeIds.includes(row.node_id)) {
          results.push({
            filePath: row.path,
            nodeId: row.node_id,
            relationship: row.edge_type,
            direction: 'outbound',
          });
        }
      }

      // Inbound: edges TO this file
      let inQuery = `
        SELECT e.edge_type, n.node_id, n.path
        FROM GraphEdges e
        JOIN GraphNodes n ON e.from_node_id = n.node_id AND e.graph_id = n.graph_id
        WHERE e.to_node_id IN (${placeholders}) AND n.path IS NOT NULL
      `;
      const inParams: any[] = [...fileNodeIds];
      if (graphId) {
        inQuery += ' AND e.graph_id = ?';
        inParams.push(graphId);
      }

      const inRows = db.prepare(inQuery).all(...inParams) as any[];
      for (const row of inRows) {
        if (row.path && !fileNodeIds.includes(row.node_id)) {
          results.push({
            filePath: row.path,
            nodeId: row.node_id,
            relationship: row.edge_type,
            direction: 'inbound',
          });
        }
      }

      // Deduplicate by filePath
      const seen = new Set<string>();
      return results.filter(r => {
        if (seen.has(r.filePath)) return false;
        seen.add(r.filePath);
        return true;
      });
    } catch (err: any) {
      console.warn(`[SonicQueries] fetchRelatedFiles failed: ${err.message}`);
      return [];
    } finally {
      db.close();
    }
  }

  // ─── Utility ────────────────────────────────────────────────────────────────

  /**
   * Extract numeric node IDs from Sonic object ID strings.
   * Handles formats: "node:projId:123", "projId:123", "123"
   */
  private extractNodeIds(objectIds: string[]): number[] {
    const ids: number[] = [];
    for (const oid of objectIds) {
      const parts = oid.split(':');
      const lastPart = parts[parts.length - 1];
      const num = parseInt(lastPart, 10);
      if (!isNaN(num)) {
        ids.push(num);
      }
    }
    return ids;
  }

  private mapToSymbolResult(row: any): SymbolSearchResult {
    return {
      nodeId: row.node_id,
      graphId: row.graph_id,
      name: row.name,
      nodeType: row.node_type,
      path: row.path || null,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  }
}

// ============ SINGLETON ============

let _queryInstance: SonicQueries | null = null;

export function getSonicQueries(client?: SonicClient, dbPath?: string): SonicQueries {
  if (!_queryInstance) {
    _queryInstance = new SonicQueries(client, dbPath);
  }
  return _queryInstance;
}
