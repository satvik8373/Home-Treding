import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Mode, TradingSession } from "../shared/model.ts";

export interface SavedBroker {
  apiKey: string;
  accessToken: string;
  account: string;
  name: string;
  expiresAt: number;
  permissions?: { exchanges: string[]; products: string[]; orderTypes: string[] };
}
export class Store {
  private db: DatabaseSync;
  private key: Buffer;
  constructor(directory: string, encryptionKey?: Buffer) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(join(directory, "009.sqlite"));
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
    );
    const keyPath = join(directory, "session.key");
    if (!encryptionKey && !existsSync(keyPath))
      writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: "wx" });
    this.key = encryptionKey ?? readFileSync(keyPath);
    if (this.key.length !== 32)
      throw new Error("The local session encryption key is invalid.");
  }
  get<T>(key: string): T | null {
    const row = this.db
      .prepare("SELECT value FROM records WHERE key=?")
      .get(key) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : null;
  }
  put(key: string, value: unknown): void {
    this.db
      .prepare(
        "INSERT INTO records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, JSON.stringify(value));
  }
  keys(prefix: string): string[] {
    return (
      this.db
        .prepare("SELECT key FROM records WHERE substr(key,1,?)=? ORDER BY key")
        .all(prefix.length, prefix) as { key: string }[]
    ).map((row) => row.key);
  }
  session(): TradingSession | null {
    return this.get<TradingSession>("session");
  }
  loadSession(
    account: string,
    date: string,
    mode: Mode,
  ): TradingSession | null {
    return this.get(`session:${date}:${account}:${mode}`);
  }
  saveSession(value: TradingSession): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.put("session", value);
      this.put(`session:history:${value.id}`, value);
      this.put(`session:${value.date}:${value.account}:${value.mode}`, value);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  saveBroker(value: SavedBroker | null): void {
    if (!value) {
      this.db.prepare("DELETE FROM records WHERE key=?").run("broker");
      return;
    }
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    this.put("broker", {
      iv: iv.toString("base64"),
      data: encrypted.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    });
  }
  broker(): SavedBroker | null {
    const saved = this.get<{ iv: string; data: string; tag: string }>("broker");
    if (!saved) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(saved.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(saved.tag, "base64"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(saved.data, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    ) as SavedBroker;
  }
  close(): void {
    this.db.close();
  }
  async persist(): Promise<void> { /* Local SQLite writes are synchronously durable already. */ }
}
