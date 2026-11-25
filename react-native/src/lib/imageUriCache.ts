/** Persists last-known remote image URIs so avatars can show instantly / stale-while-revalidate. */

export const IMAGE_URI_CACHE_STORAGE_KEY = 'gym-rats-image-uri-cache'

type UriMap = Record<string, string>

let memory: UriMap | null = null

/** Cache key from storage path `{ownerId}/{fileId}.jpg` — invalidates when the file id changes. */
export function imageOwnerCacheKey(bucket: string, path: string): string | null {
  const owner = path.split('/')[0]?.trim()
  if (!owner) return null
  return `${bucket}:${owner}`
}

export function parseImageUriCache(raw: string | null | undefined): UriMap {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: UriMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value.length > 0) out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

function loadAll(): UriMap {
  if (memory) return memory
  try {
    memory = parseImageUriCache(localStorage.getItem(IMAGE_URI_CACHE_STORAGE_KEY))
  } catch {
    memory = {}
  }
  return memory
}

function persist(all: UriMap): void {
  memory = all
  try {
    localStorage.setItem(IMAGE_URI_CACHE_STORAGE_KEY, JSON.stringify(all))
  } catch {
    // Quota / private mode — keep in-memory map for this session.
  }
}

/** Reset in-memory layer (tests). */
export function resetImageUriCacheMemory(): void {
  memory = null
}

export function peekCachedImageUri(cacheKey: string): string | null {
  return loadAll()[cacheKey] ?? null
}

export function rememberCachedImageUri(cacheKey: string, uri: string): void {
  const all = loadAll()
  if (all[cacheKey] === uri) return
  persist({ ...all, [cacheKey]: uri })
}

export function forgetCachedImageUri(cacheKey: string): void {
  const all = loadAll()
  if (!(cacheKey in all)) return
  const next = { ...all }
  delete next[cacheKey]
  persist(next)
}
