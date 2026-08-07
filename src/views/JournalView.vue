<template>
  <div class="journal-app">
    <aside class="sidebar">
      <div class="brand-row">
        <div>
          <div class="eyebrow">OpenCloud</div>
          <h1>{{ t('Journal') }}</h1>
        </div>
        <button class="icon-button" :class="{ spinning: loading }" :title="t('Refresh')" @click="load">↻</button>
      </div>

      <button class="primary new-button" :disabled="!collections.length" @click="showTypePicker = true">＋ {{ t('New entry') }}</button>

      <div class="section-title">
        <span>{{ t('Collections') }}</span>
        <button class="tiny-button" :title="t('New collection')" @click="createCollectionPrompt">＋</button>
      </div>

      <div
        v-for="collection in sortedCollections"
        :key="collection.href"
        class="collection-group"
        :class="{
          dragging: draggedCollectionHref === collection.href,
          'drag-over': dragOverCollectionHref === collection.href && draggedCollectionHref !== collection.href,
        }"
        draggable="true"
        :title="t('Drag to reorder')"
        @dragstart="startCollectionDrag($event, collection.href)"
        @dragenter.prevent="moveDraggedCollection(collection.href)"
        @dragover.prevent="dragOverCollectionHref = collection.href"
        @drop.prevent="finishCollectionDrag"
        @dragend="finishCollectionDrag"
      >
        <button
          class="collection-row"
          :class="{ active: activeCollectionHref === collection.href }"
          @click="toggleCollection(collection.href)"
        >
          <span class="drag-handle" aria-hidden="true">⠿</span>
          <span class="collection-dot" :style="{ backgroundColor: collection.color || 'currentColor' }" />
          <span class="collection-name">{{ collection.displayName }}</span>
          <span class="count">{{ countFor(collection.href) }}</span>
        </button>

        <nav v-if="activeCollectionHref === collection.href" class="collection-type-tabs" :aria-label="t('Entry type')">
          <button
            v-for="tab in typeTabs"
            :key="tab.value"
            :class="{ active: typeFilter === tab.value }"
            @click.stop="typeFilter = tab.value"
          >
            <span>{{ tab.icon }}</span>
            <span>{{ t(tab.label) }}</span>
            <small>{{ countTypeForCollection(collection.href, tab.value) }}</small>
          </button>
        </nav>
      </div>

      <div class="section-title"><span>{{ t('Filter') }}</span></div>
      <input v-model="query" class="search" type="search" :placeholder="t('Search entries…')" />

      <p v-if="error" class="error">{{ error }}</p>
      <div class="sidebar-footer">VJOURNAL · VTODO · CalDAV</div>
    </aside>

    <main class="content">
      <section class="list-pane">
        <header class="pane-header">
          <div>
            <div class="eyebrow">{{ sortedFilteredEntries.length }} {{ t('entries') }}</div>
            <h2>{{ currentCollectionName }}</h2>
          </div>
          <label class="sort-control">
            <span class="sr-only">{{ t('Sort entries') }}</span>
            <select v-model="sortMode" :title="t('Sort entries')">
              <option value="title-asc">{{ t('Sort A–Z') }}</option>
              <option value="title-desc">{{ t('Sort Z–A') }}</option>
              <option value="created-asc">{{ t('Created oldest first') }}</option>
              <option value="created-desc">{{ t('Created newest first') }}</option>
            </select>
          </label>
        </header>

        <div v-if="loading && !entries.length" class="empty-state"><div class="spinner" />{{ t('Loading…') }}</div>
        <div v-else-if="!sortedFilteredEntries.length" class="empty-state">
          <div class="empty-icon">✎</div>
          <strong>{{ t('No entries') }}</strong>
          <span>{{ t('Create a journal, note or task.') }}</span>
        </div>

        <article
          v-for="entry in sortedFilteredEntries"
          :key="entry.resourceHref"
          class="entry-card"
          :class="{ selected: selected?.resourceHref === entry.resourceHref, pinned: isPinned(entry) }"
          role="button"
          tabindex="0"
          @click="selectEntry(entry)"
          @keydown.enter.prevent="selectEntry(entry)"
          @keydown.space.prevent="selectEntry(entry)"
        >
          <div class="entry-topline">
            <span class="type-badge">{{ typeIcon(entry.type) }} {{ t(typeLabel(entry.type)) }}</span>
            <div class="entry-meta">
              <button
                type="button"
                class="pin-button"
                :class="{ active: isPinned(entry) }"
                :title="isPinned(entry) ? t('Unpin entry') : t('Pin entry')"
                :aria-label="isPinned(entry) ? t('Unpin entry') : t('Pin entry')"
                @click.stop="togglePin(entry)"
              >📌</button>
              <span class="entry-date">{{ displayDate(entry) }}</span>
            </div>
          </div>
          <h3>{{ entry.title || t('(untitled)') }}</h3>
          <p>{{ preview(entry.description) }}</p>
          <div v-if="entry.type === 'task'" class="task-progress">
            <span>{{ t(taskStatusLabel(entry.status)) }}</span><span>{{ entry.percentComplete ?? 0 }}%</span>
          </div>
          <div v-if="entry.categories.length" class="tags">
            <span v-for="tag in entry.categories.slice(0, 4)" :key="tag">{{ tag }}</span>
          </div>
        </article>
      </section>

      <section class="editor-pane">
        <div v-if="!draft" class="editor-placeholder">
          <div class="empty-icon">☷</div>
          <h2>{{ t('Select an entry') }}</h2>
          <p>{{ t('Choose an entry on the left or create a new one.') }}</p>
        </div>

        <form v-else class="editor" @submit.prevent="save">
          <header class="editor-header">
            <div>
              <div class="eyebrow">{{ isNew ? t('New') : t('Edit') }} · {{ typeIcon(draft.type) }} {{ t(typeLabel(draft.type)) }}</div>
              <h2>{{ draft.title || t('(untitled)') }}</h2>
            </div>
            <div class="actions">
              <button v-if="!isNew" type="button" class="danger" @click="remove">{{ t('Delete') }}</button>
              <button type="button" class="secondary" @click="cancelEdit">{{ t('Cancel') }}</button>
              <button class="primary" :disabled="saving">{{ saving ? t('Saving…') : t('Save') }}</button>
            </div>
          </header>

          <div v-if="saveError" class="save-error">{{ saveError }}</div>

          <label>
            <span>{{ t('Title') }}</span>
            <input v-model="draft.title" maxlength="240" :placeholder="titlePlaceholder" autofocus />
          </label>

          <div class="field-grid">
            <label v-if="draft.type === 'journal'">
              <span>{{ t('Date') }}</span>
              <input v-model="draftDate" type="date" required />
            </label>
            <label v-if="draft.type === 'task'">
              <span>{{ t('Start date') }} <small>({{ t('optional') }})</small></span>
              <input v-model="draftDate" type="date" />
            </label>
            <label v-if="draft.type === 'task'">
              <span>{{ t('Due date') }} <small>({{ t('optional') }})</small></span>
              <input v-model="draftDue" type="date" />
            </label>
            <label>
              <span>{{ t('Collection') }}</span>
              <select v-model="draft.collectionHref" :disabled="!isNew">
                <option v-for="collection in compatibleCollections" :key="collection.href" :value="collection.href">{{ collection.displayName }}</option>
              </select>
            </label>
          </div>

          <div v-if="draft.type === 'task'" class="field-grid task-fields">
            <label>
              <span>{{ t('Status') }}</span>
              <select v-model="draft.status">
                <option value="NEEDS-ACTION">{{ t('Open') }}</option>
                <option value="IN-PROCESS">{{ t('In progress') }}</option>
                <option value="COMPLETED">{{ t('Completed') }}</option>
                <option value="CANCELLED">{{ t('Cancelled') }}</option>
              </select>
            </label>
            <label>
              <span>{{ t('Progress') }} (%)</span>
              <input v-model.number="draft.percentComplete" type="number" min="0" max="100" step="1" />
            </label>
            <label>
              <span>{{ t('Priority') }} (0–9)</span>
              <input v-model.number="draft.priority" type="number" min="0" max="9" step="1" />
            </label>
          </div>

          <label>
            <span>{{ t('Categories') }}</span>
            <input v-model="categoryText" :placeholder="t('Comma-separated, e.g. Work, Ideas')" />
          </label>

          <label class="description-field">
            <span>{{ t('Description') }}</span>
            <textarea v-model="draft.description" :placeholder="descriptionPlaceholder" />
          </label>

          <footer v-if="!isNew" class="metadata">
            <span>UID: {{ draft.uid }}</span>
            <span v-if="draft.etag">ETag: {{ draft.etag }}</span>
            <span>{{ draft.type === 'task' ? 'VTODO' : 'VJOURNAL' }}</span>
          </footer>
        </form>
      </section>
    </main>

    <div v-if="showTypePicker" class="modal-backdrop" @click.self="showTypePicker = false">
      <section class="type-picker" role="dialog" aria-modal="true" :aria-label="t('Create new entry')">
        <header>
          <div>
            <div class="eyebrow">OpenCloud</div>
            <h2>{{ t('Create new entry') }}</h2>
          </div>
          <button class="icon-button" :aria-label="t('Close')" @click="showTypePicker = false">✕</button>
        </header>
        <button class="type-choice" @click="newEntry('journal')">
          <span class="choice-icon">📔</span><span><strong>{{ t('Journal entry') }}</strong><small>{{ t('Dated VJOURNAL – appears under Journal in jtxBoard') }}</small></span><span>›</span>
        </button>
        <button class="type-choice" @click="newEntry('note')">
          <span class="choice-icon">📝</span><span><strong>{{ t('Note') }}</strong><small>{{ t('VJOURNAL without date – appears under Notes in jtxBoard') }}</small></span><span>›</span>
        </button>
        <button class="type-choice" @click="newEntry('task')">
          <span class="choice-icon">☑</span><span><strong>{{ t('Task') }}</strong><small>{{ t('VTODO – appears under Tasks in jtxBoard') }}</small></span><span>›</span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useJournal } from '@/composables/useJournal'
