import ICAL from 'ical.js'
import { PRODID } from '@/constants'

export interface CalendarEvent {
  uid: string
  seriesUid?: string // original UID of a recurring series (uid is synthetic for occurrences)
  title: string
  start: Date
  end: Date
  allDay: boolean
  description?: string
  location?: string
  color?: string
  calendarHref: string // full URL of the .ics resource
  etag?: string
  rrule?: string
}

export interface Calendar {
  href: string
  displayName: string
  color?: string
  ctag?: string
}

// ---------- helpers ----------

// Escape XML special characters in element text content.
export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// Escape iCalendar TEXT values per RFC 5545 §3.3.11.
export function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml')
}

function getTagText(el: Element, localName: string): string {
  const found = el.getElementsByTagNameNS('*', localName)[0]
    ?? el.querySelector(localName)
  return found?.textContent?.trim() ?? ''
}

// Legacy regex helper (still used for PROPFIND calendar listing)
function xmlText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<[^>]*:?${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}


export function buildIcs(event: Omit<CalendarEvent, 'calendarHref' | 'etag'>): string {
  // DTSTAMP always UTC datetime; date-only format for all-day DTSTART/DTEND
  const fmtUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const fmtDate = (d: Date) => {
    // Use local date parts to avoid timezone-shift (YYYY-MM-DD → YYYYMMDD)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}${m}${day}`
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'BEGIN:VEVENT',
    `UID:${event.seriesUid ?? event.uid}`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    event.allDay ? `DTSTART;VALUE=DATE:${fmtDate(event.start)}` : `DTSTART:${fmtUtc(event.start)}`,
    event.allDay ? `DTEND;VALUE=DATE:${fmtDate(event.end)}` : `DTEND:${fmtUtc(event.end)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ]
  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`)
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`)
  if (event.color) lines.push(`COLOR:${event.color}`)
  if (event.rrule) lines.push(`RRULE:${event.rrule}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

// Expansion window for recurring events (years back and forward from now)
const EXPAND_YEARS = 2

export function parseEvents(icsText: string, calendarHref: string, etag?: string): CalendarEvent[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jcal: any
  try {
    jcal = ICAL.parse(icsText)
  } catch {
    return []
  }

  const comp = new ICAL.Component(jcal)
  const vevents = comp.getAllSubcomponents('vevent')
  const results: CalendarEvent[] = []

  for (const vevent of vevents) {
    try {
      const ev = new ICAL.Event(vevent)
      const color = vevent.getFirstPropertyValue('color') as string | undefined

      if (ev.isRecurring()) {
        const now = Date.now()
        const rangeStart = ICAL.Time.fromJSDate(
          new Date(now - EXPAND_YEARS * 365 * 24 * 3600 * 1000),
          true,
        )
        const rangeEnd = ICAL.Time.fromJSDate(
          new Date(now + EXPAND_YEARS * 365 * 24 * 3600 * 1000),
          true,
        )
        const rruleStr = vevent.getFirstProperty('rrule')?.getFirstValue()?.toString() ?? undefined
        const iterator = ev.iterator()
        let next: ICAL.Time | null
        let inRange = 0
        let total = 0
        while ((next = iterator.next()) && total < 50000) {
          total++
          if (next.compare(rangeEnd) > 0) break
          if (next.compare(rangeStart) < 0) continue
          if (inRange++ >= 500) break
          const occurrence = ev.getOccurrenceDetails(next)
          const allDay = occurrence.startDate.isDate
          results.push({
            uid: `${ev.uid}_${next.toUnixTime()}`,
            seriesUid: ev.uid,
            title: ev.summary || '(no title)',
            start: occurrence.startDate.toJSDate(),
            end: occurrence.endDate.toJSDate(),
            allDay,
            description: ev.description || undefined,
            location: ev.location || undefined,
            color,
            rrule: rruleStr,
            calendarHref,
            etag,
          })
        }
      } else {
        const dtstart = ev.startDate
        const dtend = ev.endDate
        const allDay = dtstart.isDate
        results.push({
          uid: ev.uid,
          title: ev.summary || '(no title)',
          start: dtstart.toJSDate(),
          end: dtend.toJSDate(),
          allDay,
          description: ev.description || undefined,
          location: ev.location || undefined,
          color,
          rrule: vevent.getFirstProperty('rrule')?.getFirstValue()?.toString(),
          calendarHref,
          etag,
        })
      }
    } catch {
      // skip malformed events
    }
  }

  return results
}

// ---------- CalDAV client ----------

export class CalDavClient {
  private baseUrl: string
  private authHeader: string

  constructor(serverUrl: string, pathId: string, authUsername: string, appToken: string) {
    this.baseUrl = `${serverUrl.replace(/\/$/, '')}/caldav/${encodeURIComponent(pathId)}/`
    this.authHeader = `Basic ${btoa(`${authUsername}:${appToken}`)}`
  }

  private async request(
    method: string,
    url: string,
    body?: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      ...extraHeaders,
    }
    if (body && !headers['Content-Type']) headers['Content-Type'] = 'text/calendar; charset=utf-8'

    const res = await fetch(url, { method, headers, body })
    if (!res.ok && res.status !== 207) {
      throw new Error(`CalDAV ${method} ${url} → ${res.status} ${res.statusText}`)
    }
    return res
  }

  // PROPFIND: discover calendars
  async listCalendars(): Promise<Calendar[]> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:oc="http://owncloud.org/ns">
  <prop>
    <resourcetype/>
    <displayname/>
    <cs:getctag/>
    <oc:calendar-color/>
    <c:supported-calendar-component-set/>
  </prop>
</propfind>`

    const res = await this.request('PROPFIND', this.baseUrl, body, {
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: '1',
    })

    const xml = await res.text()
    const calendars: Calendar[] = []

    // parse <response> blocks
    const responseBlocks = xml.match(/<[^>]*:?response[^>]*>[\s\S]*?<\/[^>]*:?response>/gi) || []
    for (const block of responseBlocks) {
      const href = xmlText(block, 'href')
      if (!href || href === new URL(this.baseUrl).pathname) continue

      // only include proper CalDAV calendar collections (resourcetype contains "calendar")
      if (!block.match(/<[^>]*:?calendar\s*\/>/i)) continue

      const displayName = xmlText(block, 'displayname') || href.split('/').filter(Boolean).pop() || 'Calendar'
      const color = xmlText(block, 'calendar-color') || undefined
      const ctag = xmlText(block, 'getctag') || undefined

      const fullHref = href.startsWith('http') ? href : `${new URL(this.baseUrl).origin}${href}`
      calendars.push({ href: fullHref, displayName, color, ctag })
    }

    return calendars
  }

  // REPORT: fetch all events (no server-side time filter — more reliable with Radicale)
  async fetchEvents(calendarHref: string, _from: Date, _to: Date): Promise<CalendarEvent[]> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<calendar-query xmlns="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop>
    <d:getetag/>
    <calendar-data/>
  </d:prop>
  <filter>
    <comp-filter name="VCALENDAR">
      <comp-filter name="VEVENT"/>
    </comp-filter>
  </filter>
</calendar-query>`

    const res = await this.request('REPORT', calendarHref, body, {
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: '1',
    })

    const xml = await res.text()
    const doc = parseXml(xml)
    const responses = Array.from(doc.getElementsByTagNameNS('DAV:', 'response'))
    const events: CalendarEvent[] = []

    for (const response of responses) {
      const href = getTagText(response, 'href')
      if (!href || !href.endsWith('.ics')) continue

      const etag = getTagText(response, 'getetag').replace(/"/g, '')
      const icsData = getTagText(response, 'calendar-data')
      if (!icsData) continue

      const fullHref = href.startsWith('http') ? href : `${new URL(calendarHref).origin}${href}`
      const parsed = parseEvents(icsData, fullHref, etag)
      events.push(...parsed)
    }

    return events
  }

  // PUT: create or update an event; returns the new etag from the server.
  // No If-Match on PUT — Radicale ETag formats can differ between REPORT and PUT,
  // causing spurious 412s. If-Match is still used on DELETE where it matters most.
  async saveEvent(event: CalendarEvent): Promise<string | undefined> {
    const ics = buildIcs(event)
    const res = await this.request('PUT', event.calendarHref, ics)
    return res.headers.get('ETag')?.replace(/"/g, '') ?? undefined
  }

  // MKCALENDAR: create a new calendar collection
  async createCalendar(name: string, color: string): Promise<Calendar> {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'calendar'
    const href = `${this.baseUrl}${slug}/`
    const body = `<?xml version="1.0" encoding="utf-8"?>
<mkcalendar xmlns="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:set>
    <d:prop>
      <d:displayname>${escapeXml(name.trim())}</d:displayname>
      <oc:calendar-color>${escapeXml(color)}</oc:calendar-color>
    </d:prop>
  </d:set>
</mkcalendar>`
    await this.request('MKCALENDAR', href, body, { 'Content-Type': 'application/xml; charset=utf-8' })
    return { href, displayName: name.trim(), color }
  }

  // GET + patch fields + PUT back — preserves properties we don't explicitly overwrite.
  // Used when editing a recurring event series.
  async patchRecurringEvent(
    href: string,
    fields: {
      title: string
      description?: string
      location?: string
      start?: Date
      end?: Date
      allDay?: boolean
      rrule?: string
    },
  ): Promise<string | undefined> {
    const getRes = await this.request('GET', href)
    const icsText = await getRes.text()

    let jcal: unknown
    try {
      jcal = ICAL.parse(icsText)
    } catch {
      throw new Error('Failed to parse existing calendar data')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = new ICAL.Component(jcal as any)
    const vevent = comp.getFirstSubcomponent('vevent')
    if (!vevent) throw new Error('No VEVENT found in calendar data')

    vevent.updatePropertyWithValue('summary', fields.title)
    vevent.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true))

    if (fields.description) {
      vevent.updatePropertyWithValue('description', fields.description)
    } else {
      vevent.removeProperty('description')
    }
    if (fields.location) {
      vevent.updatePropertyWithValue('location', fields.location)
    } else {
      vevent.removeProperty('location')
    }

    if (fields.start !== undefined && fields.end !== undefined) {
      if (fields.allDay) {
        const fmtDate = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        vevent.updatePropertyWithValue('dtstart', ICAL.Time.fromDateString(fmtDate(fields.start)))
        vevent.updatePropertyWithValue('dtend', ICAL.Time.fromDateString(fmtDate(fields.end)))
      } else {
        vevent.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(fields.start, true))
        vevent.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(fields.end, true))
      }
    }

    if (fields.rrule) {
      vevent.updatePropertyWithValue('rrule', ICAL.Recur.fromString(fields.rrule))
    } else if (fields.rrule === '') {
      vevent.removeProperty('rrule')
    }
    // fields.rrule === undefined → leave RRULE unchanged

    const modifiedIcs = comp.toString()
    const putRes = await this.request('PUT', href, modifiedIcs)
    return putRes.headers.get('ETag')?.replace(/"/g, '') ?? undefined
  }

  // PROPPATCH: rename a calendar collection
  async renameCalendar(href: string, newName: string): Promise<void> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<d:propertyupdate xmlns:d="DAV:">
  <d:set>
    <d:prop>
      <d:displayname>${escapeXml(newName.trim())}</d:displayname>
    </d:prop>
  </d:set>
