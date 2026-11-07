import type { ExperimentSession } from "../../types"
import { readLegacyBlindBoxSession } from "./legacy-blind-box-reader"

export const INQUIRY_DATABASE_NAME = "math-inquiry-web-app"
export const EXPERIMENT_SESSION_STORE = "experiment-sessions"
export const MIGRATION_LOG_STORE = "migration-log"
export const FALLBACK_EXPERIMENT_SESSIONS_KEY =
  "math-inquiry-web-app:fallback:experiment-sessions"
export const FALLBACK_MIGRATION_LOG_KEY =
  "math-inquiry-web-app:fallback:migration-log"

export const INQUIRY_DATABASE_VERSION = 1
const LEGACY_APPLICATION = "blind-box-math-lab"
const LEGACY_SCHEMA_VERSION = 1

export type MigrationBackend = "indexeddb" | "local-storage-fallback"

export type LegacyBlindBoxMigrationStatus =
  | "no-legacy-session"
  | "migrated"
  | "already-migrated"
  | "storage-unavailable"

export interface MigratedBlindBoxSessionRecord {
  readonly schema_version: 1
  readonly topic_id: "blind-box"
  readonly session_id: string
  readonly migrated_at: string
  readonly source_application: "blind-box-math-lab"
  readonly source_schema_version: 1
  readonly session_core_data: ExperimentSession
}

export interface LegacyBlindBoxMigrationLog {
  readonly migration_id: string
  readonly topic_id: "blind-box"
  readonly session_id: string
  readonly source_application: "blind-box-math-lab"
  readonly source_schema_version: 1
  readonly target_application: "math-inquiry-web-app"
  readonly migrated_at: string
}

export interface LegacyBlindBoxMigrationResult {
  readonly status: LegacyBlindBoxMigrationStatus
  readonly backend?: MigrationBackend
  readonly migrationId?: string
  readonly sessionId?: string
  readonly migratedAt?: string
}

export interface LegacyBlindBoxMigrationOptions {
  readonly now?: () => Date
}

type RecordMap = Record<string, unknown>

function getIndexedDb(): IDBFactory | null {
  try {
    return typeof indexedDB === "undefined" ? null : indexedDB
  } catch {
    return null
  }
}

function getLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

function migrationIdFor(session: ExperimentSession): string {
  return `legacy-blind-box:schema-${LEGACY_SCHEMA_VERSION}:session-${session.id}`
}

function sessionKeyFor(session: ExperimentSession): string {
  return `blind-box:${session.id}`
}

function makeRecords(
  session: ExperimentSession,
  migratedAt: string,
): {
  readonly sessionKey: string
  readonly migrationId: string
  readonly sessionRecord: MigratedBlindBoxSessionRecord
  readonly migrationLog: LegacyBlindBoxMigrationLog
} {
  const migrationId = migrationIdFor(session)
  return {
    sessionKey: sessionKeyFor(session),
    migrationId,
    sessionRecord: {
      schema_version: 1,
      topic_id: "blind-box",
      session_id: session.id,
      migrated_at: migratedAt,
      source_application: LEGACY_APPLICATION,
      source_schema_version: LEGACY_SCHEMA_VERSION,
      session_core_data: session,
    },
    migrationLog: {
      migration_id: migrationId,
      topic_id: "blind-box",
      session_id: session.id,
      source_application: LEGACY_APPLICATION,
      source_schema_version: LEGACY_SCHEMA_VERSION,
      target_application: INQUIRY_DATABASE_NAME,
      migrated_at: migratedAt,
    },
  }
}