import { useI18n } from '@/composables/useI18n'
import type { EntryType, JournalCollection, JournalEntry } from '@/services/journal'

const { t, localeTag } = useI18n()
const { loading, error, collections, entries, activeCollectionHref, load, createEntry, updateEntry, deleteEntry, createCollection } = useJournal()

type TypeFilter = 'all' | EntryType
const query = ref('')
const typeFilter = ref<TypeFilter>('all')
const showTypePicker = ref(false)
const selected = ref<JournalEntry | null>(null)
const draft = ref<JournalEntry | null>(null)
const isNew = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)

type SortMode = 'title-asc' | 'title-desc' | 'created-asc' | 'created-desc'
const SORT_MODE_STORAGE_KEY = 'opencloud-journal.entry-sort.v1'
const PINNED_ENTRIES_STORAGE_KEY = 'opencloud-journal.pinned-entries.v1'
const sortMode = ref<SortMode>(loadSortMode())
const pinnedEntryKeys = ref<string[]>(loadPinnedEntries())

const COLLECTION_ORDER_STORAGE_KEY = 'opencloud-journal.collection-order.v1'
const collectionOrder = ref<string[]>(loadCollectionOrder())
const draggedCollectionHref = ref<string | null>(null)
const dragOverCollectionHref = ref<string | null>(null)

