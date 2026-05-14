// src/commands/sonicIndexer.ts
// SonicIndexer — transforms graph data into optimized Sonic push operations.
// Handles batch indexing, deduplication, incremental updates, and full re-index.

import Database from 'better-sqlite3';
import { SonicClient, sonicClient } from './sonicClient.js';
import { getSharedDatabasePath } from './integr8/databasePersister.js';
import { GraphNode, GraphEdge, NodeType, EdgeType } from './integr8/types.js';

// ============ TYPES ============

export interface FileInfo {
  path: string;
  exports?: string[];
  directory: string;
  name: string;
  size?: number;
}

export interface FileChange {
  path: string;
  type: 'add' | 'modify' | 'delete';
  oldNodeIds?: string[];
}

interface IndexStats {
  nodesIndexed: number;
  edgesIndexed: number;
  filesIndexed: number;
  duplicatesSkipped: number;
  errors: number;
  elapsedMs: number;
}

// ============ CONSTANTS ============

const COLLECTION = 'codebase';
const BUCKET_NODES = 'nodes';
const BUCKET_EDGES = 'edges';
const BUCKET_FILES = 'files';
const BUCKET_DIRS = 'dirs';
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 5;
const MAX_TEXT_LENGTH = 500;

// ============ SONIC INDEXER ============

export class SonicIndexer {
  private client: SonicClient;
  private indexedIds: Set<string> = new Set();
  private connected: boolean = false;

  constructor(client?: SonicClient) {
    this.client = client ?? sonicClient;
  }

  // ─── Connection Management ──────────────────────────────────────────────────

  private async ensureConnected(): Promise<boolean> {
    if (this.connected) return true;
    try {
      await this.client.connect();
      const healthy = await this.client.isHealthy();
      this.connected = healthy;
      return healthy;
    } catch {
      this.connected = false;
      return false;
    }
  }

  // ─── Graph Node Indexing ────────────────────────────────────────────────────

  /**
   * Push all graph nodes with searchable text (name, type, metadata).
   * Batches pushes for efficiency and flushes after each batch.
   */
  async indexGraphNodes(nodes: GraphNode[], projectId?: string): Promise<number> {
    if (!(await this.ensureConnected())) return 0;

    const bucket = projectId || BUCKET_NODES;
    let pushCount = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const objectId = this.nodeObjectId(node, projectId);

      // Deduplication: skip if already indexed in this session
      if (this.indexedIds.has(objectId)) continue;

      const text = this.buildNodeSearchText(node);
      if (!text) continue;

      try {
        const ok = await this.client.push(COLLECTION, bucket, objectId, text);
        if (ok) {
          pushCount++;
          this.indexedIds.add(objectId);
        }
      } catch {
        // Non-fatal: continue with remaining nodes
      }

      // Rate limiting: pause after every batch
      if ((i + 1) % BATCH_SIZE === 0) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    return pushCount;
  }

  /**
   * Push edge relationships for relationship queries.
   * Indexes edge type + connected node names for searchability.
   */
  async indexGraphEdges(edges: GraphEdge[], nodes: GraphNode[], projectId?: string): Promise<number> {
    if (!(await this.ensureConnected())) return 0;

    const bucket = projectId || BUCKET_EDGES;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    let pushCount = 0;

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const objectId = this.edgeObjectId(edge, projectId);

      if (this.indexedIds.has(objectId)) continue;

      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      const text = this.buildEdgeSearchText(edge, fromNode, toNode);
      if (!text) continue;

      try {
        const ok = await this.client.push(COLLECTION, bucket, objectId, text);
        if (ok) {
          pushCount++;
          this.indexedIds.add(objectId);
        }
      } catch {
        // Non-fatal
      }

      if ((i + 1) % BATCH_SIZE === 0) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    return pushCount;
  }

  /**
   * Push file paths, exports, and directory structure.
   */
  async indexFileMetadata(files: FileInfo[], projectId?: string): Promise<number> {
    if (!(await this.ensureConnected())) return 0;

    const bucket = projectId || BUCKET_FILES;
    let pushCount = 0;
    const indexedDirs = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const objectId = `file:${projectId || 'default'}:${file.path}`;

      if (this.indexedIds.has(objectId)) continue;

      const text = this.buildFileSearchText(file);
      if (!text) continue;

      try {
        const ok = await this.client.push(COLLECTION, bucket, objectId, text);
        if (ok) {
          pushCount++;
          this.indexedIds.add(objectId);
        }
      } catch {
        // Non-fatal
      }

      // Also index the directory if not yet indexed
      if (file.directory && !indexedDirs.has(file.directory)) {
        const dirObjectId = `dir:${projectId || 'default'}:${file.directory}`;
        if (!this.indexedIds.has(dirObjectId)) {
          const dirParts = file.directory.split('/').filter(Boolean);
          const dirText = dirParts.join(' ') + ' directory';
          try {
            await this.client.push(COLLECTION, projectId || BUCKET_DIRS, dirObjectId, dirText);
            this.indexedIds.add(dirObjectId);
          } catch { /* non-fatal */ }
        }
        indexedDirs.add(file.directory);
      }

      if ((i + 1) % BATCH_SIZE === 0) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    return pushCount;
  }

