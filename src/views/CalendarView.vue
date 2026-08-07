<template>
  <div class="calendar-view" ref="rootEl">
    <!-- Sidebar: calendar list -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">{{ t('Agenda') }}</span>
        <button class="btn-reload" :class="{ spinning: loading }" :title="t('Refresh')" @click="reload">↻</button>
        <button class="btn-new-event" @click="openNewEvent()">{{ t('+ New') }}</button>
      </div>

      <div class="calendars-header">
        <span class="calendars-label">{{ t('Calendars') }}</span>
        <button class="btn-new-cal" :title="t('New Calendar')" @click="calendarDialogOpen = true">+</button>
      </div>

      <ul class="calendar-list">
        <li
          v-for="cal in calendars"
          :key="cal.href"
          :class="{ active: activeCalendarHref === cal.href }"
          @click="activeCalendarHref = cal.href"
        >
          <input
            type="checkbox"
            :checked="!hiddenCalendars.has(cal.href)"
            @click.stop="toggleCalendar(cal.href)"
          />
          <span
            class="cal-dot"
            :style="{ background: cal.color ?? '#0082c9' }"
          />
          <input
            v-if="renamingHref === cal.href"
            class="cal-rename-input"
            v-model="renameValue"
            @keydown.enter.stop="commitRename(cal.href)"
            @keydown.escape.stop="renamingHref = null"
            @blur="commitRename(cal.href)"
            @click.stop
            ref="renameInputRef"
          />
          <span
            v-else
            class="cal-name"
            @dblclick.stop="startRename(cal)"
          >{{ cal.displayName }}</span>
        </li>
      </ul>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <!-- Subscriptions section -->
      <div class="calendars-header">
        <span class="calendars-label">{{ t('Subscriptions') }}</span>
        <button class="btn-new-cal" :title="t('Add Subscription')" @click="subscriptionDialogOpen = true">+</button>
      </div>

      <ul class="calendar-list">
        <li v-for="sub in subscriptions" :key="sub.id">
          <input
            type="checkbox"
            :checked="sub.enabled"
            @click.stop="toggleSubscription(sub.id)"
          />
          <span class="cal-dot" :style="{ background: sub.color }" />
          <span
            class="cal-name sub-name"
            :title="t('Show URL and QR code')"
            @click.stop="sharingSubscription = sub"
          >{{ sub.name }}</span>
          <button class="btn-sub-remove" :title="t('Delete')" @click.stop="removeSubscription(sub.id)">×</button>
        </li>
      </ul>

      <div class="sidebar-footer">
        <button class="help-link" @click="helpOpen = true">? {{ de ? 'Hilfe' : 'Help' }}</button>
      </div>
    </aside>

    <!-- Main calendar area -->
    <main class="calendar-main">
      <div v-if="loading && !events.length" class="loading-overlay">
        <div class="spinner" />
      </div>

      <FullCalendar
        ref="fcRef"
        :options="calendarOptions"
      />
    </main>

    <!-- Help overlay -->
    <HelpView v-if="helpOpen" @close="helpOpen = false" />

    <!-- Calendar creation dialog -->
    <CalendarDialog
      v-if="calendarDialogOpen"
      @create="handleCreateCalendar"
      @close="calendarDialogOpen = false"
    />

    <!-- Subscription URL / QR dialog -->
    <SubscriptionShareDialog
      v-if="sharingSubscription"
      :subscription="sharingSubscription"
      @close="sharingSubscription = null"
    />

    <!-- Subscription dialog -->
    <SubscriptionDialog
      v-if="subscriptionDialogOpen"
      @add="(url, name, color) => { addSubscription(url, name, color); subscriptionDialogOpen = false }"
      @close="subscriptionDialogOpen = false"
    />

    <!-- Event dialog -->
    <EventDialog
      v-if="dialogOpen"
      :event="editingEvent"
      :defaultStart="pendingStart ?? undefined"
      :defaultEnd="pendingEnd ?? undefined"
      :defaultAllDay="pendingAllDay ?? undefined"
      :calendars="calendars"
      :activeCalendarHref="activeCalendarHref"
      @save="handleCreate"
      @update="handleUpdate"
      @delete="handleDelete"
      @delete-occurrence="handleDeleteOccurrence"
      @close="dialogOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import type { CalendarOptions, EventClickArg, DateSelectArg, DatesSetArg, EventDropArg, EventMountArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import deLocale from '@fullcalendar/core/locales/de'
