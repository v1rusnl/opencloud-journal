// `webcal://` is the conventional scheme for calendar subscriptions: Android
// offers it to a subscription app such as ICSx⁵ and iOS prompts to subscribe,
// whereas an https link is just a web link — the browser opens it and shows raw
// iCalendar text, which helps nobody.
//
// Subscriptions are always stored with http(s), because that is what fetch()
// needs; the scheme swap exists purely for handing the feed to another device.
export function toWebcalUrl(url: string): string {
  return url.replace(/^https?:\/\//i, 'webcal://')
}

// Google hands out feed URLs under www.google.com, which answers 302 and no
// body, redirecting to calendar.google.com. The app never noticed because the
// ICS proxy follows redirects — but a subscription app on a phone may not, and
// then the calendar is added and stays empty.
//
// Both hosts serve the same resource, so pointing straight at the target is
// safe and spares every consumer the extra hop.
export function canonicalFeedUrl(url: string): string {
  return url.replace(
    /^(https?:\/\/)www\.google\.com\/calendar\/ical\//i,
    '$1calendar.google.com/calendar/ical/',
  )
}
