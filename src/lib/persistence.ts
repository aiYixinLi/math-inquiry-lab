import type { ExperimentSession } from "../types"

const DATABASE_NAME = "blind-box-math-lab"
const DATABASE_VERSION = 1
const STORE_NAME = "sessions"
const LATEST_SESSION_KEY = "latest-session"
const LOCAL_STORAGE_KEY = "blind-box-math-lab:latest-session"

interface StoredSession {
  schemaVersion: 1
  savedAt: string
  session: ExperimentSession
}

interface StoredSessionCandidate {
  session: ExperimentSession
  savedAt: number
}

function makeStoredSession(session: ExperimentSession): StoredSession {
  return {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    session,
  }
}

function isExperimentSession(value: unknown): value is ExperimentSession {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const candidate = value as Partial<ExperimentSession>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.seed === "number" &&
    Array.isArray(candidate.rounds) &&
    typeof candidate.summary === "object" &&
    candidate.summary !== null
  )
}

function unpackStoredSession(value: unknown): StoredSessionCandidate | null {
  if (isExperimentSession(value)) {
    return {
      session: value,
      savedAt: Number.NEGATIVE_INFINITY,
    }
  }

  if (typeof value !== "object" || value === null) {
    return null
  }

  const stored = value as Partial<StoredSession>
  if (!isExperimentSession(stored.session)) {
    return null
  }

  const savedAt =
    typeof stored.savedAt === "string" ? Date.parse(stored.savedAt) : Number.NaN

  return {
    session: stored.session,
    savedAt: Number.isFinite(savedAt) ? savedAt : Number.NEGATIVE_INFINITY,
  }
}

function newestCandidate(
  indexedDbCandidate: StoredSessionCandidate | null,
  localStorageCandidate: StoredSessionCandidate | null,
): StoredSessionCandidate | null {
  if (indexedDbCandidate === null) return localStorageCandidate
  if (localStorageCandidate === null) return indexedDbCandidate

  return localStorageCandidate.savedAt > indexedDbCandidate.savedAt
    ? localStorageCandidate
    : indexedDbCandidate
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

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("无法打开本地实验数据库。"))
    request.onblocked = () => reject(new Error("本地实验数据库被其他页面占用。"))
  })
}

async function runRequest<T>(
  factory: IDBFactory,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase(factory)

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const request = action(transaction.objectStore(STORE_NAME))
      let result: T
      let settled = false

      const fail = (error: DOMException | null, fallbackMessage: string) => {
        if (!settled) {
          settled = true
          reject(error ?? new Error(fallbackMessage))
        }
      }

      request.onsuccess = () => {
        result = request.result
      }
      request.onerror = () => fail(request.error, "本地实验数据读写失败。")
      transaction.oncomplete = () => {
        if (!settled) {
          settled = true
          resolve(result)
        }
      }
      transaction.onerror = () => fail(transaction.error, "本地实验数据事务失败。")
      transaction.onabort = () => fail(transaction.error, "本地实验数据事务已取消。")
    })
  } finally {
    database.close()
  }
}

function saveToLocalStorage(stored: StoredSession): void {
  const storage = getLocalStorage()
  if (storage === null) {
    return
  }

  try {
    storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Storage can be unavailable in private mode or when its quota is full.
  }
}

function loadFromLocalStorage(): StoredSessionCandidate | null {
  const storage = getLocalStorage()
  if (storage === null) {
    return null
  }

  try {
    const serialized = storage.getItem(LOCAL_STORAGE_KEY)
    return serialized === null ? null : unpackStoredSession(JSON.parse(serialized))
  } catch {
    return null
  }
}

function clearLocalStorage(): void {
  const storage = getLocalStorage()
  if (storage === null) {
    return
  }

  try {
    storage.removeItem(LOCAL_STORAGE_KEY)
  } catch {
    // Clearing IndexedDB is still useful even when localStorage is unavailable.
  }
}

/** Saves the latest experiment, preferring IndexedDB and falling back to localStorage. */
export async function saveSession(session: ExperimentSession): Promise<void> {
  const stored = makeStoredSession(session)
  const factory = getIndexedDb()

  if (factory !== null) {
    try {
      await runRequest(factory, "readwrite", (store) => store.put(stored, LATEST_SESSION_KEY))
      clearLocalStorage()
      return
    } catch {
      // Fall through to the smaller but widely supported localStorage backup.
    }
  }

  saveToLocalStorage(stored)
}

/** Loads the most recently saved experiment, or null when no valid save exists. */
export async function loadSession(): Promise<ExperimentSession | null> {
  const factory = getIndexedDb()
  const indexedDbCandidatePromise: Promise<StoredSessionCandidate | null> =
    factory === null
      ? Promise.resolve(null)
      : runRequest<unknown>(factory, "readonly", (store) =>
          store.get(LATEST_SESSION_KEY),
        )
          .then(unpackStoredSession)
          .catch(() => null)
  const localStorageCandidate = loadFromLocalStorage()
  const indexedDbCandidate = await indexedDbCandidatePromise
  const newest = newestCandidate(indexedDbCandidate, localStorageCandidate)

  return newest?.session ?? null
}

/** Removes the saved experiment from both storage backends. */
export async function clearSession(): Promise<void> {
  const factory = getIndexedDb()

  if (factory !== null) {
    try {
      await runRequest(factory, "readwrite", (store) => store.delete(LATEST_SESSION_KEY))
    } catch {
      // Always continue so a fallback copy cannot survive a clear operation.
    }
  }

  clearLocalStorage()
}
