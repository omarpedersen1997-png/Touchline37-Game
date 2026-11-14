// Lokal D1-lignende database til Touchline-testmiljøet.
// Bruger node:sqlite og de eksisterende drizzle-migreringer. Ingen netværksadgang.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MIGRATIONS_DIR = resolve(ROOT, 'drizzle');

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
}

// D1 accepterer booleans og konverterer dem; node:sqlite gør ikke.
function normalize(value) {
  if (value === undefined) throw new TypeError('D1_TYPE_ERROR: undefined kan ikke bindes.');
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function plain(row) {
  return row ? { ...row } : null;
}

class LocalStatement {
  constructor(sqlite, sql, args = []) {
    this.sqlite = sqlite;
    this.sql = sql;
    this.args = args;
  }
  bind(...values) {
    return new LocalStatement(this.sqlite, this.sql, values.map(normalize));
  }
  async first(column) {
    const row = plain(this.sqlite.prepare(this.sql).get(...this.args));
    if (column === undefined) return row;
    return row ? row[column] ?? null : null;
  }
  async all() {
    const results = this.sqlite.prepare(this.sql).all(...this.args).map(plain);
    return { success: true, results, meta: { rows_read: results.length } };
  }
  async raw() {
    return this.sqlite.prepare(this.sql).all(...this.args).map((row) => Object.values(row));
  }
  async run() {
    const result = this.sqlite.prepare(this.sql).run(...this.args);
    return {
      success: true,
      results: [],
      meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) },
    };
  }
}

/**
 * Åbner (eller opretter) en lokal database og kører manglende migreringer.
 * @param {string} file Sti til SQLite-filen, eller ':memory:'.
 */
export function openLocalDatabase(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec('CREATE TABLE IF NOT EXISTS _dev_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)');
  const applied = new Set(sqlite.prepare('SELECT name FROM _dev_migrations').all().map((row) => row.name));
  for (const name of migrationFiles()) {
    if (applied.has(name)) continue;
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      sqlite.exec(readFileSync(resolve(MIGRATIONS_DIR, name), 'utf8'));
      sqlite.prepare('INSERT INTO _dev_migrations (name, applied_at) VALUES (?, ?)').run(name, Date.now());
      sqlite.exec('COMMIT');
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  return {
    sqlite,
    file,
    prepare(sql) {
      return new LocalStatement(sqlite, sql);
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    async exec(sql) {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    close() {
      sqlite.close();
    },
  };
}

/** Simpelt R2-lignende lager i hukommelsen. Intet forlader processen. */
export function memoryBucket() {
  const objects = new Map();
  const describe = (key, entry) => ({
    key,
    size: entry.bytes.length,
    etag: entry.etag,
    httpEtag: `"${entry.etag}"`,
    uploaded: entry.uploaded,
    httpMetadata: entry.httpMetadata,
    customMetadata: entry.customMetadata,
    writeHttpMetadata(headers) {
      for (const [name, value] of Object.entries(entry.httpMetadata || {})) {
        if (name === 'contentType') headers.set('Content-Type', value);
      }
    },
  });
  return {
    objects,
    async head(key) {
      const entry = objects.get(key);
      return entry ? describe(key, entry) : null;
    },
    async get(key) {
      const entry = objects.get(key);
      if (!entry) return null;
      const bytes = entry.bytes;
      return {
        ...describe(key, entry),
        body: new Blob([bytes]).stream(),
        async arrayBuffer() {
          return bytes.slice().buffer;
        },
      };
    },
    async put(key, value, options = {}) {
      const bytes = new Uint8Array(value instanceof ArrayBuffer ? value : await new Response(value).arrayBuffer());
      const entry = {
        bytes,
        etag: `${bytes.length.toString(16)}-${Date.now().toString(16)}`,
        uploaded: new Date(),
        httpMetadata: options.httpMetadata || {},
        customMetadata: options.customMetadata || {},
      };
      objects.set(key, entry);
      return describe(key, entry);
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}
