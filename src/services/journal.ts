import ICAL from 'ical.js'
import { PRODID } from '@/constants'

export type EntryType = 'journal' | 'note' | 'task'

export interface JournalCollection {
  href: string
  displayName: string
  color?: string
  ctag?: string
  components: string[]
}

export interface JournalEntry {
  uid: string
  type: EntryType
  title: string
  description: string
  /** DTSTART for journals/tasks. Notes intentionally have no date. */
  date?: Date
  /** DUE for VTODO entries. */
  due?: Date
  categories: string[]
  status?: string
  percentComplete?: number
  priority?: number
  collectionHref: string
  resourceHref: string
  /** Raw HTTP ETag, including quotes / W/ prefix when supplied by the server. */
  etag?: string
  created?: Date
  lastModified?: Date
  /** Original server payload so updates can preserve jtxBoard/DAVx5-specific properties. */
  rawIcs?: string
}

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml')
}

function getTagText(el: Element, localName: string): string {
  const found = el.getElementsByTagNameNS('*', localName)[0] ?? el.querySelector(localName)
  return found?.textContent?.trim() ?? ''
}

function xmlText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<[^>]*:?${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*:?${tag}>`, 'i'))
  return m ? m[1].trim() : ''
}

function normalizeEtag(value: string | null | undefined): string | undefined {
  const etag = value?.trim()
  return etag || undefined
}

function absoluteHref(baseHref: string, href: string): string {
  return new URL(href, baseHref).toString()
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function formatUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function timeToDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toJSDate' in value && typeof (value as { toJSDate: () => Date }).toJSDate === 'function') {
    return (value as { toJSDate: () => Date }).toJSDate()
  }
  return undefined
}

function numericProperty(component: ICAL.Component, name: string): number | undefined {
  const raw = component.getFirstPropertyValue(name)
  if (raw === null || raw === undefined || raw === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

export function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function patchExistingIcs(entry: Pick<JournalEntry, 'uid' | 'type' | 'title' | 'description' | 'date' | 'due' | 'categories' | 'status' | 'percentComplete' | 'priority' | 'rawIcs'>): string | null {
  if (!entry.rawIcs) return null
  const expected = entry.type === 'task' ? 'VTODO' : 'VJOURNAL'
  // Unfold first so a removed DESCRIPTION/SUMMARY cannot leave continuation lines behind.
  const lines = entry.rawIcs.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const begin = lines.findIndex(line => line.toUpperCase() === `BEGIN:${expected}`)
  const end = lines.findIndex((line, idx) => idx > begin && line.toUpperCase() === `END:${expected}`)
  if (begin < 0 || end < 0) return null

  const replaceNames = new Set(['DTSTAMP', 'DTSTART', 'DUE', 'SUMMARY', 'DESCRIPTION', 'CATEGORIES', 'STATUS', 'PERCENT-COMPLETE', 'PRIORITY'])
  const kept = lines.slice(begin + 1, end).filter(line => {
    const name = line.split(/[;:]/, 1)[0].toUpperCase()
    return !replaceNames.has(name)
  })
  const now = new Date()
  const managed = [`DTSTAMP:${formatUtc(now)}`]
  if (entry.type === 'journal' && entry.date) managed.push(`DTSTART;VALUE=DATE:${formatDate(entry.date)}`)
  if (entry.type === 'task' && entry.date) managed.push(`DTSTART;VALUE=DATE:${formatDate(entry.date)}`)
  if (entry.type === 'task' && entry.due) managed.push(`DUE;VALUE=DATE:${formatDate(entry.due)}`)
  if (entry.title) managed.push(`SUMMARY:${escapeIcs(entry.title)}`)
  if (entry.description) managed.push(`DESCRIPTION:${escapeIcs(entry.description)}`)
  if (entry.categories.length) managed.push(`CATEGORIES:${entry.categories.map(escapeIcs).join(',')}`)
  if (entry.type === 'task') {
    managed.push(`STATUS:${entry.status || 'NEEDS-ACTION'}`)
    if (entry.percentComplete !== undefined) managed.push(`PERCENT-COMPLETE:${Math.max(0, Math.min(100, Math.round(entry.percentComplete)))}`)
    if (entry.priority !== undefined) managed.push(`PRIORITY:${Math.max(0, Math.min(9, Math.round(entry.priority)))}`)
  } else if (entry.status) {
    managed.push(`STATUS:${entry.status}`)
  }

  return [...lines.slice(0, begin + 1), ...managed, ...kept, ...lines.slice(end)].filter((line, idx, arr) => !(idx === arr.length - 1 && line === '')).join('\r\n') + '\r\n'
}

export function buildEntryIcs(entry: Pick<JournalEntry, 'uid' | 'type' | 'title' | 'description' | 'date' | 'due' | 'categories' | 'status' | 'percentComplete' | 'priority' | 'rawIcs'>): string {
  const patched = patchExistingIcs(entry)
  if (patched) return patched
  const now = new Date()
  const componentName = entry.type === 'task' ? 'VTODO' : 'VJOURNAL'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `BEGIN:${componentName}`,
    `UID:${entry.uid}`,
    `DTSTAMP:${formatUtc(now)}`,
    `CREATED:${formatUtc(now)}`,
  ]

  // jtxBoard distinguishes journals and notes by DTSTART: journal = dated VJOURNAL,
  // note = VJOURNAL without DTSTART.
  if (entry.type === 'journal' && entry.date) lines.push(`DTSTART;VALUE=DATE:${formatDate(entry.date)}`)
  if (entry.type === 'task' && entry.date) lines.push(`DTSTART;VALUE=DATE:${formatDate(entry.date)}`)
  if (entry.type === 'task' && entry.due) lines.push(`DUE;VALUE=DATE:${formatDate(entry.due)}`)

  if (entry.title) lines.push(`SUMMARY:${escapeIcs(entry.title)}`)
  if (entry.description) lines.push(`DESCRIPTION:${escapeIcs(entry.description)}`)
  if (entry.categories.length) lines.push(`CATEGORIES:${entry.categories.map(escapeIcs).join(',')}`)

  if (entry.type === 'task') {
    lines.push(`STATUS:${entry.status || 'NEEDS-ACTION'}`)
    if (entry.percentComplete !== undefined) lines.push(`PERCENT-COMPLETE:${Math.max(0, Math.min(100, Math.round(entry.percentComplete)))}`)
    if (entry.priority !== undefined) lines.push(`PRIORITY:${Math.max(0, Math.min(9, Math.round(entry.priority)))}`)
  } else if (entry.status) {
    lines.push(`STATUS:${entry.status}`)
  }

  lines.push(`END:${componentName}`, 'END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

/** Backwards-compatible helper used by older tests/integrations. */
export function buildJournalIcs(entry: Pick<JournalEntry, 'uid' | 'title' | 'description' | 'date' | 'categories' | 'status'>): string {
  return buildEntryIcs({ ...entry, type: 'journal' })
}

function categoriesFrom(component: ICAL.Component): string[] {
  return component.getAllProperties('categories')
    .flatMap(prop => prop.getValues().flatMap(v => Array.isArray(v) ? v : [v]))
    .map(v => String(v).trim())
    .filter(Boolean)
}

export function parseEntries(icsText: string, resourceHref: string, collectionHref: string, etag?: string): JournalEntry[] {
  let jcal: unknown
  try {
    jcal = ICAL.parse(icsText)
  } catch {
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = new ICAL.Component(jcal as any)
  const result: JournalEntry[] = []

  for (const componentName of ['vjournal', 'vtodo'] as const) {
    for (const component of root.getAllSubcomponents(componentName)) {
      try {
        const uid = String(component.getFirstPropertyValue('uid') ?? '')
        if (!uid) continue
        const dtstart = timeToDate(component.getFirstPropertyValue('dtstart'))
        const type: EntryType = componentName === 'vtodo' ? 'task' : (dtstart ? 'journal' : 'note')
        const statusValue = component.getFirstPropertyValue('status')
        result.push({
          uid,
          type,
          title: String(component.getFirstPropertyValue('summary') ?? ''),
          description: String(component.getFirstPropertyValue('description') ?? ''),
          date: dtstart,
          due: componentName === 'vtodo' ? timeToDate(component.getFirstPropertyValue('due')) : undefined,
          categories: categoriesFrom(component),
          status: statusValue ? String(statusValue) : undefined,
          percentComplete: componentName === 'vtodo' ? numericProperty(component, 'percent-complete') : undefined,
          priority: componentName === 'vtodo' ? numericProperty(component, 'priority') : undefined,
          collectionHref,
          resourceHref,
          etag: normalizeEtag(etag),
          created: timeToDate(component.getFirstPropertyValue('created')),
          lastModified: timeToDate(component.getFirstPropertyValue('last-modified')),
          rawIcs: icsText,
        })
      } catch {
        // Keep other components usable when one object contains malformed data.
      }
    }
  }
  return result
}

export function parseJournals(icsText: string, resourceHref: string, collectionHref: string, etag?: string): JournalEntry[] {
  return parseEntries(icsText, resourceHref, collectionHref, etag).filter(entry => entry.type !== 'task')
}

export class JournalDavClient {
  private baseUrl: string
  private authHeader: string

  constructor(serverUrl: string, pathId: string, authUsername: string, appToken: string) {
    this.baseUrl = `${serverUrl.replace(/\/$/, '')}/caldav/${encodeURIComponent(pathId)}/`
    this.authHeader = `Basic ${btoa(`${authUsername}:${appToken}`)}`
  }

  private async request(method: string, url: string, body?: string, extraHeaders: Record<string, string> = {}, allow404 = false): Promise<Response> {
    const headers: Record<string, string> = { Authorization: this.authHeader, ...extraHeaders }
    if (body && !headers['Content-Type']) headers['Content-Type'] = 'text/calendar; charset=utf-8'
    const res = await fetch(url, { method, headers, body })
    if (!res.ok && res.status !== 207 && !(allow404 && res.status === 404)) {
      const suffix = res.status === 412 ? ' (resource changed on the server)' : ''
      throw new Error(`CalDAV ${method} ${url} → ${res.status} ${res.statusText}${suffix}`)
    }
    return res
  }

  async listCollections(): Promise<JournalCollection[]> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:oc="http://owncloud.org/ns">
  <prop><resourcetype/><displayname/><cs:getctag/><oc:calendar-color/><c:supported-calendar-component-set/></prop>
</propfind>`
    const res = await this.request('PROPFIND', this.baseUrl, body, { 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' })
    const xml = await res.text()
    const doc = parseXml(xml)
    const responses = Array.from(doc.getElementsByTagNameNS('DAV:', 'response'))
    const collections: JournalCollection[] = []

    for (const response of responses) {
      const href = getTagText(response, 'href')
      if (!href || absoluteHref(this.baseUrl, href).replace(/\/$/, '') === this.baseUrl.replace(/\/$/, '')) continue
      const resourceTypes = Array.from(response.getElementsByTagNameNS('DAV:', 'resourcetype')[0]?.children ?? [])
      if (!resourceTypes.some(el => el.localName === 'calendar')) continue
      const componentSet = response.getElementsByTagNameNS('urn:ietf:params:xml:ns:caldav', 'supported-calendar-component-set')[0]
      const components = componentSet
        ? Array.from(componentSet.getElementsByTagNameNS('urn:ietf:params:xml:ns:caldav', 'comp')).map(el => (el.getAttribute('name') || '').toUpperCase()).filter(Boolean)
        : []
      collections.push({
        href: absoluteHref(this.baseUrl, href),
        displayName: getTagText(response, 'displayname') || href.split('/').filter(Boolean).pop() || 'Journal',
        color: getTagText(response, 'calendar-color') || undefined,
        ctag: getTagText(response, 'getctag') || undefined,
        components,
      })
    }
    return collections
  }

  private async reportComponent(collectionHref: string, componentName: 'VJOURNAL' | 'VTODO'): Promise<JournalEntry[]> {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<calendar-query xmlns="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:prop><d:getetag/><calendar-data/></d:prop>
  <filter><comp-filter name="VCALENDAR"><comp-filter name="${componentName}"/></comp-filter></filter>
</calendar-query>`
    const res = await this.request('REPORT', collectionHref, body, { 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' })
    const xml = await res.text()
    const doc = parseXml(xml)
    const responses = Array.from(doc.getElementsByTagNameNS('DAV:', 'response'))
    const entries: JournalEntry[] = []
    for (const response of responses) {
      const href = getTagText(response, 'href')
      if (!href || !href.toLowerCase().includes('.ics')) continue
      const icsData = getTagText(response, 'calendar-data')
      if (!icsData) continue
      const fullHref = absoluteHref(collectionHref, href)
      const rawEtag = getTagText(response, 'getetag')
      entries.push(...parseEntries(icsData, fullHref, collectionHref, rawEtag))
    }
    return entries.filter(entry => componentName === 'VTODO' ? entry.type === 'task' : entry.type !== 'task')
  }

  async fetchEntries(collection: JournalCollection): Promise<JournalEntry[]> {
    const entries: JournalEntry[] = []
    const supports = (name: string) => !collection.components.length || collection.components.includes(name)
    if (supports('VJOURNAL')) entries.push(...await this.reportComponent(collection.href, 'VJOURNAL'))
    if (supports('VTODO')) entries.push(...await this.reportComponent(collection.href, 'VTODO'))
    return entries
  }

  async fetchJournals(collectionHref: string): Promise<JournalEntry[]> {
    return this.reportComponent(collectionHref, 'VJOURNAL')
  }

  newEntryHref(collectionHref: string, uid: string): string {
    return `${collectionHref.replace(/\/$/, '')}/${uid}.ics`
  }

  newJournalHref(collectionHref: string, uid: string): string {
    return this.newEntryHref(collectionHref, uid)
  }

  async createEntry(entry: JournalEntry): Promise<string | undefined> {
    const res = await this.request('PUT', entry.resourceHref, buildEntryIcs(entry), { 'If-None-Match': '*' })
    return normalizeEtag(res.headers.get('ETag'))
  }

  async createJournal(entry: JournalEntry): Promise<string | undefined> {
    return this.createEntry(entry)
  }

  async updateEntry(entry: JournalEntry): Promise<string | undefined> {
    const headers: Record<string, string> = {}
    if (entry.etag) headers['If-Match'] = entry.etag
    const res = await this.request('PUT', entry.resourceHref, buildEntryIcs(entry), headers)
    return normalizeEtag(res.headers.get('ETag'))
  }

  async updateJournal(entry: JournalEntry): Promise<string | undefined> {
    return this.updateEntry(entry)
  }

  /**
   * Resolve the current server ETag immediately before DELETE. This matters for
   * DAVx5/jtxBoard resources, which can be touched by a sync between page load
   * and the user's delete action. Weak ETags are deliberately kept verbatim.
   */
  private async currentEtag(resourceHref: string): Promise<string | undefined | null> {
    const res = await this.request('GET', resourceHref, undefined, { Accept: 'text/calendar' }, true)
    if (res.status === 404) return null
    return normalizeEtag(res.headers.get('ETag'))
  }

  async deleteEntry(entry: JournalEntry): Promise<void> {
    const current = await this.currentEtag(entry.resourceHref)
    if (current === null) return
    const headers: Record<string, string> = {}
    const etag = current || entry.etag
    // HTTP If-Match uses strong comparison; a weak W/ ETag can never match.
    // After the fresh GET above, omit If-Match for weak ETags instead of sending an invalid precondition.
    if (etag && !etag.startsWith('W/')) headers['If-Match'] = etag
    const res = await this.request('DELETE', entry.resourceHref, undefined, headers, true)
    if (res.status === 404) return
  }

  async deleteJournal(entry: JournalEntry): Promise<void> {
    return this.deleteEntry(entry)
  }

  async createCollection(name: string): Promise<JournalCollection> {
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'journal'
    const href = `${this.baseUrl}${slug}/`
    const body = `<?xml version="1.0" encoding="utf-8"?>
<mkcalendar xmlns="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:">
  <d:set><d:prop><d:displayname>${escapeXml(name.trim())}</d:displayname><supported-calendar-component-set><comp name="VJOURNAL"/><comp name="VTODO"/></supported-calendar-component-set></d:prop></d:set>
</mkcalendar>`
    await this.request('MKCALENDAR', href, body, { 'Content-Type': 'application/xml; charset=utf-8' })
    return { href, displayName: name.trim(), components: ['VJOURNAL', 'VTODO'] }
  }
}
