import { ref, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { JournalDavClient, type JournalCollection, type JournalEntry } from '@/services/journal'
import { useAuth } from './useAuth'

function sortTime(entry: JournalEntry): number {
  return (entry.due ?? entry.date ?? entry.lastModified ?? entry.created)?.getTime() ?? 0
}

function sortEntries(items: JournalEntry[]): JournalEntry[] {
  return [...items].sort((a, b) => sortTime(b) - sortTime(a))
}

export function useJournal() {
  const { userId, userPathId, serverUrl, accessToken, getAppToken, clearAppToken } = useAuth()
  const loading = ref(false)
  const error = ref<string | null>(null)
  const collections = ref<JournalCollection[]>([])
  const entries = ref<JournalEntry[]>([])
  const activeCollectionHref = ref<string | null>(null)

  let client: JournalDavClient | null = null
  let lastLoadedUserId = ''

  async function getClient(): Promise<JournalDavClient> {
    if (client && lastLoadedUserId === userId.value) return client
    if (lastLoadedUserId && lastLoadedUserId !== userId.value) clearAppToken()
    const token = await getAppToken()
    client = new JournalDavClient(serverUrl.value, userPathId.value, userId.value, token)
    lastLoadedUserId = userId.value
    return client
  }

  async function refreshClient(): Promise<JournalDavClient> {
    clearAppToken()
    client = null
    lastLoadedUserId = ''
    return getClient()
  }

  function is401(e: unknown): boolean {
    return e instanceof Error && e.message.includes('401')
  }

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      let c = await getClient()
      try {
        collections.value = await c.listCollections()
      } catch (e: unknown) {
        if (!is401(e)) throw e
        c = await refreshClient()
        collections.value = await c.listCollections()
      }
      const all: JournalEntry[] = []
      for (const collection of collections.value) {
        try {
          all.push(...await c.fetchEntries(collection))
        } catch (e: unknown) {
          // A collection can reject one or both component REPORTs. Keep the other collections usable.
          if (!(e instanceof Error && (e.message.includes('403') || e.message.includes('400') || e.message.includes('415')))) throw e
        }
      }
      entries.value = sortEntries(all)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function createEntry(data: Omit<JournalEntry, 'uid' | 'resourceHref' | 'etag'>, collectionHref?: string): Promise<JournalEntry> {
    const c = await getClient()
    const href = collectionHref ?? activeCollectionHref.value ?? collections.value[0]?.href
    if (!href) throw new Error('No CalDAV collection available')
    const uid = uuidv4()
    const entry: JournalEntry = { ...data, uid, collectionHref: href, resourceHref: c.newEntryHref(href, uid) }
    const etag = await c.createEntry(entry)
    const saved = { ...entry, etag }
    entries.value = sortEntries([saved, ...entries.value])
    return saved
  }

  async function updateEntry(entry: JournalEntry): Promise<JournalEntry> {
    const c = await getClient()
    const etag = await c.updateEntry(entry)
    const saved = { ...entry, etag: etag ?? entry.etag }
    entries.value = sortEntries(entries.value.map(e => e.resourceHref === entry.resourceHref ? saved : e))
    return saved
  }

  async function deleteEntry(entry: JournalEntry): Promise<void> {
    const c = await getClient()
    await c.deleteEntry(entry)
    entries.value = entries.value.filter(e => e.resourceHref !== entry.resourceHref)
  }

  async function createCollection(name: string): Promise<JournalCollection> {
    const c = await getClient()
    const created = await c.createCollection(name)
    collections.value = [...collections.value, created]
    activeCollectionHref.value = created.href
    return created
  }

  watch([userId, accessToken], async ([newUser], [oldUser]) => {
    if (!newUser || !accessToken.value) return
    if (newUser !== oldUser) {
      client = null
      collections.value = []
      entries.value = []
      activeCollectionHref.value = null
    }
    await load()
  }, { immediate: true })

  return { loading, error, collections, entries, activeCollectionHref, load, createEntry, updateEntry, deleteEntry, createCollection }
}