  // ─── Full Re-Index ──────────────────────────────────────────────────────────

  /**
   * Full re-index from SQLite data for a given project.
   * Flushes existing Sonic data, then re-pushes everything.
   */
  async reindexProject(projectId: string): Promise<IndexStats> {
    const startTime = Date.now();
    const stats: IndexStats = {
      nodesIndexed: 0,
      edgesIndexed: 0,
      filesIndexed: 0,
      duplicatesSkipped: 0,
      errors: 0,
      elapsedMs: 0,
    };

    if (!(await this.ensureConnected())) {
      stats.elapsedMs = Date.now() - startTime;
      return stats;
    }

    // Reset deduplication tracker for this project
    this.clearProjectFromTracker(projectId);

    let db: Database.Database | null = null;
    try {
      const dbPath = getSharedDatabasePath();
      db = new Database(dbPath, { readonly: true });

      // Flush existing Sonic data for this project
      await this.client.flush(COLLECTION, projectId);

      // Fetch all nodes from SQLite
      const nodeRows = db.prepare(
        'SELECT * FROM GraphNodes WHERE graph_id = ?'
      ).all(projectId) as any[];

      const graphNodes: GraphNode[] = nodeRows.map(row => ({
        id: String(row.node_id),
        type: (row.node_type || 'file') as NodeType,
        name: row.name,
        path: row.path || undefined,
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      }));

      stats.nodesIndexed = await this.indexGraphNodes(graphNodes, projectId);

      // Fetch all edges from SQLite
      const edgeRows = db.prepare(
        'SELECT * FROM GraphEdges WHERE graph_id = ?'
      ).all(projectId) as any[];

      const graphEdges: GraphEdge[] = edgeRows.map(row => ({
        id: String(row.edge_id),
        from: String(row.from_node_id),
        to: String(row.to_node_id),
        type: (row.edge_type || 'depends_on') as EdgeType,
        status: row.status || undefined,
        confidence: row.confidence ?? 1.0,
      }));

      stats.edgesIndexed = await this.indexGraphEdges(graphEdges, graphNodes, projectId);

      // Build file metadata from FILE-type nodes
      const fileNodes = graphNodes.filter(n => n.type === NodeType.FILE);
      const fileInfos: FileInfo[] = fileNodes.map(n => {
        const filePath = n.path || n.name;
        const parts = filePath.split('/');
        return {
          path: filePath,
          exports: n.metadata?.exports,
          directory: parts.slice(0, -1).join('/'),
          name: parts[parts.length - 1] || n.name,
        };
      });

      stats.filesIndexed = await this.indexFileMetadata(fileInfos, projectId);

      // Consolidate FST for SUGGEST to work
      await this.client.consolidate();

    } catch (err: any) {
      stats.errors++;
      console.warn(`[SonicIndexer] reindexProject failed: ${err.message}`);
    } finally {
      if (db) db.close();
    }

    stats.elapsedMs = Date.now() - startTime;
    return stats;
  }

  // ─── Incremental Index ──────────────────────────────────────────────────────

  /**
   * Update only changed files in the Sonic index.
   * Handles add/modify/delete operations.
   */
  async incrementalIndex(
    changes: FileChange[],
    nodes: GraphNode[],
    edges: GraphEdge[],
    projectId: string
  ): Promise<IndexStats> {
    const startTime = Date.now();
    const stats: IndexStats = {
      nodesIndexed: 0,
      edgesIndexed: 0,
      filesIndexed: 0,
      duplicatesSkipped: 0,
      errors: 0,
      elapsedMs: 0,
    };

    if (!(await this.ensureConnected())) {
      stats.elapsedMs = Date.now() - startTime;
      return stats;
    }

    const bucket = projectId;

    for (const change of changes) {
      try {
        if (change.type === 'delete') {
          // Flush objects for the deleted file
          const objectId = `file:${projectId}:${change.path}`;
          await this.client.flushObject(COLLECTION, bucket, objectId);
          this.indexedIds.delete(objectId);

          // Also flush any nodes associated with this file
          if (change.oldNodeIds) {
            for (const nodeId of change.oldNodeIds) {
              const nodeObjId = `node:${projectId}:${nodeId}`;
              await this.client.flushObject(COLLECTION, bucket, nodeObjId);
              this.indexedIds.delete(nodeObjId);
            }
          }
        } else {
          // For add/modify: flush old data, then re-push
          const fileObjectId = `file:${projectId}:${change.path}`;
          await this.client.flushObject(COLLECTION, bucket, fileObjectId);
          this.indexedIds.delete(fileObjectId);

          // Find nodes belonging to this file
          const fileNodes = nodes.filter(n => n.path === change.path);
          for (const node of fileNodes) {
            const nodeObjId = this.nodeObjectId(node, projectId);
            await this.client.flushObject(COLLECTION, bucket, nodeObjId);
            this.indexedIds.delete(nodeObjId);
          }

          // Re-index nodes for this file
          const indexedCount = await this.indexGraphNodes(fileNodes, projectId);
          stats.nodesIndexed += indexedCount;

          // Re-index edges involving these nodes
          const fileNodeIds = new Set(fileNodes.map(n => n.id));
          const relatedEdges = edges.filter(
            e => fileNodeIds.has(e.from) || fileNodeIds.has(e.to)
          );
          stats.edgesIndexed += await this.indexGraphEdges(relatedEdges, nodes, projectId);

          // Re-index file metadata
          const parts = change.path.split('/');
          const fileInfo: FileInfo = {
            path: change.path,
            directory: parts.slice(0, -1).join('/'),
            name: parts[parts.length - 1],
          };
          stats.filesIndexed += await this.indexFileMetadata([fileInfo], projectId);
        }
      } catch (err: any) {
        stats.errors++;
        console.warn(`[SonicIndexer] incrementalIndex error for ${change.path}: ${err.message}`);
      }
    }

    // Consolidate after batch of changes
    try {
      await this.client.consolidate();
    } catch { /* non-fatal */ }

    stats.elapsedMs = Date.now() - startTime;
    return stats;
  }