import EventDialog from '@/components/EventDialog.vue'
import CalendarDialog from '@/components/CalendarDialog.vue'
import SubscriptionDialog from '@/components/SubscriptionDialog.vue'
import SubscriptionShareDialog from '@/components/SubscriptionShareDialog.vue'
import HelpView from '@/views/HelpView.vue'
import { useCalendar } from '@/composables/useCalendar'
import { useSubscriptions } from '@/composables/useSubscriptions'
import type { IcsSubscription } from '@/composables/useSubscriptions'
import { useAuth } from '@/composables/useAuth'
import { useI18n } from '@/composables/useI18n'
import { useMessages } from '@opencloud-eu/web-pkg'
import type { CalendarEvent } from '@/services/caldav'
import { addDays, formatEventRange } from '@/utils/eventFormat'
import { schemeForBackground } from '@/utils/theme'

const { t, isGerman, localeTag } = useI18n()
// Computed, not a constant: OpenCloud sets documentElement.lang only after the
// extension is mounted, so a setup-time read is still empty here.
const de = computed(() => isGerman())
const helpOpen = ref(false)

const {
  loading,
  error,
  calendars,
  events,
  activeCalendarHref,
  hiddenCalendars,
  toggleCalendar,
  loadCalendars,
  loadEvents,
  createCalendar,
  renameCalendar,
  createEvent,
  updateEvent,
  deleteEvent,
  deleteOccurrence,
} = useCalendar()

// --- subscriptions ---
const { userId, accessToken } = useAuth()
const { showErrorMessage } = useMessages()

const {
  subscriptions,
  subscriptionEvents,
  subscriptionErrors,
  addSubscription,
  removeSubscription,
  toggleSubscription,
} = useSubscriptions(
  () => userId.value,
  () => accessToken.value,
  (name, msg) => showErrorMessage({ title: `Kalender-Fehler: ${name}`, desc: msg, timeout: 10000 }),
  (msg) => showErrorMessage({ title: 'Abonnements nicht gespeichert', desc: msg, timeout: 10000 }),
)

const subscriptionDialogOpen = ref(false)
const sharingSubscription = ref<IcsSubscription | null>(null)

// --- calendar rename state ---
const renamingHref = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function startRename(cal: { href: string; displayName: string }) {
  renamingHref.value = cal.href
  renameValue.value = cal.displayName
  nextTick(() => renameInputRef.value?.select())
}

async function commitRename(href: string) {
  if (renamingHref.value !== href) return
  renamingHref.value = null
  const name = renameValue.value.trim()
  if (!name) return
  try {
    await renameCalendar(href, name)
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : String(e))
  }
}

// --- calendar dialog state ---
const calendarDialogOpen = ref(false)

async function handleCreateCalendar(name: string, color: string) {
  calendarDialogOpen.value = false
  try {
    await createCalendar(name, color)
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : String(e))
  }
}

// --- event dialog state ---
const dialogOpen = ref(false)
const editingEvent = ref<CalendarEvent | null>(null)
const pendingStart = ref<Date | null>(null)
const pendingEnd = ref<Date | null>(null)
const pendingAllDay = ref<boolean | null>(null)

function openNewEvent(start?: Date, end?: Date, allDay?: boolean) {
  editingEvent.value = null
  pendingStart.value = start ?? null
  pendingEnd.value = end ?? null
  pendingAllDay.value = allDay ?? null
  dialogOpen.value = true
}

function openEditEvent(event: CalendarEvent) {
  editingEvent.value = event
  pendingStart.value = null
  pendingEnd.value = null
  dialogOpen.value = true
}