const sortedCollections = computed(() => {
  const order = new Map(collectionOrder.value.map((href, index) => [href, index]))
  return [...collections.value].sort((a, b) => {
    const ai = order.get(a.href)
    const bi = order.get(b.href)
    if (ai == null && bi == null) return 0
    if (ai == null) return 1
    if (bi == null) return -1
    return ai - bi
  })
})

const typeTabs: { value: TypeFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '☷' },
  { value: 'journal', label: 'Journals', icon: '📔' },
  { value: 'note', label: 'Notes', icon: '📝' },
  { value: 'task', label: 'Tasks', icon: '☑' },
]

const currentCollectionName = computed(() => {
  return collections.value.find(c => c.href === activeCollectionHref.value)?.displayName || t('All collections')
})

const filteredEntries = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase()
  return entries.value.filter(entry => {
    if (activeCollectionHref.value && entry.collectionHref !== activeCollectionHref.value) return false
    if (typeFilter.value !== 'all' && entry.type !== typeFilter.value) return false
    if (!needle) return true
    return `${entry.title}\n${entry.description}\n${entry.categories.join(' ')}`.toLocaleLowerCase().includes(needle)
  })
})

const sortedFilteredEntries = computed(() => {
  const mode = sortMode.value
  return [...filteredEntries.value].sort((a, b) => {
    const pinDiff = Number(isPinned(b)) - Number(isPinned(a))
    if (pinDiff) return pinDiff

    if (mode === 'title-asc' || mode === 'title-desc') {
      const titleA = (a.title || t('(untitled)')).trim()
      const titleB = (b.title || t('(untitled)')).trim()
      const result = titleA.localeCompare(titleB, localeTag(), { sensitivity: 'base', numeric: true })
      return mode === 'title-asc' ? result : -result
    }

    const aTime = entryCreatedTime(a)
    const bTime = entryCreatedTime(b)
    const result = aTime - bTime
    if (result !== 0) return mode === 'created-asc' ? result : -result
    return (a.title || '').localeCompare(b.title || '', localeTag(), { sensitivity: 'base', numeric: true })
  })
})

