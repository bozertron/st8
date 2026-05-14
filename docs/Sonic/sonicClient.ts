/**
 * SonicClient - Lightweight TCP client for Sonic search backend
 *
 * Implements the Sonic Channel protocol directly (no external dependencies).
 * Manages separate connections for search and ingest modes as Sonic requires.
 *
 * Protocol reference: https://github.com/valeriansaliou/sonic/blob/master/PROTOCOL.md
 */

import * as net from 'net';

// --- Types ---

interface SonicConnectionOptions {
  host: string;
  port: number;
  password: string;
  mode: 'search' | 'ingest' | 'control';
  connectTimeout?: number;
  commandTimeout?: number;
}

interface SonicChannelConnection {
  socket: net.Socket;
  mode: string;
  buffer: number;
  ready: boolean;
}

type PendingCommand = {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// --- Sonic Channel Connection ---

class SonicChannel {
  private options: SonicConnectionOptions;
  private connection: SonicChannelConnection | null = null;
  private pendingCommands: PendingCommand[] = [];
  private eventHandlers: Map<string, (data: string) => void> = new Map();
  private dataBuffer: string = '';
  private connecting: boolean = false;

  constructor(options: SonicConnectionOptions) {
    this.options = {
      connectTimeout: 5000,
      commandTimeout: 10000,
      ...options,
    };
  }

  /** Connect to Sonic and start the specified mode */
  async connect(): Promise<void> {
    if (this.connection?.ready) return;
    if (this.connecting) return;
    this.connecting = true;

    try {
      const socket = await this.createConnection();
      // Read CONNECTED banner
      const banner = await this.readLine(socket);
      if (!banner.startsWith('CONNECTED')) {
        socket.destroy();
        throw new Error(`Unexpected banner: ${banner}`);
      }

      // Send START command
      socket.write(`START ${this.options.mode} ${this.options.password}\n`);
      const started = await this.readLine(socket);

      if (!started.startsWith('STARTED')) {
        socket.destroy();
        throw new Error(`Failed to start ${this.options.mode} mode: ${started}`);
      }

      // Parse buffer size from STARTED response
      const bufferMatch = started.match(/buffer\((\d+)\)/);
      const buffer = bufferMatch ? parseInt(bufferMatch[1], 10) : 20000;

      this.connection = { socket, mode: this.options.mode, buffer, ready: true };

      // Set up data listener for async events
      socket.on('data', (data) => this.handleData(data.toString()));
      socket.on('error', () => this.handleDisconnect());
      socket.on('close', () => this.handleDisconnect());
    } finally {
      this.connecting = false;
    }
  }

  /** Disconnect from Sonic */
  async disconnect(): Promise<void> {
    if (!this.connection) return;
    try {
      this.connection.socket.write('QUIT\n');
      await new Promise<void>((resolve) => {
        this.connection!.socket.once('close', resolve);
        setTimeout(() => {
          this.connection?.socket.destroy();
          resolve();
        }, 1000);
      });
    } catch {
      this.connection?.socket.destroy();
    } finally {
      this.connection = null;
      this.pendingCommands.forEach((cmd) => {
        clearTimeout(cmd.timer);
        cmd.reject(new Error('Connection closed'));
      });
      this.pendingCommands = [];
    }
  }

  /** Check if connection is alive */
  isConnected(): boolean {
    return this.connection?.ready ?? false;
  }

  /** Send PING and verify PONG response */
  async ping(): Promise<boolean> {
    try {
      const response = await this.sendCommand('PING');
      return response === 'PONG';
    } catch {
      return false;
    }
  }

  /** Send a command and wait for synchronous response (OK, RESULT, ERR) */
  async sendCommand(command: string): Promise<string> {
    if (!this.connection?.ready) {
      throw new Error('Not connected to Sonic');
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.pendingCommands.findIndex((c) => c.timer === timer);
        if (idx >= 0) this.pendingCommands.splice(idx, 1);
        reject(new Error(`Command timeout: ${command}`));
      }, this.options.commandTimeout!);

      this.pendingCommands.push({ resolve, reject, timer });
      this.connection!.socket.write(`${command}\n`);
    });
  }

  /**
   * Send a command that returns results via EVENT (async pattern).
   * QUERY and SUGGEST use this pattern: PENDING marker -> EVENT TYPE marker results
   */
  async sendEventCommand(command: string): Promise<string[]> {
    if (!this.connection?.ready) {
      throw new Error('Not connected to Sonic');
    }

    return new Promise<string[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Event command timeout: ${command}`));
      }, this.options.commandTimeout!);

      // First we get PENDING <marker>
      const pendingHandler: PendingCommand = {
        resolve: (response: string) => {
          if (response.startsWith('PENDING')) {
            const marker = response.split(' ')[1];
            // Now wait for EVENT with this marker
            this.eventHandlers.set(marker, (eventData: string) => {
              clearTimeout(timer);
              this.eventHandlers.delete(marker);
              // Parse results: "EVENT QUERY marker id1 id2 id3"
              const parts = eventData.split(' ');
              // Skip "EVENT", type, and marker — rest are results
              const results = parts.slice(3).filter((p) => p.length > 0);
              resolve(results);
            });
          } else if (response.startsWith('ERR')) {
            clearTimeout(timer);
            reject(new Error(response));
          } else {
            clearTimeout(timer);
            resolve([]);
          }
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
      };

      this.pendingCommands.push(pendingHandler);
      this.connection!.socket.write(`${command}\n`);
    });
  }

  // --- Private helpers ---

  private createConnection(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      }, this.options.connectTimeout!);

      socket.connect(this.options.port, this.options.host, () => {
        clearTimeout(timeout);
        resolve(socket);
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private readLine(socket: net.Socket): Promise<string> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      const timeout = setTimeout(() => {
        socket.removeAllListeners('data');
        reject(new Error('Read timeout'));
      }, this.options.connectTimeout!);

      const onData = (data: Buffer) => {
        buffer += data.toString();
        const newlineIdx = buffer.indexOf('\n');
        if (newlineIdx >= 0) {
          clearTimeout(timeout);
          socket.removeListener('data', onData);
          resolve(buffer.substring(0, newlineIdx).trim());
        }
      };
      socket.on('data', onData);
    });
  }

  private handleData(data: string): void {
    this.dataBuffer += data;

    let newlineIdx: number;
    while ((newlineIdx = this.dataBuffer.indexOf('\n')) >= 0) {
      const line = this.dataBuffer.substring(0, newlineIdx).trim();
      this.dataBuffer = this.dataBuffer.substring(newlineIdx + 1);

      if (line.length === 0) continue;

      if (line.startsWith('EVENT')) {
        // Async event response: EVENT TYPE marker [results...]
        const parts = line.split(' ');
        const marker = parts.length >= 3 ? parts[2] : '';
        const handler = this.eventHandlers.get(marker);
        if (handler) {
          handler(line);
        }
      } else {
        // Synchronous response (PONG, OK, RESULT, PENDING, ERR)
        const pending = this.pendingCommands.shift();
        if (pending) {
          clearTimeout(pending.timer);
          pending.resolve(line);
        }
      }
    }
  }

  private handleDisconnect(): void {
    if (this.connection) {
      this.connection.ready = false;
      this.connection = null;
    }
    // Reject all pending commands
    this.pendingCommands.forEach((cmd) => {
      clearTimeout(cmd.timer);
      cmd.reject(new Error('Connection lost'));
    });
    this.pendingCommands = [];
    this.eventHandlers.clear();
  }
}

// --- Main SonicClient Class ---

export class SonicClient {
  private searchChannel: SonicChannel;
  private ingestChannel: SonicChannel;
  private controlChannel: SonicChannel;
  private host: string;
  private port: number;
  private password: string;

  constructor(options?: { host?: string; port?: number; password?: string }) {
    this.host = options?.host ?? '::1';
    this.port = options?.port ?? 1491;
    this.password = options?.password ?? 'maestro_scaffolder_key';

    this.searchChannel = new SonicChannel({
      host: this.host,
      port: this.port,
      password: this.password,
      mode: 'search',
    });

    this.ingestChannel = new SonicChannel({
      host: this.host,
      port: this.port,
      password: this.password,
      mode: 'ingest',
    });

    this.controlChannel = new SonicChannel({
      host: this.host,
      port: this.port,
      password: this.password,
      mode: 'control',
    });
  }

  // --- Connection Lifecycle ---

  /** Connect both search and ingest channels */
  async connect(): Promise<void> {
    try {
      await Promise.all([
        this.searchChannel.connect(),
        this.ingestChannel.connect(),
      ]);
    } catch (err) {
      // Graceful fallback: log warning but don't crash
      console.warn('[SonicClient] Failed to connect:', (err as Error).message);
    }
  }

  /** Disconnect all channels */
  async disconnect(): Promise<void> {
    await Promise.allSettled([
      this.searchChannel.disconnect(),
      this.ingestChannel.disconnect(),
      this.controlChannel.disconnect(),
    ]);
  }

  /** Check if Sonic is reachable and responding */
  async isHealthy(): Promise<boolean> {
    try {
      return await this.searchChannel.ping();
    } catch {
      return false;
    }
  }

  // --- Search Methods ---

  /**
   * Query the Sonic index for matching object IDs
   * @param collection - Index collection (e.g., "codebase")
   * @param bucket - Bucket within collection (e.g., "default")
   * @param terms - Search terms
   * @param limit - Max results to return
   * @returns Array of matching object IDs
   */
  async query(
    collection: string,
    bucket: string,
    terms: string,
    limit?: number
  ): Promise<string[]> {
    try {
      if (!this.searchChannel.isConnected()) {
        await this.searchChannel.connect();
      }
      const escapedTerms = this.escapeText(terms);
      const limitStr = limit ? ` LIMIT(${limit})` : '';
      const cmd = `QUERY ${collection} ${bucket} "${escapedTerms}"${limitStr}`;
      return await this.searchChannel.sendEventCommand(cmd);
    } catch (err) {
      console.warn('[SonicClient] Query failed:', (err as Error).message);
      return []; // Graceful fallback
    }
  }

  /**
   * Get auto-complete suggestions for a word prefix
   * @param collection - Index collection
   * @param bucket - Bucket within collection
   * @param prefix - Word prefix to auto-complete
   * @param limit - Max suggestions to return
   * @returns Array of suggested complete words
   */
  async suggest(
    collection: string,
    bucket: string,
    prefix: string,
    limit?: number
  ): Promise<string[]> {
    try {
      if (!this.searchChannel.isConnected()) {
        await this.searchChannel.connect();
      }
      const escapedPrefix = this.escapeText(prefix);
      const limitStr = limit ? ` LIMIT(${limit})` : '';
      const cmd = `SUGGEST ${collection} ${bucket} "${escapedPrefix}"${limitStr}`;
      return await this.searchChannel.sendEventCommand(cmd);
    } catch (err) {
      console.warn('[SonicClient] Suggest failed:', (err as Error).message);
      return []; // Graceful fallback
    }
  }

  // --- Index Methods ---

  /**
   * Push text to the Sonic index for an object
   * @param collection - Index collection
   * @param bucket - Bucket within collection
   * @param objectId - External object identifier
   * @param text - Text to index
   * @returns true if push was acknowledged
   */
  async push(
    collection: string,
    bucket: string,
    objectId: string,
    text: string
  ): Promise<boolean> {
    try {
      if (!this.ingestChannel.isConnected()) {
        await this.ingestChannel.connect();
      }
      const escapedText = this.escapeText(text);
      const cmd = `PUSH ${collection} ${bucket} ${objectId} "${escapedText}"`;
      const response = await this.ingestChannel.sendCommand(cmd);
      return response === 'OK';
    } catch (err) {
      console.warn('[SonicClient] Push failed:', (err as Error).message);
      return false; // Graceful fallback
    }
  }

  /**
   * Pop (remove) text from the Sonic index for an object
   * @param collection - Index collection
   * @param bucket - Bucket within collection
   * @param objectId - External object identifier
   * @param text - Text to remove from index
   * @returns Number of words removed
   */
  async pop(
    collection: string,
    bucket: string,
    objectId: string,
    text: string
  ): Promise<number> {
    try {
      if (!this.ingestChannel.isConnected()) {
        await this.ingestChannel.connect();
      }
      const escapedText = this.escapeText(text);
      const cmd = `POP ${collection} ${bucket} ${objectId} "${escapedText}"`;
      const response = await this.ingestChannel.sendCommand(cmd);
      const match = response.match(/RESULT (\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch (err) {
      console.warn('[SonicClient] Pop failed:', (err as Error).message);
      return 0; // Graceful fallback
    }
  }

  /**
   * Flush indexed data
   * @param collection - Index collection to flush
   * @param bucket - Optional bucket to flush (flushes entire collection if omitted)
   * @returns Number of items flushed
   */
  async flush(collection: string, bucket?: string): Promise<number> {
    try {
      if (!this.ingestChannel.isConnected()) {
        await this.ingestChannel.connect();
      }
      let cmd: string;
      if (bucket) {
        cmd = `FLUSHB ${collection} ${bucket}`;
      } else {
        cmd = `FLUSHC ${collection}`;
      }
      const response = await this.ingestChannel.sendCommand(cmd);
      const match = response.match(/RESULT (\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch (err) {
      console.warn('[SonicClient] Flush failed:', (err as Error).message);
      return 0; // Graceful fallback
    }
  }

  /**
   * Flush all indexed data for a specific object within a bucket
   * @param collection - Index collection
   * @param bucket - Bucket within collection
   * @param objectId - Object to flush
   * @returns Number of items flushed
   */
  async flushObject(
    collection: string,
    bucket: string,
    objectId: string
  ): Promise<number> {
    try {
      if (!this.ingestChannel.isConnected()) {
        await this.ingestChannel.connect();
      }
      const cmd = `FLUSHO ${collection} ${bucket} ${objectId}`;
      const response = await this.ingestChannel.sendCommand(cmd);
      const match = response.match(/RESULT (\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch (err) {
      console.warn('[SonicClient] FlushObject failed:', (err as Error).message);
      return 0;
    }
  }

  // --- Control Methods ---

  /**
   * Trigger FST consolidation (makes new words available in SUGGEST)
   */
  async consolidate(): Promise<boolean> {
    try {
      if (!this.controlChannel.isConnected()) {
        await this.controlChannel.connect();
      }
      const response = await this.controlChannel.sendCommand('TRIGGER consolidate');
      return response === 'OK';
    } catch (err) {
      console.warn('[SonicClient] Consolidate failed:', (err as Error).message);
      return false;
    }
  }

  /**
   * Get Sonic server info
   */
  async info(): Promise<string> {
    try {
      if (!this.controlChannel.isConnected()) {
        await this.controlChannel.connect();
      }
      return await this.controlChannel.sendCommand('INFO');
    } catch (err) {
      console.warn('[SonicClient] Info failed:', (err as Error).message);
      return '';
    }
  }

  // --- Utility ---

  /** Escape text for Sonic protocol (internal quotes) */
  private escapeText(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
  }
}

// --- Singleton Instance ---

/** Default SonicClient instance configured for local Maestro Scaffolder use */
export const sonicClient = new SonicClient({
  host: '::1',
  port: 1491,
  password: 'maestro_scaffolder_key',
});

export default SonicClient;