function isRecordMap(value: unknown): value is RecordMap {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseRecordMap(serialized: string | null): RecordMap | null {
  if (serialized === null) return {}
  try {
    const parsed: unknown = JSON.parse(serialized)
    return isRecordMap(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isMigrationLog(value: unknown): value is LegacyBlindBoxMigrationLog {
  if (!isRecordMap(value)) return false
  return (
    typeof value.migration_id === "string" &&
    value.topic_id === "blind-box" &&
    typeof value.session_id === "string" &&
    value.source_schema_version === LEGACY_SCHEMA_VERSION &&
    typeof value.migrated_at === "string"
  )
}

function resultFromLog(
  status: "migrated" | "already-migrated",
  backend: MigrationBackend,
  log: LegacyBlindBoxMigrationLog,
): LegacyBlindBoxMigrationResult {
  return {
    status,
    backend,
    migrationId: log.migration_id,
    sessionId: log.session_id,
    migratedAt: log.migrated_at,
  }
}

function readFallbackExisting(
  storage: Storage,
  sessionKey: string,
  migrationId: string,
): LegacyBlindBoxMigrationLog | null {
  const sessions = parseRecordMap(storage.getItem(FALLBACK_EXPERIMENT_SESSIONS_KEY))
  const logs = parseRecordMap(storage.getItem(FALLBACK_MIGRATION_LOG_KEY))
  if (sessions === null || logs === null || !(sessionKey in sessions)) return null
  const log = logs[migrationId]
  return isMigrationLog(log) ? log : null
}

function writeFallback(
  storage: Storage,
  records: ReturnType<typeof makeRecords>,
): LegacyBlindBoxMigrationResult | null {
  const previousSessions = storage.getItem(FALLBACK_EXPERIMENT_SESSIONS_KEY)
  const previousLogs = storage.getItem(FALLBACK_MIGRATION_LOG_KEY)
  const sessions = parseRecordMap(previousSessions)
  const logs = parseRecordMap(previousLogs)
  if (sessions === null || logs === null) return null

  const existing = readFallbackExisting(
    storage,
    records.sessionKey,
    records.migrationId,
  )
  if (existing) {
    return resultFromLog("already-migrated", "local-storage-fallback", existing)
  }

  const nextSessions = {
    ...sessions,
    [records.sessionKey]: records.sessionRecord,
  }
  const nextLogs = {
    ...logs,
    [records.migrationId]: records.migrationLog,
  }

  try {
    storage.setItem(FALLBACK_EXPERIMENT_SESSIONS_KEY, JSON.stringify(nextSessions))
    storage.setItem(FALLBACK_MIGRATION_LOG_KEY, JSON.stringify(nextLogs))
    return resultFromLog(
      "migrated",
      "local-storage-fallback",
      records.migrationLog,
    )
  } catch {
    // Restore only the new namespace. The legacy keys are never written here.
    try {
      if (previousSessions === null) storage.removeItem(FALLBACK_EXPERIMENT_SESSIONS_KEY)
      else storage.setItem(FALLBACK_EXPERIMENT_SESSIONS_KEY, previousSessions)
      if (previousLogs === null) storage.removeItem(FALLBACK_MIGRATION_LOG_KEY)
      else storage.setItem(FALLBACK_MIGRATION_LOG_KEY, previousLogs)
    } catch {
      // A storage backend that rejects rollback is reported as unavailable.
    }
    return null
  }
}

function openTargetDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(INQUIRY_DATABASE_NAME, INQUIRY_DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(EXPERIMENT_SESSION_STORE)) {
        database.createObjectStore(EXPERIMENT_SESSION_STORE)
      }
      if (!database.objectStoreNames.contains(MIGRATION_LOG_STORE)) {
        database.createObjectStore(MIGRATION_LOG_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Unable to open migration database."))
    request.onblocked = () => reject(new Error("Migration database is blocked."))
  })
}

function readIndexedDbLog(
  database: IDBDatabase,
  migrationId: string,
): Promise<LegacyBlindBoxMigrationLog | null> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(MIGRATION_LOG_STORE, "readonly")
    const request = transaction.objectStore(MIGRATION_LOG_STORE).get(migrationId)
    request.onsuccess = () => resolve(isMigrationLog(request.result) ? request.result : null)
    request.onerror = () => reject(request.error ?? new Error("Unable to read migration log."))
    transaction.onerror = () => reject(transaction.error ?? new Error("Migration read failed."))
    transaction.onabort = () => reject(transaction.error ?? new Error("Migration read aborted."))
  })
}

function writeIndexedDbRecords(
  database: IDBDatabase,
  records: ReturnType<typeof makeRecords>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [EXPERIMENT_SESSION_STORE, MIGRATION_LOG_STORE],
      "readwrite",
    )
    transaction.objectStore(EXPERIMENT_SESSION_STORE).put(
      records.sessionRecord,
      records.sessionKey,
    )
    transaction.objectStore(MIGRATION_LOG_STORE).put(
      records.migrationLog,
      records.migrationId,
    )
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Migration write failed."))
    transaction.onabort = () => reject(transaction.error ?? new Error("Migration write aborted."))
  })
}

async function writeIndexedDb(
  factory: IDBFactory,
  records: ReturnType<typeof makeRecords>,
): Promise<LegacyBlindBoxMigrationResult> {
  const database = await openTargetDatabase(factory)
  try {
    const existing = await readIndexedDbLog(database, records.migrationId)
    if (existing) {
      return resultFromLog("already-migrated", "indexeddb", existing)
    }
    await writeIndexedDbRecords(database, records)
    return resultFromLog("migrated", "indexeddb", records.migrationLog)
  } finally {
    database.close()
  }
}

/**
 * Copies the latest recognizable legacy blind-box session into the new data
 * namespace. It never deletes or modifies any legacy IndexedDB/localStorage data.
 */
export async function migrateLegacyBlindBoxSession(
  options: LegacyBlindBoxMigrationOptions = {},
): Promise<LegacyBlindBoxMigrationResult> {
  const session = await readLegacyBlindBoxSession()
  if (session === null) return { status: "no-legacy-session" }

  const migratedAt = (options.now?.() ?? new Date()).toISOString()
  const records = makeRecords(session, migratedAt)
  const storage = getLocalStorage()

  if (storage) {
    try {
      const existing = readFallbackExisting(
        storage,
        records.sessionKey,
        records.migrationId,
      )
      if (existing) {
        return resultFromLog("already-migrated", "local-storage-fallback", existing)
      }
    } catch {
      // IndexedDB may still be available.
    }
  }

  const factory = getIndexedDb()
  if (factory) {
    try {
      return await writeIndexedDb(factory, records)
    } catch {
      // Preserve the legacy data and use only the independent fallback namespace.
    }
  }

  if (storage) {
    try {
      const result = writeFallback(storage, records)
      if (result) return result
    } catch {
      // Report an explicit unavailable result below.
    }
  }

  return {
    status: "storage-unavailable",
    migrationId: records.migrationId,
    sessionId: session.id,
  }
}
