import type { ExperimentSession } from "../../../../types"
import {
  EXPERIMENT_SESSION_STORE,
  FALLBACK_EXPERIMENT_SESSIONS_KEY,
  INQUIRY_DATABASE_NAME,
  INQUIRY_DATABASE_VERSION,
  MIGRATION_LOG_STORE,
  migrateLegacyBlindBoxSession,
} from "../../../../shared/data/legacy-blind-box-migration"
import {
  isRecognizableBlindBoxSession,
  readLegacyBlindBoxSession,
} from "../../../../shared/data/legacy-blind-box-reader"

export const BLIND_BOX_LATEST_SESSION_KEY = "blind-box:latest-session"

interface CurrentBlindBoxSessionRecord {
  readonly schema_version: 1
  readonly record_type: "session"
  readonly topic_id: "blind-box"
  readonly session_id: string
  readonly saved_at: string
  readonly source_application: "math-inquiry-web-app"
  readonly session_core_data: ExperimentSession
}

interface ClearedBlindBoxSessionRecord {
  readonly schema_version: 1
  readonly record_type: "cleared"
  readonly topic_id: "blind-box"
  readonly cleared_at: string
}

type RepositoryState =
  | { readonly kind: "empty"; readonly changedAt: number }
  | {
      readonly kind: "session"
      readonly changedAt: number
      readonly session: ExperimentSession
    }
  | { readonly kind: "cleared"; readonly changedAt: number }

interface BackendReadResult {
  readonly available: boolean
  readonly state: RepositoryState
}

type RecordMap = Record<string, unknown>

const EMPTY_STATE: RepositoryState = {
  kind: "empty",
  changedAt: Number.NEGATIVE_INFINITY,
}

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

function parseTimestamp(value: unknown, fallback: string | undefined): number {
  const timestamp = typeof value === "string"
    ? Date.parse(value)
    : fallback === undefined
      ? Number.NaN
      : Date.parse(fallback)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function stateFromRecord(value: unknown): RepositoryState | null {
  if (!isRecordMap(value) || value.topic_id !== "blind-box") return null

  if (value.record_type === "cleared" && typeof value.cleared_at === "string") {
    return {
      kind: "cleared",
      changedAt: parseTimestamp(value.cleared_at, undefined),
    }
  }

  if (!isRecognizableBlindBoxSession(value.session_core_data)) return null
  return {
    kind: "session",
    changedAt: parseTimestamp(
      value.saved_at ?? value.migrated_at,
      value.session_core_data.startedAt,
    ),
    session: value.session_core_data,
  }
}

function selectNewestState(states: readonly RepositoryState[]): RepositoryState {
  return states.reduce<RepositoryState>((newest, candidate) =>
    candidate.changedAt > newest.changedAt ? candidate : newest,
  EMPTY_STATE)
}

function stateFromValues(
  latestValue: unknown,
  allValues: readonly unknown[],
): RepositoryState {
  const latest = stateFromRecord(latestValue)
  if (latest !== null) return latest
  return selectNewestState(
    allValues
      .map(stateFromRecord)
      .filter((state): state is RepositoryState => state !== null),
  )
}

function openInquiryDatabase(factory: IDBFactory): Promise<IDBDatabase> {
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
    request.onsuccess = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(EXPERIMENT_SESSION_STORE)) {
        database.close()
        reject(new Error("Inquiry session store is unavailable."))
        return
      }
      resolve(database)
    }
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open inquiry database."))
    request.onblocked = () => reject(new Error("Inquiry database is blocked."))
  })
}

function readIndexedDbState(database: IDBDatabase): Promise<RepositoryState> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EXPERIMENT_SESSION_STORE, "readonly")
    const store = transaction.objectStore(EXPERIMENT_SESSION_STORE)
    const latestRequest = store.get(BLIND_BOX_LATEST_SESSION_KEY)
    const allRequest = store.getAll()
    let latestValue: unknown
    let allValues: unknown[] = []
    let settled = false

    const fail = (error: DOMException | null, message: string) => {
      if (!settled) {
        settled = true
        reject(error ?? new Error(message))
      }
    }
    latestRequest.onsuccess = () => {
      latestValue = latestRequest.result
    }
    allRequest.onsuccess = () => {
      allValues = allRequest.result
    }
    latestRequest.onerror = () => fail(latestRequest.error, "Session read failed.")
    allRequest.onerror = () => fail(allRequest.error, "Session scan failed.")
    transaction.oncomplete = () => {
      if (!settled) {
        settled = true
        resolve(stateFromValues(latestValue, allValues))
      }
    }
    transaction.onerror = () => fail(transaction.error, "Session transaction failed.")
    transaction.onabort = () => fail(transaction.error, "Session transaction aborted.")
  })
}

async function readIndexedDbBackend(): Promise<BackendReadResult> {
  const factory = getIndexedDb()
  if (factory === null) return { available: false, state: EMPTY_STATE }
  try {
    const database = await openInquiryDatabase(factory)
    try {
      return { available: true, state: await readIndexedDbState(database) }
    } finally {
      database.close()
    }
  } catch {
    return { available: false, state: EMPTY_STATE }
  }
}

function readFallbackBackend(): BackendReadResult {
  const storage = getLocalStorage()
  if (storage === null) return { available: false, state: EMPTY_STATE }
  try {
    const records = parseRecordMap(
      storage.getItem(FALLBACK_EXPERIMENT_SESSIONS_KEY),
    )
    if (records === null) return { available: false, state: EMPTY_STATE }
    return {
      available: true,
      state: stateFromValues(
        records[BLIND_BOX_LATEST_SESSION_KEY],
        Object.values(records),
      ),
    }
  } catch {
    return { available: false, state: EMPTY_STATE }
  }
}

