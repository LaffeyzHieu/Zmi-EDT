// Zmi EDT — IndexedDB storage for session persistence.
//
// Provides two stores:
//   `blobs` — image Blobs keyed by stable window/asset id. Required because
//             URL.createObjectURL URLs do not survive a reload.
//   `state` — arbitrary JSON state snapshots keyed by name (e.g. 'editor').
//
// NOT YET WIRED into `useEditorStore`. Wiring plan (follow-up):
//   - On `addImages`: saveBlob(windowId, file)
//   - On `closeWindow`: deleteBlob(windowId)
//   - On `addAsset` / `removeAsset`: same, keyed by asset id
//   - On every mutating action: debounced saveState('editor', serializableSlice(get()))
//   - On mount (EditorShell useEffect): loadState('editor') + loadBlob per window
//     → URL.createObjectURL(blob) → set window.imageUrl, then set(windows)
//   - Keep the existing URL.revokeObjectURL calls — they only affect the live URL,
//     not the stored Blob.

const DB_NAME = 'zmi-edt'
const DB_VERSION = 1
const BLOB_STORE = 'blobs'
const STATE_STORE = 'state'

let ready: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available in this environment'))
  }
  if (ready) return ready
  ready = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(BLOB_STORE)) db.createObjectStore(BLOB_STORE)
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return ready
}

function run<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const req = fn(tx.objectStore(storeName))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export function saveBlob(id: string, blob: Blob): Promise<IDBValidKey> {
  return run(BLOB_STORE, 'readwrite', (s) => s.put(blob, id))
}

export function loadBlob(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>(BLOB_STORE, 'readonly', (s) => s.get(id))
}

export function deleteBlob(id: string): Promise<undefined> {
  return run<undefined>(BLOB_STORE, 'readwrite', (s) => s.delete(id))
}

export function listBlobIds(): Promise<string[]> {
  return run<string[]>(BLOB_STORE, 'readonly', (s) => s.getAllKeys() as IDBRequest<string[]>)
}

export function saveState<T>(key: string, value: T): Promise<IDBValidKey> {
  return run(STATE_STORE, 'readwrite', (s) => s.put(value, key))
}

export function loadState<T>(key: string): Promise<T | undefined> {
  return run<T | undefined>(STATE_STORE, 'readonly', (s) => s.get(key))
}

export function clearState(key: string): Promise<undefined> {
  return run<undefined>(STATE_STORE, 'readwrite', (s) => s.delete(key))
}
