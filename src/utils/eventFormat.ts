// Human-readable date/time range for the hover tooltip.

export interface EventTimes {
  start: Date
  end: Date
  allDay: boolean
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

// Shifts by whole calendar days. Adding or subtracting 24 h in milliseconds
// lands on the wrong date across a DST change: on the spring-forward day a
// local midnight is only 23 h after the previous one.
export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function formatEventRange(ev: EventTimes, locale: string): string {
  const fmtDate = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const fmtTime = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })

  if (ev.allDay) {
    // iCal DTEND is exclusive for all-day events — show the last day it covers,
    // matching allDayEndForDisplay() in EventDialog.vue.
    const lastDay = addDays(ev.end, -1)
    return sameDay(ev.start, lastDay)
      ? fmtDate.format(ev.start)
      : `${fmtDate.format(ev.start)} – ${fmtDate.format(lastDay)}`
  }

  return sameDay(ev.start, ev.end)
    ? `${fmtDate.format(ev.start)}, ${fmtTime.format(ev.start)} – ${fmtTime.format(ev.end)}`
    : `${fmtDate.format(ev.start)}, ${fmtTime.format(ev.start)} – ${fmtDate.format(ev.end)}, ${fmtTime.format(ev.end)}`
}