  // ─── Text Building ──────────────────────────────────────────────────────────

  private buildNodeSearchText(node: GraphNode): string {
    const parts: string[] = [];

    // Name is always searchable
    parts.push(node.name);

    // Node type helps with filtered searches
    parts.push(node.type);

    // File path components
    if (node.path) {
      const pathParts = node.path.split('/').filter(Boolean);
      parts.push(...pathParts);
    }

    // Metadata enrichment
    if (node.metadata) {
      if (node.metadata.exportedAs) parts.push(node.metadata.exportedAs);
      if (node.metadata.kind) parts.push(node.metadata.kind);
      if (node.metadata.stateKeys) parts.push(...node.metadata.stateKeys);
      if (node.metadata.actionKeys) parts.push(...node.metadata.actionKeys);
      if (node.metadata.getterKeys) parts.push(...node.metadata.getterKeys);
      if (node.metadata.uiElements) parts.push(...node.metadata.uiElements);
      if (node.metadata.specifiers) parts.push(...node.metadata.specifiers);
      if (node.metadata.description) parts.push(node.metadata.description);
    }

    return parts.filter(Boolean).join(' ').substring(0, MAX_TEXT_LENGTH);
  }

  private buildEdgeSearchText(
    edge: GraphEdge,
    fromNode?: GraphNode,
    toNode?: GraphNode
  ): string {
    const parts: string[] = [];

    parts.push(edge.type);
    if (fromNode) parts.push(fromNode.name);
    if (toNode) parts.push(toNode.name);

    if (edge.type === EdgeType.IMPORTS && toNode) {
      parts.push('import', toNode.name);
    }
    if (edge.type === EdgeType.EXPORTS && fromNode) {
      parts.push('export', fromNode.name);
    }

    return parts.filter(Boolean).join(' ').substring(0, MAX_TEXT_LENGTH);
  }

  private buildFileSearchText(file: FileInfo): string {
    const parts: string[] = [];

    parts.push(file.name);
    parts.push(file.path);

    // Directory components
    const dirParts = file.path.split('/').filter(Boolean);
    parts.push(...dirParts);

    // Exports
    if (file.exports && file.exports.length > 0) {
      parts.push('exports');
      parts.push(...file.exports);
    }

    return parts.filter(Boolean).join(' ').substring(0, MAX_TEXT_LENGTH);
  }

  // ─── Object ID Helpers ──────────────────────────────────────────────────────

  private nodeObjectId(node: GraphNode, projectId?: string): string {
    const prefix = projectId ? `${projectId}:` : '';
    return `node:${prefix}${node.id}`;
  }

  private edgeObjectId(edge: GraphEdge, projectId?: string): string {
    const prefix = projectId ? `${projectId}:` : '';
    return `edge:${prefix}${edge.id}`;
  }

  // ─── Deduplication Management ───────────────────────────────────────────────

  /** Clear tracked IDs for a specific project (used before re-index). */
  private clearProjectFromTracker(projectId: string): void {
    const prefix = projectId + ':';
    for (const id of this.indexedIds) {
      if (id.includes(prefix)) {
        this.indexedIds.delete(id);
      }
    }
  }

  /** Reset the entire deduplication tracker. */
  resetTracker(): void {
    this.indexedIds.clear();
  }

  /** Get count of tracked indexed objects. */
  getTrackedCount(): number {
    return this.indexedIds.size;
  }
}

// ============ SINGLETON ============

let _indexerInstance: SonicIndexer | null = null;

export function getSonicIndexer(client?: SonicClient): SonicIndexer {
  if (!_indexerInstance) {
    _indexerInstance = new SonicIndexer(client);
  }
  return _indexerInstance;
}

// ============ UTILITY ============

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