const compatibleCollections = computed(() => draft.value ? collections.value.filter(c => collectionSupports(c, draft.value!.type)) : collections.value)

const draftDate = computed({
  get: () => draft.value?.date ? toInputDate(draft.value.date) : '',
  set: value => { if (draft.value) draft.value.date = value ? fromInputDate(value) : undefined },
})

const draftDue = computed({
  get: () => draft.value?.due ? toInputDate(draft.value.due) : '',
  set: value => { if (draft.value) draft.value.due = value ? fromInputDate(value) : undefined },
})

const categoryText = computed({
  get: () => draft.value?.categories.join(', ') ?? '',
  set: value => { if (draft.value) draft.value.categories = value.split(',').map(v => v.trim()).filter(Boolean) },
})

const titlePlaceholder = computed(() => draft.value?.type === 'task' ? t('Task title') : draft.value?.type === 'note' ? t('Note title') : t('Journal title'))
const descriptionPlaceholder = computed(() => draft.value?.type === 'task' ? t('Describe the task…') : draft.value?.type === 'note' ? t('Write your note…') : t('Write your journal entry…'))

watch(collections, currentCollections => {
  // During startup the collections ref is briefly empty while CalDAV discovery
  // is still running. Do not treat that transient state as an authoritative
  // empty collection list, otherwise we would erase the persisted drag & drop
  // order before the server collections arrive.
  if (currentCollections.length === 0) return

  const available = new Set(currentCollections.map(collection => collection.href))
  const nextOrder = collectionOrder.value.filter(href => available.has(href))
  for (const collection of currentCollections) {
    if (!nextOrder.includes(collection.href)) nextOrder.push(collection.href)
  }
  if (nextOrder.join('\n') !== collectionOrder.value.join('\n')) {
    collectionOrder.value = nextOrder
    saveCollectionOrder(nextOrder)
  }
}, { immediate: true })

watch(sortMode, value => {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(SORT_MODE_STORAGE_KEY, value) } catch { /* localStorage can be unavailable */ }
})

watch(activeCollectionHref, () => {
  if (!showAllCollections.value && selected.value && selected.value.collectionHref !== activeCollectionHref.value) cancelEdit()
})

function entryStorageKey(entry: JournalEntry): string {
  return `${entry.collectionHref}::${entry.uid || entry.resourceHref}`
}

function isPinned(entry: JournalEntry): boolean {
  return pinnedEntryKeys.value.includes(entryStorageKey(entry))
}

function togglePin(entry: JournalEntry) {
  const key = entryStorageKey(entry)
  const next = new Set(pinnedEntryKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  pinnedEntryKeys.value = [...next]
  savePinnedEntries(pinnedEntryKeys.value)
}

function loadPinnedEntries(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PINNED_ENTRIES_STORAGE_KEY)
    const value = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function savePinnedEntries(keys: string[]) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(PINNED_ENTRIES_STORAGE_KEY, JSON.stringify(keys)) } catch { /* localStorage can be unavailable */ }
}