// --- FullCalendar event mapping ---
const fcEvents = computed(() => {
  const caldavEvents = events.value
    .filter(e => {
      const cal = calendars.value.find(c => e.calendarHref.startsWith(c.href))
      return cal ? !hiddenCalendars.value.has(cal.href) : true
    })
    .map(e => ({
      id: e.uid,
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      // Always the calendar's colour: a per-event COLOR is not a feature this
      // app offers, and stale ones left in .ics files by earlier versions would
      // otherwise override the calendar the event now lives in.
      backgroundColor: activeCalColor(e.calendarHref),
      borderColor: activeCalColor(e.calendarHref),
      extendedProps: { event: e, readonly: false },
    }))

  const subEvents = subscriptionEvents.value.map(e => ({
    id: e.uid,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    backgroundColor: e.color ?? '#888',
    borderColor: e.color ?? '#888',
    editable: false,
    extendedProps: { event: e, readonly: true },
  }))

  return [...caldavEvents, ...subEvents]
})

function activeCalColor(href: string): string {
  return calendars.value.find(c => href.startsWith(c.href))?.color ?? '#0082c9'
}

// --- native control theming ---
// OpenCloud has no theme class to key on, so `color-scheme` — which native date
// pickers and selects obey — is derived from the theme's own surface colour.
// Left at the CSS default it follows the operating system, which is how a dark
// picker ended up inside a light dialog.

const rootEl = ref<HTMLElement | null>(null)
let themeObserver: MutationObserver | null = null

function syncColorScheme() {
  if (!rootEl.value) return
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--oc-role-surface')
  rootEl.value.style.colorScheme = schemeForBackground(surface)
}

onMounted(() => {
  syncColorScheme()
  // OpenCloud rewrites the custom properties in place when the theme changes;
  // that shows up as an attribute change on <html>, not as an event.
  themeObserver = new MutationObserver(syncColorScheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  themeObserver = null
})

// --- hover tooltip ---
// Month view truncates titles, and subscription events are read-only so there is
// no dialog to open. The tooltip is the only way to read the full entry there.

const DESC_LIMIT = 400

let tooltipEl: HTMLDivElement | null = null

function ensureTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    // Appended to <body> rather than the component root: FullCalendar's scroll
    // containers would clip a tooltip rendered inside the grid.
    tooltipEl = document.createElement('div')
    tooltipEl.className = 'agenda-event-tooltip'
    tooltipEl.setAttribute('role', 'tooltip')
    tooltipEl.hidden = true
    document.body.appendChild(tooltipEl)
  }
  return tooltipEl
}

function fillTooltip(ev: CalendarEvent) {
  const el = ensureTooltip()
  el.replaceChildren()
  const addLine = (text: string | undefined, cls: string) => {
    if (!text) return
    const line = document.createElement('div')
    line.className = cls
    // textContent, never innerHTML — subscription feeds are third-party content
    line.textContent = text.length > DESC_LIMIT ? text.slice(0, DESC_LIMIT) + '…' : text
    el.appendChild(line)
  }
  addLine(ev.title, 'tt-title')
  addLine(formatEventRange(ev, localeTag()), 'tt-time')
  addLine(ev.location, 'tt-location')
  addLine(ev.description, 'tt-desc')
}

function positionTooltip(x: number, y: number) {
  const el = ensureTooltip()
  const pad = 12
  const rect = el.getBoundingClientRect()
  let left = x + pad
  let top = y + pad
  // Flip to the other side of the cursor when the tooltip would leave the viewport
  if (left + rect.width > window.innerWidth - pad) left = x - rect.width - pad
  if (top + rect.height > window.innerHeight - pad) top = y - rect.height - pad
  el.style.left = `${Math.max(pad, left)}px`
  el.style.top = `${Math.max(pad, top)}px`
}

function hideTooltip() {
  if (tooltipEl) tooltipEl.hidden = true
}

// A tooltip left visible while the grid scrolls away would float over unrelated
// content, so any scroll dismisses it.
window.addEventListener('scroll', hideTooltip, true)

onBeforeUnmount(() => {
  window.removeEventListener('scroll', hideTooltip, true)
  tooltipEl?.remove()
  tooltipEl = null
})

// --- initial view via URL path ---
function getInitialView(): string {
  const path = window.location.pathname
  if (path.endsWith('/week')) return 'timeGridWeek'
  if (path.endsWith('/day')) return 'timeGridDay'
  if (path.endsWith('/list')) return 'listWeek'
  return 'dayGridMonth'
}

