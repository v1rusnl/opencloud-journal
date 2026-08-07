import { ref, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { CalDavClient, type Calendar, type CalendarEvent } from '@/services/caldav'
import { useAuth } from './useAuth'

export function useCalendar() {
  const { userId, userPathId, serverUrl, accessToken, getAppToken, clearAppToken } = useAuth()

  const loading = ref(false)
  const error = ref<string | null>(null)
  const calendars = ref<Calendar[]>([])
  const events = ref<CalendarEvent[]>([])
  const activeCalendarHref = ref<string | null>(null)
  const hiddenCalendars = ref<Set<string>>(new Set())

  function toggleCalendar(href: string) {
    const next = new Set(hiddenCalendars.value)
    if (next.has(href)) next.delete(href)
    else next.add(href)
    hiddenCalendars.value = next
  }

  let client: CalDavClient | null = null
  let lastLoadedUserId = ''

  // current view range (set by CalendarView whenever the FC view changes)
  const viewStart = ref<Date>(new Date())
  const viewEnd = ref<Date>(new Date())

  async function getClient(): Promise<CalDavClient> {
    if (client && lastLoadedUserId === userId.value) return client

    // Only clear token if the user actually changed (not on initial load)
    if (lastLoadedUserId && lastLoadedUserId !== userId.value) {
      clearAppToken()
    }
    const token = await getAppToken()
    client = new CalDavClient(serverUrl.value, userPathId.value, userId.value, token)
    lastLoadedUserId = userId.value
    return client
  }

  // Force a fresh token + client (called when the server returns 401,
  // e.g. after the user manually deleted the token in OpenCloud settings).
  async function refreshClient(): Promise<CalDavClient> {
    clearAppToken()
    client = null
    lastLoadedUserId = ''
    return getClient()
  }

  function is401(e: unknown): boolean {
    return e instanceof Error && e.message.includes('401')
  }

  async function loadCalendars() {
    loading.value = true
    error.value = null
    try {
      let c = await getClient()
      try {
        calendars.value = await c.listCalendars()
      } catch (e: unknown) {
        if (!is401(e)) throw e
        // Token was deleted on the server — get a fresh one and retry once.
        c = await refreshClient()
        calendars.value = await c.listCalendars()
      }
      if (calendars.value.length && !activeCalendarHref.value) {
        activeCalendarHref.value = calendars.value[0].href
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function loadEvents(from: Date, to: Date) {
    if (!calendars.value.length) return
    loading.value = true
    error.value = null
    const epoch = Date.now()
    try {
      const c = await getClient()
      const all: CalendarEvent[] = []
      for (const cal of calendars.value) {
        // The calendar colour is deliberately NOT copied onto the event here.
        // CalendarEvent.color is persisted as a COLOR property by buildIcs, so
        // baking it in wrote the calendar's colour into the stored .ics file —
        // after which the event kept that colour even when moved to a calendar
        // of a different colour. The view derives the colour from calendarHref.
        const evs = await c.fetchEvents(cal.href, from, to)
        all.push(...evs)
      }
      // epoch-guard: discard if a newer load finished first
      if (epoch < lastEpoch) return
      lastEpoch = epoch
      events.value = all
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  let lastEpoch = 0

  async function saveEvent(event: CalendarEvent): Promise<CalendarEvent> {
    const c = await getClient()
    const newEtag = await c.saveEvent(event)
    return { ...event, etag: newEtag ?? event.etag }
  }

  async function createEvent(
    partial: Omit<CalendarEvent, 'uid' | 'calendarHref' | 'etag'>,
    calendarHref?: string,
  ): Promise<CalendarEvent> {
    const c = await getClient()
    const uid = uuidv4()
    const href = calendarHref ?? activeCalendarHref.value ?? calendars.value[0]?.href
    if (!href) throw new Error('No calendar available')
    const eventHref = c.newEventHref(href, uid)
    const event: CalendarEvent = { ...partial, uid, calendarHref: eventHref }
    const saved = await saveEvent(event)
    // optimistic update
    events.value = [...events.value, saved]
    return saved
  }

  async function updateEvent(event: CalendarEvent): Promise<void> {
    const original = events.value.find(e => e.uid === event.uid)

    if (original && original.calendarHref !== event.calendarHref) {
      // Calendar changed — move: PUT to new location, then DELETE from old.
      const c = await getClient()
      const newEtag = await c.saveEvent(event)
      await c.deleteEvent({ ...original })
      events.value = events.value.map(e =>
        e.uid === event.uid ? { ...event, etag: newEtag ?? event.etag } : e
      )
    } else if (event.seriesUid) {
      // Recurring event occurrence — patch the master ICS, preserving properties we don't touch.
      const c = await getClient()
      const newEtag = await c.patchRecurringEvent(event.calendarHref, {
        title: event.title,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        rrule: event.rrule,
      })
      // Apply time deltas so drag/resize is reflected immediately without a reload.
      const startDelta = original ? event.start.getTime() - original.start.getTime() : 0
      const endDelta = original ? event.end.getTime() - original.end.getTime() : 0
      events.value = events.value.map(e =>
        e.seriesUid === event.seriesUid
          ? {
              ...e,
              title: event.title,
              description: event.description,
              location: event.location,
              allDay: event.allDay,
              rrule: event.rrule,
              start: new Date(e.start.getTime() + startDelta),
              end: new Date(e.end.getTime() + endDelta),
              etag: newEtag ?? e.etag,
            }
          : e
      )
    } else {
      const saved = await saveEvent(event)
      events.value = events.value.map(e => (e.uid === event.uid ? saved : e))
    }
  }

  async function createCalendar(name: string, color: string): Promise<void> {
    const c = await getClient()
    const cal = await c.createCalendar(name, color)
    calendars.value = [...calendars.value, cal]
  }

  async function renameCalendar(href: string, newName: string): Promise<void> {
    const c = await getClient()
    await c.renameCalendar(href, newName)
    calendars.value = calendars.value.map(cal =>
      cal.href === href ? { ...cal, displayName: newName.trim() } : cal
    )
  }

  async function deleteEvent(event: CalendarEvent): Promise<void> {
    const c = await getClient()
    await c.deleteEvent(event)
    if (event.seriesUid) {
      // Deletes the master ICS — remove all occurrences of this series
      events.value = events.value.filter(e => e.seriesUid !== event.seriesUid)
    } else {
      events.value = events.value.filter(e => e.uid !== event.uid)
    }
  }

  async function deleteOccurrence(event: CalendarEvent): Promise<void> {
    const c = await getClient()
    await c.deleteOccurrence(event.calendarHref, event.start, event.allDay)
    // Remove this occurrence; clear ETags on remaining series occurrences
    // because the master ICS was modified (EXDATE added) and the ETag changed.
    // Without this, a subsequent "Delete series" would send a stale If-Match → 412.
    events.value = events.value
      .filter(e => e.uid !== event.uid)
      .map(e => e.seriesUid === event.seriesUid ? { ...e, etag: undefined } : e)
  }

  // Load on mount and re-load when user or token changes.
  // immediate:true replaces the onMounted call in CalendarView so there is
  // exactly one initialisation path and no concurrent getAppToken() calls.
  watch([userId, accessToken], async ([newUser], [oldUser]) => {
    if (newUser !== oldUser) {
      client = null
      calendars.value = []
      events.value = []
      activeCalendarHref.value = null
    }
    if (newUser) {
      await loadCalendars()
    }
  }, { immediate: true })

  return {
    loading,
    error,
    calendars,
    events,
    activeCalendarHref,
    hiddenCalendars,
    toggleCalendar,
    viewStart,
    viewEnd,
    loadCalendars,
    loadEvents,
    createCalendar,
    createEvent,
    updateEvent,
    deleteEvent,
    deleteOccurrence,
    renameCalendar,
  }
}