function loadSortMode(): SortMode {
  if (typeof window === 'undefined') return 'created-desc'
  try {
    const value = window.localStorage.getItem(SORT_MODE_STORAGE_KEY)
    return value === 'title-asc' || value === 'title-desc' || value === 'created-asc' || value === 'created-desc' ? value : 'created-desc'
  } catch {
    return 'created-desc'
  }
}

function entryCreatedTime(entry: JournalEntry): number {
  // CREATED is authoritative. Older objects may not contain it, so use the best
  // available stable timestamp as a backwards-compatible fallback.
  return (entry.created ?? entry.lastModified ?? entry.date ?? entry.due)?.getTime() ?? 0
}

function loadCollectionOrder(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(COLLECTION_ORDER_STORAGE_KEY)
    const value = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveCollectionOrder(order: string[]) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(COLLECTION_ORDER_STORAGE_KEY, JSON.stringify(order)) } catch { /* localStorage can be unavailable */ }
}

function startCollectionDrag(event: DragEvent, href: string) {
  draggedCollectionHref.value = href
  dragOverCollectionHref.value = href
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', href)
  }
}

function moveDraggedCollection(targetHref: string) {
  const sourceHref = draggedCollectionHref.value
  if (!sourceHref || sourceHref === targetHref) return
  const order = sortedCollections.value.map(collection => collection.href)
  const sourceIndex = order.indexOf(sourceHref)
  const targetIndex = order.indexOf(targetHref)
  if (sourceIndex < 0 || targetIndex < 0) return
  order.splice(sourceIndex, 1)
  order.splice(targetIndex, 0, sourceHref)
  collectionOrder.value = order
  dragOverCollectionHref.value = targetHref
  saveCollectionOrder(order)
}

function finishCollectionDrag() {
  draggedCollectionHref.value = null
  dragOverCollectionHref.value = null
}

function collectionSupports(collection: JournalCollection, type: EntryType): boolean {
  if (!collection.components.length) return true
  return collection.components.includes(type === 'task' ? 'VTODO' : 'VJOURNAL')
}

function countFor(href: string): number {
  return entries.value.filter(e => e.collectionHref === href).length
}

function countTypeForCollection(href: string, type: TypeFilter): number {
  return entries.value.filter(e => e.collectionHref === href && (type === 'all' || e.type === type)).length
}

function toggleCollection(href: string) {
  if (activeCollectionHref.value === href) {
    activeCollectionHref.value = null
    typeFilter.value = 'all'
    cancelEdit()
    return
  }
  activeCollectionHref.value = href
  typeFilter.value = 'all'
}
function preview(value: string): string { return value.replace(/\s+/g, ' ').trim().slice(0, 180) || t('No description') }
function formatDate(date: Date): string { return new Intl.DateTimeFormat(localeTag(), { dateStyle: 'medium' }).format(date) }
function displayDate(entry: JournalEntry): string {
  if (entry.type === 'task' && entry.due) return `${t('Due')}: ${formatDate(entry.due)}`
  if (entry.date) return formatDate(entry.date)
  if (entry.lastModified) return `${t('Changed')}: ${formatDate(entry.lastModified)}`
  return t('No date')
}
function toInputDate(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function fromInputDate(value: string): Date { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d) }
function cloneEntry(entry: JournalEntry): JournalEntry { return { ...entry, date: entry.date ? new Date(entry.date) : undefined, due: entry.due ? new Date(entry.due) : undefined, categories: [...entry.categories] } }
function typeIcon(type: EntryType): string { return type === 'task' ? '☑' : type === 'note' ? '📝' : '📔' }
function typeLabel(type: EntryType): string { return type === 'task' ? 'Task' : type === 'note' ? 'Note' : 'Journal entry' }
function taskStatusLabel(status?: string): string { return status === 'COMPLETED' ? 'Completed' : status === 'IN-PROCESS' ? 'In progress' : status === 'CANCELLED' ? 'Cancelled' : 'Open' }