// detect language for FC locale
function getFcLocale() {
  return isGerman() ? deLocale : 'en'
}

// current range being displayed — re-fetch when it changes
let currentRange = { start: new Date(), end: new Date() }

function onDatesSet(info: DatesSetArg) {
  currentRange = { start: info.start, end: info.end }
  loadEvents(info.start, info.end)
}

async function reload() {
  await loadCalendars()
  loadEvents(currentRange.start, currentRange.end)
}

const fcRef = ref<InstanceType<typeof FullCalendar> | null>(null)

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  initialView: getInitialView(),
  locale: getFcLocale(),
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
  },
  views: {
    listWeek: { buttonText: t('list') },
  },
  dayMaxEvents: true,
  selectable: true,
  editable: true,
  eventResizableFromStart: true,
  events: fcEvents.value,
  select(info: DateSelectArg) {
    // FC end is exclusive for all-day selections → shift back one day for the dialog
    const end = info.allDay ? addDays(info.end, -1) : info.end
    openNewEvent(info.start, end, info.allDay)
  },
  eventClick(info: EventClickArg) {
    if (info.event.extendedProps.readonly) return
    const ev = info.event.extendedProps.event as CalendarEvent
    openEditEvent(ev)
  },
  eventDidMount(info: EventMountArg) {
    const ev = info.event.extendedProps.event as CalendarEvent | undefined
    if (!ev) return
    info.el.addEventListener('mouseenter', (e: MouseEvent) => {
      fillTooltip(ev)
      ensureTooltip().hidden = false
      positionTooltip(e.clientX, e.clientY)
    })
    info.el.addEventListener('mousemove', (e: MouseEvent) => positionTooltip(e.clientX, e.clientY))
    info.el.addEventListener('mouseleave', hideTooltip)
  },
  eventWillUnmount() {
    // The listeners go away with the element; the shared tooltip does not.
    hideTooltip()
  },
  async eventDrop(info: EventDropArg) {
    const ev = info.event.extendedProps.event as CalendarEvent
    const updated: CalendarEvent = {
      ...ev,
      start: info.event.start!,
      end: info.event.end ?? new Date(info.event.start!.getTime() + 3600 * 1000),
      allDay: info.event.allDay,
    }
    try {
      await updateEvent(updated)
    } catch (e: unknown) {
      info.revert()
      alert(e instanceof Error ? e.message : String(e))
    }
  },
  async eventResize(info: EventResizeDoneArg) {
    const ev = info.event.extendedProps.event as CalendarEvent
    const updated: CalendarEvent = {
      ...ev,
      start: info.event.start!,
      end: info.event.end!,
      allDay: info.event.allDay,
    }
    try {
      await updateEvent(updated)
    } catch (e: unknown) {
      info.revert()
      alert(e instanceof Error ? e.message : String(e))
    }
  },
  eventClassNames(arg) {
    const ev = arg.event.extendedProps.event as CalendarEvent
    return (ev.seriesUid || ev.rrule) ? ['fc-event-recurring'] : []
  },
  datesSet: onDatesSet,
  height: '100%',
  firstDay: 1, // Monday
  nowIndicator: true,
  eventTimeFormat: {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },
}))

// --- handlers ---
async function handleCreate(
  partial: Omit<CalendarEvent, 'uid' | 'calendarHref' | 'etag'> & { calendarHref: string },
) {
  dialogOpen.value = false
  try {
    await createEvent(partial, partial.calendarHref)
    if (partial.rrule) {
      // Optimistic update only adds one object — reload to get all expanded occurrences
      loadEvents(currentRange.start, currentRange.end)
    }
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : String(e))
  }
}

async function handleUpdate(event: CalendarEvent) {
  dialogOpen.value = false
  try {
    await updateEvent(event)
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : String(e))
  }
}

async function handleDelete(event: CalendarEvent) {
  dialogOpen.value = false
  try {
    await deleteEvent(event)
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : String(e))
  }
}

async function handleDeleteOccurrence(event: CalendarEvent) {
  dialogOpen.value = false
  try {
    await deleteOccurrence(event)
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : String(e))
  }
}