async function readNewNamespace(): Promise<BackendReadResult> {
  const [indexedDb, fallback] = await Promise.all([
    readIndexedDbBackend(),
    Promise.resolve(readFallbackBackend()),
  ])
  return {
    available: indexedDb.available || fallback.available,
    state: selectNewestState([indexedDb.state, fallback.state]),
  }
}

function currentRecord(
  session: ExperimentSession,
  savedAt: string,
): CurrentBlindBoxSessionRecord {
  return {
    schema_version: 1,
    record_type: "session",
    topic_id: "blind-box",
    session_id: session.id,
    saved_at: savedAt,
    source_application: INQUIRY_DATABASE_NAME,
    session_core_data: session,
  }
}

function sessionKey(sessionId: string): string {
  return `blind-box:${sessionId}`
}

function writeIndexedDbRecords(
  database: IDBDatabase,
  records: readonly (readonly [string, unknown])[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EXPERIMENT_SESSION_STORE, "readwrite")
    const store = transaction.objectStore(EXPERIMENT_SESSION_STORE)
    records.forEach(([key, value]) => store.put(value, key))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Session write failed."))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Session write aborted."))
  })
}

async function writeIndexedDbBackend(
  records: readonly (readonly [string, unknown])[],
): Promise<boolean> {
  const factory = getIndexedDb()
  if (factory === null) return false
  try {
    const database = await openInquiryDatabase(factory)
    try {
      await writeIndexedDbRecords(database, records)
      return true
    } finally {
      database.close()
    }
  } catch {
    return false
  }
}

function clearIndexedDbRecords(
  database: IDBDatabase,
  tombstone: ClearedBlindBoxSessionRecord,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EXPERIMENT_SESSION_STORE, "readwrite")
    const store = transaction.objectStore(EXPERIMENT_SESSION_STORE)
    const keysRequest = store.getAllKeys()
    keysRequest.onsuccess = () => {
      keysRequest.result.forEach((key) => {
        if (typeof key === "string" && key.startsWith("blind-box:")) {
          store.delete(key)
        }
      })
      store.put(tombstone, BLIND_BOX_LATEST_SESSION_KEY)
    }
    keysRequest.onerror = () => transaction.abort()
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Session clear failed."))
    transaction.onabort = () =>
      reject(transaction.error ?? keysRequest.error ?? new Error("Session clear aborted."))
  })
}

async function clearIndexedDbBackend(
  tombstone: ClearedBlindBoxSessionRecord,
): Promise<boolean> {
  const factory = getIndexedDb()
  if (factory === null) return false
  try {
    const database = await openInquiryDatabase(factory)
    try {
      await clearIndexedDbRecords(database, tombstone)
      return true
    } finally {
      database.close()
    }
  } catch {
    return false
  }
}

function writeFallbackBackend(
  recordsToWrite: readonly (readonly [string, unknown])[],
): boolean {
  const storage = getLocalStorage()
  if (storage === null) return false
  try {
    const records = parseRecordMap(
      storage.getItem(FALLBACK_EXPERIMENT_SESSIONS_KEY),
    )
    if (records === null) return false
    const next = { ...records }
    recordsToWrite.forEach(([key, value]) => {
      next[key] = value
    })
    storage.setItem(FALLBACK_EXPERIMENT_SESSIONS_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

function clearFallbackBackend(tombstone: ClearedBlindBoxSessionRecord): boolean {
  const storage = getLocalStorage()
  if (storage === null) return false
  try {
    const records = parseRecordMap(
      storage.getItem(FALLBACK_EXPERIMENT_SESSIONS_KEY),
    )
    if (records === null) return false
    const retained = Object.fromEntries(
      Object.entries(records).filter(([key]) => !key.startsWith("blind-box:")),
    )
    retained[BLIND_BOX_LATEST_SESSION_KEY] = tombstone
    storage.setItem(FALLBACK_EXPERIMENT_SESSIONS_KEY, JSON.stringify(retained))
    return true
  } catch {
    return false
  }
}

/**
 * Loads the current session from the new namespace. A legacy read is allowed
 * only to complete migration or when every new-namespace backend is unusable.
 */
export async function loadBlindBoxSession(): Promise<ExperimentSession | null> {
  let current = await readNewNamespace()
  if (current.state.kind === "session") return current.state.session
  if (current.state.kind === "cleared") return null

  const migration = await migrateLegacyBlindBoxSession()
  current = await readNewNamespace()
  if (current.state.kind === "session") return current.state.session
  if (current.state.kind === "cleared") return null

  if (!current.available || migration.status === "storage-unavailable") {
    return readLegacyBlindBoxSession()
  }
  return null
}

/** Writes only the new application namespace; legacy data remains immutable. */
export async function saveBlindBoxSession(
  session: ExperimentSession,
): Promise<void> {
  const savedAt = new Date().toISOString()
  const record = currentRecord(session, savedAt)
  const records = [
    [sessionKey(session.id), record],
    [BLIND_BOX_LATEST_SESSION_KEY, record],
  ] as const
  await Promise.all([
    writeIndexedDbBackend(records),
    Promise.resolve(writeFallbackBackend(records)),
  ])
}

/**
 * Marks only the new namespace as cleared. The legacy database and legacy
 * localStorage key are deliberately not opened for writing or deletion.
 */
export async function clearBlindBoxSession(): Promise<void> {
  const tombstone: ClearedBlindBoxSessionRecord = {
    schema_version: 1,
    record_type: "cleared",
    topic_id: "blind-box",
    cleared_at: new Date().toISOString(),
  }
  await Promise.all([
    clearIndexedDbBackend(tombstone),
    Promise.resolve(clearFallbackBackend(tombstone)),
  ])
}
