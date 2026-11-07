import type { ExperimentSession } from "../../types"

export const LEGACY_BLIND_BOX_DATABASE_NAME = "blind-box-math-lab"
export const LEGACY_BLIND_BOX_STORE_NAME = "sessions"
export const LEGACY_BLIND_BOX_LATEST_KEY = "latest-session"
export const LEGACY_BLIND_BOX_LOCAL_STORAGE_KEY =
  "blind-box-math-lab:latest-session"

interface LegacyStoredSession {
  readonly schemaVersion: 1
  readonly savedAt: string
  readonly session: ExperimentSession
}

interface LegacySessionCandidate {
  readonly session: ExperimentSession
  readonly savedAt: number
}

type FactoryWithDatabaseList = IDBFactory & {
  databases?: () => Promise<IDBDatabaseInfo[]>
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

export function isRecognizableBlindBoxSession(
  value: unknown,
): value is ExperimentSession {
  if (typeof value !== "object" || value === null) return false

  const candidate = value as Partial<ExperimentSession>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.seed === "number" &&
    Array.isArray(candidate.rounds) &&
    typeof candidate.summary === "object" &&
    candidate.summary !== null
  )
}

function unpackLegacySession(value: unknown): LegacySessionCandidate | null {
  if (isRecognizableBlindBoxSession(value)) {
    return { session: value, savedAt: Number.NEGATIVE_INFINITY }
  }
  if (typeof value !== "object" || value === null) return null

  const stored = value as Partial<LegacyStoredSession>
  if (!isRecognizableBlindBoxSession(stored.session)) return null
  const timestamp = typeof stored.savedAt === "string"
    ? Date.parse(stored.savedAt)
    : Number.NaN

  return {
    session: stored.session,
    savedAt: Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY,
  }
}

function newestCandidate(
  indexedDbCandidate: LegacySessionCandidate | null,
  localStorageCandidate: LegacySessionCandidate | null,
): LegacySessionCandidate | null {
  if (indexedDbCandidate === null) return localStorageCandidate
  if (localStorageCandidate === null) return indexedDbCandidate
  return localStorageCandidate.savedAt > indexedDbCandidate.savedAt
    ? localStorageCandidate
    : indexedDbCandidate
}

function readLocalStorageCandidate(): LegacySessionCandidate | null {
  const storage = getLocalStorage()
  if (storage === null) return null
  try {
    const serialized = storage.getItem(LEGACY_BLIND_BOX_LOCAL_STORAGE_KEY)
    return serialized === null
      ? null
      : unpackLegacySession(JSON.parse(serialized) as unknown)
  } catch {
    return null
  }
}

async function databaseIsListed(factory: IDBFactory): Promise<boolean | null> {
  const listDatabases = (factory as FactoryWithDatabaseList).databases
  if (typeof listDatabases !== "function") return null
  try {
    const databases = await listDatabases.call(factory)
    return databases.some(({ name }) => name === LEGACY_BLIND_BOX_DATABASE_NAME)
  } catch {
    return null
  }
}

/**
 * Opens only an already-existing legacy database. When database enumeration is
 * unavailable, aborting the version-0 upgrade transaction prevents `open()`
 * from committing a newly-created database.
 */
function openExistingLegacyDatabase(
  factory: IDBFactory,
): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    const request = factory.open(LEGACY_BLIND_BOX_DATABASE_NAME)
    let missingDatabase = false
    let settled = false

    const resolveOnce = (database: IDBDatabase | null) => {
      if (settled) database?.close()
      else {
        settled = true
        resolve(database)
      }
    }
    const rejectOnce = (error: unknown) => {
      if (!settled) {
        settled = true
        reject(error)
      }
    }

    request.onupgradeneeded = (event) => {
      if (event.oldVersion !== 0) return
      missingDatabase = true
      const transaction = request.transaction
      if (transaction === null) {
        throw new Error("Legacy database creation could not be cancelled.")
      }
      transaction.abort()
    }
    request.onsuccess = () => {
      if (missingDatabase) resolveOnce(null)
      else resolveOnce(request.result)
    }
    request.onerror = (event) => {
      event.preventDefault()
      if (missingDatabase) resolveOnce(null)
      else rejectOnce(request.error ?? new Error("Unable to open legacy database."))
    }
    request.onblocked = () =>
      rejectOnce(new Error("Legacy database is blocked by another page."))
  })
}

function readIndexedDbCandidate(
  database: IDBDatabase,
): Promise<LegacySessionCandidate | null> {
  if (!database.objectStoreNames.contains(LEGACY_BLIND_BOX_STORE_NAME)) {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      LEGACY_BLIND_BOX_STORE_NAME,
      "readonly",
    )
    const request = transaction
      .objectStore(LEGACY_BLIND_BOX_STORE_NAME)
      .get(LEGACY_BLIND_BOX_LATEST_KEY)
    let value: unknown
    let settled = false

    const fail = (error: DOMException | null, message: string) => {
      if (!settled) {
        settled = true
        reject(error ?? new Error(message))
      }
    }
    request.onsuccess = () => {
      value = request.result
    }
    request.onerror = () => fail(request.error, "Unable to read legacy session.")
    transaction.oncomplete = () => {
      if (!settled) {
        settled = true
        resolve(unpackLegacySession(value))
      }
    }
    transaction.onerror = () => fail(transaction.error, "Legacy read failed.")
    transaction.onabort = () => fail(transaction.error, "Legacy read was aborted.")
  })
}

async function readLegacyIndexedDb(
  factory: IDBFactory,
): Promise<LegacySessionCandidate | null> {
  const listed = await databaseIsListed(factory)
  if (listed === false) return null

  const database = await openExistingLegacyDatabase(factory)
  if (database === null) return null
  try {
    return await readIndexedDbCandidate(database)
  } finally {
    database.close()
  }
}

/**
 * Reads the newest recognizable legacy session without ever creating,
 * upgrading, deleting, or writing the legacy database or localStorage key.
 */
export async function readLegacyBlindBoxSession(): Promise<ExperimentSession | null> {
  const localStorageCandidate = readLocalStorageCandidate()
  const factory = getIndexedDb()
  const indexedDbCandidate = factory === null
    ? null
    : await readLegacyIndexedDb(factory).catch(() => null)

  return newestCandidate(indexedDbCandidate, localStorageCandidate)?.session ?? null
}