// reload events when calendars change
watch(calendars, () => {
  if (calendars.value.length) {
    loadEvents(currentRange.start, currentRange.end)
  }
})
</script>

<style scoped>
.calendar-view {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ---- Sidebar ---- */
.sidebar {
  width: 220px;
  min-width: 180px;
  border-right: 1px solid var(--oc-role-outline-variant);
  display: flex;
  flex-direction: column;
  padding: 1rem 0.75rem;
  gap: 0.5rem;
  background: var(--oc-role-surface-container-high);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.sidebar-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--oc-role-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-reload {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--oc-role-on-surface-variant);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.btn-reload:hover {
  background: var(--oc-role-surface);
}

.btn-reload.spinning {
  animation: spin 0.7s linear infinite;
}

.btn-new-event {
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  border: none;
  background: var(--oc-role-primary);
  color: var(--oc-role-on-primary, #fff);
  cursor: pointer;
  font-size: 0.85rem;
}

.calendars-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
}

.calendars-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--oc-role-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-new-cal {
  padding: 0.1rem 0.45rem;
  border-radius: 4px;
  border: 1px solid var(--oc-role-outline-variant, #ccc);
  background: transparent;
  color: var(--oc-role-on-surface);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1.2;
}

.btn-new-cal:hover {
  background: var(--oc-role-surface);
}

.calendar-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.calendar-list li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--oc-role-on-surface);
}

.calendar-list li:hover,
.calendar-list li.active {
  background: var(--oc-role-surface);
}

.cal-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sub-name {
  cursor: pointer;
}

.sub-name:hover {
  text-decoration: underline;
}

.cal-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-rename-input {
  flex: 1;
  font-size: 0.9rem;
  padding: 0 2px;
  border: 1px solid var(--oc-role-primary);
  border-radius: 3px;
  background: var(--oc-role-surface);
  color: var(--oc-role-on-surface);
  outline: none;
  min-width: 0;
}

.btn-sub-remove {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--oc-role-on-surface-variant);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.calendar-list li:hover .btn-sub-remove {
  opacity: 1;
}

.sub-error {
  font-size: 0.78rem;
  padding: 0 0.5rem;
}

/* ---- Main area ---- */
.calendar-main {
  flex: 1;
  min-width: 0;
  padding: 0.75rem;
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  pointer-events: none;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--oc-role-outline-variant, #d0d0d0);
  border-top-color: var(--oc-role-primary, #0082c9);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-msg {
  color: var(--oc-role-error);
  font-size: 0.8rem;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 0.5rem;
}

.help-link {
  font-size: 0.8rem;
  color: var(--oc-role-on-surface-variant);
  opacity: 0.7;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
}

.help-link:hover {
  opacity: 1;
  text-decoration: underline;
}

/* ---- FullCalendar theming, driven by the OpenCloud role tokens ---- */
:deep(.fc) {
  --fc-border-color: var(--oc-role-outline-variant, #d0d0d0);
  --fc-page-bg-color: var(--oc-role-surface);
  --fc-neutral-bg-color: var(--oc-role-surface-container-high);
  --fc-neutral-text-color: var(--oc-role-on-surface-variant);
  --fc-today-bg-color: color-mix(in srgb, var(--oc-role-primary) 10%, transparent);
  --fc-button-bg-color: var(--oc-role-surface-container-high);
  --fc-button-border-color: var(--oc-role-outline-variant, #d0d0d0);
  --fc-button-hover-bg-color: var(--oc-role-surface);
  --fc-button-hover-border-color: var(--oc-role-outline, #b0b0b0);
  --fc-button-active-bg-color: var(--oc-role-primary);
  --fc-button-active-border-color: var(--oc-role-primary);
  --fc-button-text-color: var(--oc-role-on-surface);
  --fc-list-event-hover-bg-color: var(--oc-role-surface-container-high);
  color: var(--oc-role-on-surface);
}

:deep(.fc .fc-button-primary:not(:disabled).fc-button-active),
:deep(.fc .fc-button-primary:not(:disabled):active) {
  color: var(--oc-role-on-primary, #fff);
}

:deep(.fc .fc-col-header-cell-cushion),
:deep(.fc .fc-daygrid-day-number),
:deep(.fc .fc-list-day-cushion),
:deep(.fc a) {
  color: var(--oc-role-on-surface);
}

:deep(.fc .fc-toolbar-title) {
  color: var(--oc-role-on-surface);
  font-size: 1.1rem;
}

:deep(.fc .fc-list-empty) {
  background: var(--oc-role-surface);
  color: var(--oc-role-on-surface-variant);
}

/* Day cell backgrounds — light mode */
:deep(.fc-daygrid-day) {
  background: var(--oc-role-surface-container, #f9f9f9);
}
:deep(.fc-daygrid-day:hover) {
  background: var(--oc-role-surface-container-high, #f0f0f0);
}
:deep(.fc-day-other) {
  background: var(--oc-role-surface-container-high, #f3f3f3);
  opacity: 0.6;
}
:deep(.fc-day-today.fc-daygrid-day) {
  /* !important is needed to beat FullCalendar's own rule, which is why this
     cannot simply rely on --fc-today-bg-color set above. */
  background: color-mix(in srgb, var(--oc-role-primary, #0082c9) 10%, transparent) !important;
}

/* Recurring event indicator */
:deep(.fc-event-recurring .fc-event-title::after),
:deep(.fc-event-recurring .fc-list-event-title::after) {
  content: ' ↻';
  font-size: 0.8em;
  opacity: 0.75;
}

/* timeGrid (week/day): bar at bottom of timed events */
:deep(.fc-timegrid-event .fc-event-resizer-end::after) {
  content: '';
  display: block;
  width: 24px;
  height: 4px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 2px;
  margin: 0 auto;
  margin-top: 2px;
}

/* dayGrid (month): vertical bars at left and right edges of multi-day events.
   FC already sets position:absolute on these — do NOT override it. */
:deep(.fc-daygrid-event .fc-event-resizer-start),
:deep(.fc-daygrid-event .fc-event-resizer-end) {
  width: 14px;
  cursor: ew-resize;
}
/* Show the bar only on real events, not on the drag mirror clone */
:deep(.fc-daygrid-event:not(.fc-event-mirror) .fc-event-resizer-start::after),
:deep(.fc-daygrid-event:not(.fc-event-mirror) .fc-event-resizer-end::after) {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 14px;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 2px;
  pointer-events: none;
}

/* Replace icon font (blocked by CSP font-src) with unicode characters */
:deep(.fc-icon) {
  font-family: inherit !important;
  font-size: 1rem !important;
}
:deep(.fc-icon-chevron-left::before)  { content: '‹' !important; }
:deep(.fc-icon-chevron-right::before) { content: '›' !important; }
:deep(.fc-icon-chevrons-left::before)  { content: '«' !important; }
:deep(.fc-icon-chevrons-right::before) { content: '»' !important; }
:deep(.fc-icon-minus::before) { content: '−' !important; }
:deep(.fc-icon-plus::before)  { content: '+' !important; }
:deep(.fc-icon-x::before)     { content: '×' !important; }

</style>

<!-- Not scoped: the tooltip is mounted on <body>, outside this component's subtree. -->
<style>
.agenda-event-tooltip {
  position: fixed;
  /* Above FullCalendar's "+N more" popover, which injects z-index: 9999 at
     runtime — the tooltip is useless if it renders behind the very list the
     user opened to read the entries. */
  z-index: 10000;
  max-width: 320px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--oc-role-outline-variant, #ddd);
  background: var(--oc-role-surface, #fff);
  color: var(--oc-role-on-surface, #222);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
  font-size: 0.82rem;
  line-height: 1.35;
  pointer-events: none;
  overflow-wrap: anywhere;
}

.agenda-event-tooltip[hidden] {
  display: none;
}

.agenda-event-tooltip .tt-title {
  font-weight: 600;
  margin-bottom: 2px;
}

.agenda-event-tooltip .tt-time {
  opacity: 0.75;
}

.agenda-event-tooltip .tt-location {
  margin-top: 4px;
}

.agenda-event-tooltip .tt-location::before {
  content: '📍 ';
}

.agenda-event-tooltip .tt-desc {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--oc-role-outline-variant, #e5e5e5);
  white-space: pre-wrap;
  opacity: 0.9;
}

</style>