function selectEntry(entry: JournalEntry) {
  selected.value = entry
  draft.value = cloneEntry(entry)
  isNew.value = false
  saveError.value = null
}

function newEntry(type: EntryType) {
  showTypePicker.value = false
  const preferred = collections.value.find(c => c.href === activeCollectionHref.value && collectionSupports(c, type))
  const collection = preferred ?? collections.value.find(c => collectionSupports(c, type))
  if (!collection) {
    alert(t(type === 'task' ? 'No collection supports VTODO.' : 'No collection supports VJOURNAL.'))
    return
  }
  selected.value = null
  draft.value = {
    uid: '', type, title: '', description: '', date: type === 'journal' ? new Date() : undefined, due: undefined,
    categories: [], status: type === 'task' ? 'NEEDS-ACTION' : undefined,
    percentComplete: type === 'task' ? 0 : undefined, priority: type === 'task' ? 0 : undefined,
    collectionHref: collection.href, resourceHref: '',
  }
  isNew.value = true
  saveError.value = null
}

function cancelEdit() { selected.value = null; draft.value = null; isNew.value = false; saveError.value = null }

async function save() {
  if (!draft.value) return
  if (draft.value.type === 'journal' && !draft.value.date) {
    saveError.value = t('A journal entry needs a date.')
    return
  }
  saving.value = true
  saveError.value = null
  try {
    const payload = cloneEntry(draft.value)
    let saved: JournalEntry
    if (isNew.value) {
      saved = await createEntry(payload, payload.collectionHref)
      isNew.value = false
    } else {
      saved = await updateEntry(payload)
    }
    selected.value = saved
    draft.value = cloneEntry(saved)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    saveError.value = message.includes('412') ? t('This entry changed on the server. Refresh before saving again.') : message
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!draft.value || isNew.value) return
  if (!confirm(t('Delete this entry?'))) return
  saving.value = true
  saveError.value = null
  try {
    await deleteEntry(draft.value)
    cancelEdit()
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    saveError.value = message.includes('412') ? t('The entry changed during deletion. Refresh and try again.') : message
  } finally {
    saving.value = false
  }
}

async function createCollectionPrompt() {
  const name = prompt(t('Name for the new journal collection'))?.trim()
  if (!name) return
  try { await createCollection(name) } catch (e: unknown) { alert(e instanceof Error ? e.message : String(e)) }
}
</script>

