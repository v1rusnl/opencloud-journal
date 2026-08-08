import { describe, it, expect } from 'vitest'
import { buildEntryIcs, buildJournalIcs, detectImageMimeType, escapeIcs, parseEntries, parseJournals } from './journal'

describe('journal / note / task ICS', () => {
  it('escapes iCalendar text', () => {
    expect(escapeIcs('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne')
  })

  it('builds a dated VJOURNAL for jtxBoard Journal', () => {
    const ics = buildJournalIcs({
      uid: 'journal-1', title: 'Day one', description: 'Hello',
      date: new Date(2026, 7, 7), categories: ['Work', 'Ideas'], status: 'DRAFT',
    })
    expect(ics).toContain('BEGIN:VJOURNAL')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260807')
    expect(ics).toContain('SUMMARY:Day one')
    expect(ics).toMatch(/CREATED:\d{8}T\d{6}Z/)
  })

  it('builds a VJOURNAL without DTSTART for a jtxBoard Note', () => {
    const ics = buildEntryIcs({
      uid: 'note-1', type: 'note', title: 'A note', description: 'Text',
      categories: [], date: undefined, due: undefined, status: undefined,
      percentComplete: undefined, priority: undefined, attachments: [],
    })
    expect(ics).toContain('BEGIN:VJOURNAL')
    expect(ics).not.toContain('DTSTART')
  })

  it('builds a VTODO for a jtxBoard Task', () => {
    const ics = buildEntryIcs({
      uid: 'task-1', type: 'task', title: 'Do it', description: '', categories: ['Work'],
      date: undefined, due: new Date(2026, 7, 10), status: 'NEEDS-ACTION', percentComplete: 0, priority: 5, attachments: [],
    })
    expect(ics).toContain('BEGIN:VTODO')
    expect(ics).toContain('DUE;VALUE=DATE:20260810')
    expect(ics).toContain('STATUS:NEEDS-ACTION')
    expect(ics).toContain('PERCENT-COMPLETE:0')
    expect(ics).toContain('PRIORITY:5')
  })

  it('classifies dated/undated VJOURNAL and VTODO', () => {
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN',
      'BEGIN:VJOURNAL', 'UID:j1', 'DTSTART;VALUE=DATE:20260806', 'SUMMARY:Journal', 'END:VJOURNAL',
      'BEGIN:VJOURNAL', 'UID:n1', 'SUMMARY:Note', 'END:VJOURNAL',
      'BEGIN:VTODO', 'UID:t1', 'SUMMARY:Task', 'DUE;VALUE=DATE:20260810', 'STATUS:NEEDS-ACTION', 'END:VTODO',
      'END:VCALENDAR', '',
    ].join('\r\n')
    const entries = parseEntries(ics, 'https://example.test/items.ics', 'https://example.test/jtx/', 'W/"abc"')
    expect(entries.map(e => e.type)).toEqual(['journal', 'note', 'task'])
    expect(entries[2].due).toBeInstanceOf(Date)
    expect(entries[0].etag).toBe('W/"abc"')
    expect(parseJournals(ics, 'r', 'c')).toHaveLength(2)
  })
  it('preserves unknown jtxBoard properties when editing an existing entry', () => {
    const rawIcs = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//jtx Board//EN', 'BEGIN:VTODO',
      'UID:t2', 'SUMMARY:Old', 'X-JTX-CUSTOM:keep-me', 'RELATED-TO:parent-1', 'END:VTODO', 'END:VCALENDAR', '',
    ].join('\r\n')
    const ics = buildEntryIcs({
      uid: 't2', type: 'task', title: 'New', description: '', categories: [], date: undefined,
      due: undefined, status: 'NEEDS-ACTION', percentComplete: 0, priority: 0, attachments: [], rawIcs,
    })
    expect(ics).toContain('SUMMARY:New')
    expect(ics).toContain('X-JTX-CUSTOM:keep-me')
    expect(ics).toContain('RELATED-TO:parent-1')
    expect(ics).not.toContain('SUMMARY:Old')
  })

  it('detects PNG, JPEG and WebP by magic bytes', () => {
    expect(detectImageMimeType('iVBORw0KGgoAAAANSUhEUg==')).toBe('image/png')
    expect(detectImageMimeType('/9j/4AAQSkZJRg==')).toBe('image/jpeg')
    expect(detectImageMimeType('UklGRgQAAABXRUJQ')).toBe('image/webp')
  })

  it('parses jtxBoard base64 image attachments and prefers actual image type', () => {
    const png = 'iVBORw0KGgoAAAANSUhEUg=='
    const rawIcs = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:+//IDN techbee.at//jtx Board',
      'BEGIN:VJOURNAL', 'UID:a1', 'SUMMARY:Photo',
      `ATTACH;ENCODING=BASE64;VALUE=BINARY;FMTTYPE=image/jpeg;X-LABEL=photo.jpg;FILENAME=photo.jpg:${png}`,
      'END:VJOURNAL', 'END:VCALENDAR', '',
    ].join('\r\n')
    const [entry] = parseEntries(rawIcs, 'r', 'c')
    expect(entry.attachments).toHaveLength(1)
    expect(entry.attachments[0].filename).toBe('photo.jpg')
    expect(entry.attachments[0].mimeType).toBe('image/png')
  })

  it('rewrites managed image attachments and preserves unrelated properties', () => {
    const rawIcs = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', 'BEGIN:VJOURNAL',
      'UID:a2', 'SUMMARY:Old',
      'ATTACH;ENCODING=BASE64;VALUE=BINARY;FMTTYPE=image/png;FILENAME=old.png:iVBORw0KGgoAAAANSUhEUg==',
      'X-CUSTOM:keep', 'END:VJOURNAL', 'END:VCALENDAR', '',
    ].join('\r\n')
    const ics = buildEntryIcs({
      uid: 'a2', type: 'note', title: 'New', description: '', categories: [], date: undefined,
      due: undefined, status: undefined, percentComplete: undefined, priority: undefined,
      attachments: [{ id: 'new', filename: 'new.webp', mimeType: 'image/webp', base64: 'UklGRgQAAABXRUJQ' }],
      rawIcs,
    })
    expect(ics).not.toContain('old.png')
    expect(ics).toContain('new.webp')
    expect(ics).toContain('FMTTYPE=image/webp')
    expect(ics).toContain('X-CUSTOM:keep')
  })

})