</d:propertyupdate>`
    await this.request('PROPPATCH', href, body, { 'Content-Type': 'application/xml; charset=utf-8' })
  }

  // Build URL for a new event in a given calendar
  newEventHref(calendarHref: string, uid: string): string {
    return `${calendarHref.replace(/\/$/, '')}/${uid}.ics`
  }

  // DELETE: remove an event (or entire recurring series)
  async deleteEvent(event: CalendarEvent): Promise<void> {
    const headers: Record<string, string> = {}
    if (event.etag) headers['If-Match'] = `"${event.etag}"`
    await this.request('DELETE', event.calendarHref, undefined, headers)
  }

  // Add EXDATE to master ICS to exclude a single occurrence without touching the rest of the series.
  async deleteOccurrence(href: string, occurrenceStart: Date, allDay: boolean): Promise<void> {
    const getRes = await this.request('GET', href)
    const icsText = await getRes.text()

    let jcal: unknown
    try {
      jcal = ICAL.parse(icsText)
    } catch {
      throw new Error('Failed to parse existing calendar data')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = new ICAL.Component(jcal as any)
    const vevent = comp.getFirstSubcomponent('vevent')
    if (!vevent) throw new Error('No VEVENT found in calendar data')

    let exdate: ICAL.Time
    if (allDay) {
      const y = occurrenceStart.getFullYear()
      const m = String(occurrenceStart.getMonth() + 1).padStart(2, '0')
      const d = String(occurrenceStart.getDate()).padStart(2, '0')
      exdate = ICAL.Time.fromDateString(`${y}-${m}-${d}`)
    } else {
      exdate = ICAL.Time.fromJSDate(occurrenceStart, true)
    }

    vevent.addPropertyWithValue('exdate', exdate)

    const modifiedIcs = comp.toString()
    await this.request('PUT', href, modifiedIcs)
  }
}