<style scoped>
* { box-sizing: border-box; }
.journal-app { height: 100%; min-height: calc(100vh - 52px); display: flex; background: var(--oc-role-background, #f7f8fa); color: var(--oc-role-on-surface, #1f2937); }
.sidebar { width: 270px; flex: 0 0 270px; padding: 22px 14px 16px; border-right: 1px solid var(--oc-role-outline-variant, #dfe3e8); background: var(--oc-role-surface, #fff); display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.brand-row,.pane-header,.editor-header,.actions,.section-title,.entry-topline,.task-progress,.type-picker header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
h1,h2,h3,p { margin: 0; } h1 { font-size: 22px; } h2 { font-size: 20px; } h3 { font-size: 16px; }
.eyebrow { text-transform: uppercase; letter-spacing: .08em; font-size: 10px; font-weight: 700; color: var(--oc-role-on-surface-variant, #6b7280); }
button,input,select,textarea { font: inherit; color: inherit; } button { cursor: pointer; }
.icon-button,.tiny-button { border: 0; background: transparent; border-radius: 8px; padding: 7px 9px; }.icon-button:hover,.tiny-button:hover { background: var(--oc-role-surface-container, #f0f2f5); }
.primary,.secondary,.danger { border: 1px solid transparent; border-radius: 8px; padding: 9px 14px; font-weight: 650; }.primary { background: var(--oc-role-primary, #0069a8); color: var(--oc-role-on-primary, white); }.secondary { background: var(--oc-role-surface-container, #eef1f4); }.danger { background: transparent; color: var(--oc-role-error, #b42318); border-color: color-mix(in srgb, var(--oc-role-error, #b42318) 35%, transparent); }
.new-button { width: 100%; margin: 4px 0 4px; }.section-title { margin-top: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--oc-role-on-surface-variant, #6b7280); }
.collection-group { border-radius: 8px; }.collection-group.dragging { opacity: .45; }.collection-group.drag-over { box-shadow: inset 0 2px 0 var(--oc-role-primary, #0069a8); }
.collection-row { width: 100%; border: 0; background: transparent; padding: 9px 8px; border-radius: 8px; display: grid; grid-template-columns: 16px 10px 1fr auto; gap: 8px; align-items: center; text-align: left; }.collection-row:hover,.collection-row.active { background: var(--oc-role-surface-container, #eef2f6); }.drag-handle { font-size: 15px; line-height: 1; opacity: .42; cursor: grab; user-select: none; }.collection-row:active .drag-handle { cursor: grabbing; }.collection-dot { width: 8px; height: 8px; border-radius: 50%; opacity: .75; }.collection-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.count { font-size: 11px; opacity: .6; }
.collection-type-tabs { display: grid; gap: 2px; margin: 2px 0 7px 24px; padding-left: 8px; border-left: 1px solid var(--oc-role-outline-variant, #e6e9ed); }.collection-type-tabs button { border: 0; background: transparent; border-radius: 7px; display: grid; grid-template-columns: 22px 1fr auto; gap: 6px; align-items: center; padding: 7px 8px; text-align: left; }.collection-type-tabs button:hover,.collection-type-tabs button.active { background: var(--oc-role-surface-container, #eef2f6); }.collection-type-tabs small { opacity: .55; }
.search,input,select,textarea { width: 100%; border: 1px solid var(--oc-role-outline-variant, #cfd5dd); border-radius: 8px; background: var(--oc-role-surface, #fff); padding: 10px 11px; outline: none; } input:focus,select:focus,textarea:focus { border-color: var(--oc-role-primary, #0069a8); box-shadow: 0 0 0 2px color-mix(in srgb, var(--oc-role-primary, #0069a8) 18%, transparent); }.check-row { display: flex; gap: 8px; align-items: center; font-size: 13px; }.check-row input { width: auto; }
.error,.save-error { color: var(--oc-role-error, #b42318); font-size: 12px; overflow-wrap: anywhere; }.save-error { padding: 10px; border-radius: 8px; background: color-mix(in srgb, var(--oc-role-error, #b42318) 8%, transparent); }.sidebar-footer { margin-top: auto; font-size: 11px; opacity: .55; text-align: center; }
.content { min-width: 0; flex: 1; display: grid; grid-template-columns: minmax(310px, 38%) minmax(420px, 1fr); }.list-pane { min-width: 0; border-right: 1px solid var(--oc-role-outline-variant, #dfe3e8); overflow-y: auto; background: var(--oc-role-surface, #fff); }.pane-header { position: sticky; top: 0; z-index: 2; padding: 20px; border-bottom: 1px solid var(--oc-role-outline-variant, #e3e7ec); background: inherit; }
.sort-control { width: min(230px, 48%); font-size: 12px; font-weight: 500; }.sort-control select { padding: 8px 34px 8px 10px; background: var(--oc-role-surface, #fff); }
.entry-card { width: 100%; text-align: left; border: 0; border-bottom: 1px solid var(--oc-role-outline-variant, #edf0f2); padding: 16px 20px; background: transparent; cursor: pointer; }.entry-card:hover,.entry-card.selected { background: var(--oc-role-surface-container-low, #f4f6f8); }.entry-card.selected { box-shadow: inset 3px 0 0 var(--oc-role-primary, #0069a8); }.entry-card.pinned { box-shadow: inset 3px 0 0 color-mix(in srgb, var(--oc-role-primary, #0069a8) 65%, #f5b700); }.entry-card.selected.pinned { box-shadow: inset 3px 0 0 var(--oc-role-primary, #0069a8); }.entry-topline { margin-bottom: 6px; }.entry-meta { display: flex; align-items: center; gap: 7px; min-width: 0; }.pin-button { border: 0; background: transparent; border-radius: 6px; padding: 2px 4px; line-height: 1; font-size: 14px; opacity: .42; }.pin-button:hover,.pin-button.active { opacity: 1; background: var(--oc-role-surface-container, #eef2f6); }.type-badge { font-size: 11px; font-weight: 650; }.entry-date { font-size: 11px; opacity: .62; }.entry-card p { margin-top: 6px; font-size: 13px; opacity: .75; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }.task-progress { font-size: 11px; opacity: .65; margin-top: 8px; }.tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 9px; }.tags span { background: var(--oc-role-surface-container-high, #e9edf1); border-radius: 999px; padding: 2px 7px; font-size: 10px; }
.editor-pane { overflow: auto; min-width: 0; }.editor { min-height: 100%; padding: 24px 28px; display: flex; flex-direction: column; gap: 18px; max-width: 960px; margin: 0 auto; }.editor-header { padding-bottom: 16px; border-bottom: 1px solid var(--oc-role-outline-variant, #dfe3e8); }.editor label { display: flex; flex-direction: column; gap: 7px; font-size: 12px; font-weight: 650; }.editor label small { font-weight: 400; opacity: .6; }.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }.task-fields { grid-template-columns: repeat(3, minmax(0, 1fr)); }.description-field { flex: 1; min-height: 300px; }.description-field textarea { flex: 1; min-height: 360px; resize: vertical; line-height: 1.6; font-family: inherit; }.metadata { display: flex; flex-wrap: wrap; gap: 16px; font-size: 10px; opacity: .5; border-top: 1px solid var(--oc-role-outline-variant, #e3e7ec); padding-top: 12px; overflow-wrap: anywhere; }
.empty-state,.editor-placeholder { min-height: 280px; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; text-align: center; opacity: .62; padding: 30px; }.editor-placeholder { height: 100%; min-height: 500px; }.empty-icon { font-size: 38px; opacity: .45; }.spinner { width: 22px; height: 22px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }.spinning { animation: spin .7s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
.modal-backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.45); display: grid; place-items: center; padding: 20px; }.type-picker { width: min(520px, 100%); background: var(--oc-role-surface, #fff); border-radius: 14px; box-shadow: 0 24px 70px rgba(0,0,0,.28); padding: 18px; display: grid; gap: 8px; }.type-picker header { padding: 2px 2px 10px; }.type-choice { display: grid; grid-template-columns: 42px 1fr auto; align-items: center; gap: 12px; width: 100%; border: 1px solid var(--oc-role-outline-variant, #dfe3e8); background: transparent; border-radius: 10px; padding: 14px; text-align: left; }.type-choice:hover { background: var(--oc-role-surface-container-low, #f4f6f8); border-color: var(--oc-role-primary, #0069a8); }.choice-icon { font-size: 25px; }.type-choice strong,.type-choice small { display: block; }.type-choice small { margin-top: 3px; opacity: .65; line-height: 1.35; }
@media (max-width: 900px) { .sort-control { width: min(210px, 50%); } .sidebar { width: 225px; flex-basis: 225px; }.content { grid-template-columns: 1fr; }.editor-pane { position: fixed; inset: 52px 0 0 225px; z-index: 10; background: var(--oc-role-background, #f7f8fa); }.editor-pane:has(.editor-placeholder) { display: none; }.task-fields { grid-template-columns: 1fr; } }
@media (max-width: 650px) { .pane-header { align-items: flex-start; }.sort-control { width: 48%; }.sort-control select { font-size: 11px; padding: 7px 28px 7px 8px; } .journal-app { display: block; }.sidebar { width: 100%; height: auto; border-right: 0; border-bottom: 1px solid var(--oc-role-outline-variant, #ddd); }.section-title,.collection-row,.search,.check-row,.sidebar-footer { display: none; }.type-tabs { grid-template-columns: repeat(4, 1fr); }.type-tabs button { display: flex; justify-content: center; padding: 7px 4px; font-size: 11px; }.type-tabs button small { display: none; }.content { display: block; }.editor-pane { inset: 0; background: var(--oc-role-background, #fff); }.editor { padding: 16px; }.editor-header { align-items: flex-start; flex-direction: column; }.actions { width: 100%; flex-wrap: wrap; }.field-grid { grid-template-columns: 1fr; } }
</style>
