## 0.3.2

- Added a paperclip indicator next to the pin icon for entries that contain one or more image attachments.

## 0.3.1

- Reworked the image lightbox into a zoomable image viewer.
- Mouse wheel zoom from 25% to 500%.
- Added zoom in/out buttons and a live percentage indicator.
- Added a Fit button to return to fit-to-screen mode.
- Enlarged images can be dragged/panned with the mouse.
- Double-click toggles between fit-to-screen and 100% actual size.
- Keyboard shortcuts: + / - zoom, 0 fits the image, Escape closes, Left/Right switch images.
- Added a built-in lightbox for image attachments.
- Click a thumbnail to open the image in a full-screen preview.
- Added previous/next navigation for entries with multiple images.
- Added keyboard controls: Escape closes, Left/Right switch images.
- Clicking the large image toggles between fit-to-screen and original-size view.
- Added jtxBoard-compatible embedded image attachments for journals, notes and tasks.
- Parses `ATTACH;ENCODING=BASE64;VALUE=BINARY` images.
- Added image previews, image upload and image removal in the editor.
- Supports JPEG/JPG, PNG and WebP.
- Detects the real image format from magic bytes instead of trusting only `FMTTYPE` or the filename.
- Preserves unsupported/non-image ATTACH properties while editing existing entries.

## 0.2.9

- Navigation der Seitenleiste auf Sammlung → Inhaltstyp umgestellt.
- Beim Start werden nur Sammlungen mit ihrer Gesamtzahl angezeigt.
- Ein Klick auf eine Sammlung klappt Alle, Journale, Notizen und Aufgaben samt sammlungsspezifischer Zähler auf.
- Ein erneuter Klick auf die aktive Sammlung klappt sie wieder zu und zeigt wieder alle Einträge.
- Drag & Drop, Pins, Sortierung und CalDAV-Logik bleiben erhalten.

# Changelog


## 0.2.8

- Fixed sidebar type counters: All, Journals, Notes and Tasks now always show totals across all CalDAV collections.
- Collection counters remain contextual to the selected type filter.

## 0.2.7

- Fix collection drag & drop order being reset on every app startup while CalDAV discovery is still loading.

## 0.2.5

- Added drag-and-drop reordering for CalDAV collections in the Journal sidebar.
- The custom collection order is stored locally in the browser and restored on the next visit.
- New collections are appended automatically without changing the saved order of existing collections.
- Bumped app manifest and package version to 0.2.5.

## 0.2.2

- Added a dedicated `book-open` icon for the OpenCloud app menu.
- Bumped app and package version to 0.2.2.

## 0.2.1

- Fix OpenCloud app manifest version so updated frontend assets are reloaded after deployment.
- Keeps the 0.2.0 Journal / Note / Task picker and VTODO support.

# 0.2.0 - 2026-08-07

- Added jtxBoard-style Journal / Note / Task entry picker.
- Added VTODO discovery, display, creation, editing and deletion.
- Classify VJOURNAL without DTSTART as Note and dated VJOURNAL as Journal.
- Added tabs for All, Journals, Notes and Tasks.
- Improved delete synchronization by refreshing ETags immediately before DELETE and preserving raw weak ETags.
- Preserve unknown iCalendar properties from externally created jtxBoard/DAVx5 objects on update.
- New collections advertise both VJOURNAL and VTODO support.


All notable changes to this project will be documented in this file.

## [2.8.0] - 2026-08-06

### Fixed
- **The light theme was unusable** — every component styled itself from `--oc-color-*` variables that OpenCloud 6.x does not define, so all 77 of them silently fell back to hardcoded literals. To compensate, the app carried 20 `@media (prefers-color-scheme: dark)` blocks, which follow the **operating system**. OpenCloud switches its own theme independently, with no class or media query to key on — it swaps `--oc-role-*` custom properties at runtime. OS dark plus OpenCloud light therefore produced a white sidebar around a dark calendar grid
- All colours now come from the real `--oc-role-*` tokens, and every `prefers-color-scheme` block is gone. The app follows whatever theme OpenCloud is set to, including custom ones
- FullCalendar's grid, buttons and today marker are driven from the same tokens through its `--fc-*` variables. The today marker had a hardcoded `!important` brand blue that overrode the variable
- **Native date pickers and selects followed the OS too** — `color-scheme: light dark` hands that choice to the system. It is now derived from the theme's own surface colour and re-evaluated when OpenCloud swaps the properties

### Notes
- Deliberately not themed: the QR tile stays white in both themes (a dark tile swallows the quiet zone and phones stop reading the code), the modal scrims stay translucent black, and the resize grips stay translucent white because they sit on user-chosen calendar colours
- Verified by resolving every background/foreground pair in the built CSS against both themes: 34 combinations, all at or above WCAG AA 4.5:1

### Tests
- 8 tests for `luminance` and `schemeForBackground`, including the actual OpenCloud surface tokens and the empty-string case that occurs when the role tokens are absent

## [2.7.2] - 2026-08-06

### Fixed
- **The event tooltip appeared behind the "+N more" popover** — FullCalendar injects `z-index: 9999` for `.fc-popover` at runtime, above the tooltip's 1100. On a busy day the tooltip was hidden by the very list opened to read those entries. Raised above it

## [2.7.1] - 2026-08-03

### Fixed
- **Google feed URLs are pointed straight at `calendar.google.com`** — Google hands out subscription URLs under `www.google.com`, which answers `302` with no body and redirects. The Agenda never noticed because the ICS proxy follows redirects, but a subscription app on a phone may not: it accepts the subscription and then shows an empty calendar. Applied both when adding a subscription and when sharing one, so existing entries hand out a working URL without being re-added

### Tests
- 6 tests for `canonicalFeedUrl`: both schemes, the percent-encoded calendar id left intact, an already canonical URL untouched, and other Google paths and hosts ignored

## [2.7.0] - 2026-08-03

### Added
- **The share QR now encodes `webcal://`**, with a switch back to `https://` in the dialog. An https QR is just a web link: the phone opens a browser showing raw iCalendar text. `webcal://` is the scheme calendar apps register — Android offers it to a subscription app such as ICSx⁵, iOS prompts to subscribe — so scanning subscribes in one step instead of scan, copy, paste
- The switch exists because a scanner that does not recognise the scheme may offer nothing at all, and the app cannot detect that. https stays one click away

### Fixed
- The QR is rendered into a `<canvas>` element rather than a wrapper `<div>`. `qr-creator` appends a fresh canvas when handed a plain element, so switching schemes would have stacked them
- Copy feedback resets when the scheme is switched, so the button cannot claim "Copied" for the variant no longer on screen

### Notes
- Subscriptions are still stored with `http(s)`, which is what `fetch()` needs; the scheme swap applies only to what is handed to another device

### Tests
- 6 tests for `toWebcalUrl` covering both source schemes, percent-encoding left intact (the Google feed ids carry `%40`), only the leading scheme replaced, and unknown schemes passed through

## [2.6.0] - 2026-08-03

### Added
- **Share a subscription to another device** — clicking a subscription's name in the sidebar opens a dialog with its feed URL, a copy button and a QR code. Scanning it on a phone adds the calendar there directly, in the device's own calendar app. Subscriptions live in OpenCloud's file storage, not in Radicale, so they are invisible to CalDAV clients; subscribing per device is the practical route, and this removes the friction of retyping a 100-character Google URL

### Notes
- Uses `qr-creator` (5 KB gzip, no dependencies, MIT). The CalendarView chunk grows from 117.2 to 123.3 kB gzip (+5.2 %)
- The QR is rendered black on white in both themes: tinting it for dark mode costs contrast and many phone cameras then fail to read it
- `qr-creator` defaults its quiet zone to 0 modules; the spec asks for 4, and without it scanning is unreliable. Set explicitly. A ~110-character feed URL produces a version-7 code — 45 modules, 53 across with the quiet zone — so the 240 px canvas gives 4.5 px per module, well above what phone cameras need
- Copying degrades gracefully: without a secure context `navigator.clipboard` is absent, so the dialog says so and selects the address instead of failing silently

### Tests
- 3 tests for the clipboard helper (success, missing API, rejected write). The rendered QR itself is not covered — verify it once by scanning

## [2.5.1] - 2026-08-03

### Fixed
- **A second tab could silently overwrite subscriptions added elsewhere** — every write replaced the whole list, and `loadFromServer()` never read the ETag, so no write carried a precondition. A tab that had held its list since page load (`load()` only runs on mount or on a user/token change) would write that stale list back on the next toggle, discarding anything another tab or device had added. Writes now send `If-Match`; a `412` is resolved by re-reading, merging with `mergeSubscriptions()` and retrying, up to three times before the change is marked unsynced and reported
- After a conflict is merged, the reconciled list is adopted in the UI instead of leaving the tab showing its pre-merge state

### Notes
- A server that sends no `ETag` gets unconditional writes exactly as before, so the guard cannot break saving on a WebDAV implementation that lacks it

### Tests
- 4 tests against a fake WebDAV file that actually honours `If-Match`: the header is sent once an ETag is known, omitted when the server provides none, a stale write is refused and merged rather than applied, and repeated conflicts give up while keeping the unsynced marker

## [2.5.0] - 2026-08-03

### Fixed
- **A subscription could vanish without trace if its server write failed** — `persist()` only recorded "local state is ahead" when no token was present at all. When a token existed and the `PUT` failed anyway (server restarting, expired token, tab closed inside the 300 ms debounce window), nothing was recorded: no flag, no retry, no message, and `saveToServer()` swallowed the error. The next page load then replaced the local list with the older server copy **and overwrote the localStorage cache with it**, destroying the entry in both places. Observed in the wild: a feed added while the server was restarting was gone the next day
- Failed writes are now recorded in a localStorage marker that survives a reload, and `load()` merges the local and server lists by id instead of replacing one with the other. An entry present on only one side is kept — an unsynced deletion may reappear, which is deliberate: a resurrected entry is one click to remove, a lost feed URL is gone for good
- Failed writes surface as a notification instead of failing silently

### Changed
- `load()` no longer needs to be told that a token just arrived; it decides between merging and replacing from the persisted marker
- Pushing local state to the server no longer discards subscriptions that exist only on the server — previously an offline edit on one device wiped entries added on another

### Tests
- 6 tests covering the reload-survival path, the failure notification, merge semantics, and that a confirmed write lets a deletion made elsewhere stick rather than resurrecting entries forever
- Three existing expectations updated: they encoded the old replace-wins behaviour that discarded server-only entries

## [2.4.2] - 2026-08-02

### Fixed
- **Dialog buttons became unreadable on hover in dark mode** — the light-mode `button:hover` rule was written after the `@media (prefers-color-scheme: dark)` block in `EventDialog` and `CalendarDialog`. A media query adds no specificity, so with equal selector weight the later rule won: the hovered button got a light grey background while its text kept the near-white dark-mode colour. The dark-mode block now comes last in both files

## [2.4.1] - 2026-08-02

### Fixed
- **An event moved to another calendar kept the old calendar's colour** — and not just on screen: `loadEvents()` copied the calendar's colour onto every event object, and `buildIcs()` persists `CalendarEvent.color` as a `COLOR:` property, so the colour was written into the stored `.ics` on the next save. Reloading then read it back and it won over the calendar's own colour, permanently. The calendar colour is no longer copied onto events, and the view derives it from `calendarHref`, so events always take the colour of the calendar they are in
- Events whose `.ics` still carries a stale `COLOR:` from an earlier version now display correctly again — the property is ignored for CalDAV events rather than rewritten, so no other client's data is touched

### Changed
- Language detection consolidated in `useI18n` (`isGerman()`, `localeTag()`) and read at call time; `getFcLocale()` no longer keeps a second copy of the same check

### Tests
- 3 tests for `useCalendar` pinning that the calendar colour never reaches the event object or the generated ICS, while a `COLOR` set by another client is still preserved
- 5 tests for language detection

## [2.4.0] - 2026-08-02

### Added
- **Hover tooltip for events** — hovering any entry shows title, full date/time range, location and description. Subscription events are read-only and open no dialog, so in month view (where titles are truncated) this was previously the missing piece: a Bundesliga fixture showed as "1. FC Union Berl…" with no way to see the opponent

### Fixed
- **All-day events lost a day across the spring DST change** — `EventDialog` displayed the inclusive end date by subtracting 24 h in milliseconds, but a local day is only 23 h long on the spring-forward date. `parseDates()` already added the day back with correct calendar arithmetic, so the asymmetry silently shortened any all-day event spanning that date on save. Day arithmetic is now centralised in `addDays()` (`src/utils/eventFormat.ts`) and used by the dialog, the tooltip and the drag-select handler
- **Subscriptions failed silently when the ICS proxy was misrouted** — an unconfigured `/ics-proxy/` route falls through to the OpenCloud web SPA, which answers HTTP 200 with `index.html`. The status check passed, `ICAL.parse()` threw, and `parseEvents()` swallowed it into an empty array, so the subscription appeared healthy but empty. Feed responses are now validated for a `BEGIN:VCALENDAR` prelude and surface a distinct error in the notification toast

### Security
- **ICS proxy: SSRF** — the documented `server.js` fetched any user-supplied URL from inside the Docker network, exposing internal services (`opencloud:9200`, `keycloak:8080`) and the cloud metadata endpoint (`169.254.169.254`) to any authenticated user. Target hostnames are now resolved and rejected if any answer is a private, loopback, link-local, CGNAT or reserved address, re-checked after every redirect (redirects are followed manually, since `redirect: 'follow'` bypassed the guard)
- **ICS proxy: remote crash** — `decodeURIComponent()` sat outside the try block, so a request to `/ics-proxy/%ZZ` raised an uncaught `URIError` and killed the process
- **ICS proxy: response-type passthrough** — the upstream `Content-Type` was echoed, allowing HTML to be served from the OpenCloud origin. Responses are now pinned to `text/calendar` with `nosniff`, a `default-src 'none'; sandbox` CSP and `Content-Disposition: attachment`
- **ICS proxy: unbounded buffering** — responses were read whole via `arrayBuffer()`. Bodies are now streamed with a 10 MB cap
- Proxy container hardened: non-root user, read-only filesystem, `cap_drop: ALL`, `no-new-privileges`, memory and PID limits, plus a Traefik rate-limit middleware

### Changed
- **ICS proxy setup reworked** — the proxy now lives in its own directory and Compose project outside the OpenCloud compose tree, routed via Traefik labels instead of an entry in `config/opencloud/proxy.yaml`. Updating or rebuilding OpenCloud no longer removes the route

### Tests
- 4 tests for feed content validation: SPA-fallback HTML, non-iCalendar bodies, valid feeds, and feeds prefixed with a UTF-8 BOM
- 16 tests for `eventFormat` covering day arithmetic across both DST boundaries, month/year rollover, and all-day vs. timed range formatting
- `vitest.config.ts` pins `TZ=Europe/Berlin`, without which the DST cases pass vacuously in CI

## [2.3.0] - 2026-07-11

### Added
- **Recurrence intervals** — the event dialog now has an "Every N days/weeks/months/years" field, enabling biweekly schedules like "every 2 weeks on Friday" (`FREQ=WEEKLY;INTERVAL=2;BYDAY=FR`)

### Fixed
- Editing an event whose RRULE contained an `INTERVAL` (e.g. created in Thunderbird) no longer silently drops the interval on save
- `src/manifest.json` version had drifted from `package.json` again (2.1.0 vs 2.2.0) — both set to 2.3.0

## [2.2.0] - 2026-05-12

### Added
- **Subscription error notifications** — fetch errors (e.g. HTTP 410) are now shown as a dismissible notification toast instead of plain text in the sidebar; error messages include a human-readable reason per HTTP status code

### Fixed
- App version in the help dialog is now read directly from `package.json` at build time — no more manual version strings

### CI/CD
- New `deploy-dev.yml` workflow for manual test deployments from Forgejo UI (no tag required)

## [2.1.0] - 2026-05-01

### Added
- **Event overflow in month view** — cells cap at the available height and show a "+N more" link; clicking opens a popover with all events for that day
- **Subscription URL normalization** — the subscription dialog now accepts `webcal://` links (converted to `https://`) and Google Calendar "Add to Calendar" URLs (`?cid=…`); the correct ICS URL is extracted automatically

### Fixed
- Dark mode: the "+N more" day popover now has a proper dark background and readable text
- Subscriptions: `fetchOne()` now discards results if the subscription was deleted or disabled while the feed was loading (stale-write guard)
- Recurring events: drag/drop and resize now immediately reflect the new times on all occurrences in the local state instead of waiting for a full reload
- `patchRecurringEvent()`: passing `fields.rrule = undefined` no longer removes the RRULE; only an explicit empty string triggers removal
- `src/manifest.json` version was out of sync with `package.json` — both now consistently track the release version

### Documentation
- iCal subscriptions marked as experimental in feature list
- New "Optional: iCal Subscriptions (Experimental)" section with full setup guide for the Node.js proxy Docker service

## [2.0.0] - 2026-04-11

### Changed
- **Breaking:** App folder renamed from `agenda/` to `opencloud-agenda/` — update your server path accordingly (`apps/opencloud-agenda/`)
- All hardcoded app identity strings centralized in `src/constants.ts` — renaming the app now requires only a single change

## [1.4.1] - 2026-04-11

### Changed
- README: added zip-based installation as recommended option (with curl, chown, and restart steps)
- README: fixed app registration docs — manifest.json is sufficient, no config.json edits needed
- README: added Radicale backup warning
- README: added screenshot

## [1.4.0] - 2026-04-10

### Fixed
- Subscriptions: token arriving after userId now triggers a server reload instead of staying on the localStorage fallback
- Subscriptions: concurrent writes are debounced (300 ms) so rapid changes no longer risk an older snapshot overwriting a newer one on the server
- Subscriptions: offline edits made while no token is available are pushed to the server when the token arrives, instead of being overwritten by an older server copy
- Subscriptions: the locally-modified flag is now version-guarded — a stale in-flight write that resolves after a newer offline edit can no longer clear the flag and cause the next reload to accept stale server data
- Subscriptions: all state (subscriptions, events, errors) is cleared immediately on direct user-to-user switch, not just on logout
- Subscriptions: in-flight `load()` and `fetchOne()` results from a previous session are discarded after logout or user switch (session counter)
- Subscriptions: `locallyModified` is only cleared after a confirmed server write (`ok: true`); a failed push leaves the flag set so the next reload retries

### Added
- 12 unit tests for `useSubscriptions` covering auth-timing, debounce ordering, cross-account write safety, session invalidation, offline-edit preservation, and write-failure retry
- `vitest.config.ts` now resolves the `@/` alias so composable tests can import from `@/services/`

## [1.3.0] - 2026-04-09

### Added
- iCal subscriptions — add external `.ics` calendars as read-only feeds via the sidebar
- CORS proxy at `/ics-proxy/` (Node.js container in the OpenCloud Docker stack) so browser-blocked `.ics` URLs can be fetched; authenticated via OpenCloud Bearer token

### Fixed
- Dark mode for Cancel button and input fields in the Subscription dialog
- Proxy authentication now uses the OpenCloud Bearer token instead of Traefik ForwardAuth (which broke when switching between apps)

## [1.2.0] - 2026-04-09

### Fixed
- UNTIL-based recurrence end now uses `T235959Z` instead of `T000000Z` — timed events on the last day were incorrectly excluded from their own series
- Monthly recurrence rules with negative weekday offsets (e.g. `BYDAY=-1MO`) are now preserved when editing a series instead of being recalculated from the start date
- Forgejo CI: use `pnpm build` (which includes `vue-tsc --noEmit`) instead of `pnpm vite build`, so the type check is not silently skipped

### Added
- Forgejo Actions release workflow: pushing a `v*` tag automatically builds and publishes a `agenda-<version>.zip` as a release asset
- Unit tests: 52 tests across `rrule.ts` and `caldav.ts` (parseRrule, buildRrule, getNthWeekday, escapeXml, escapeIcs, buildIcs, parseEvents)
- `vitest.config.ts` with `happy-dom` environment for component-free unit tests
- Time-pinned test fixtures (`vi.useFakeTimers`) so recurring event tests do not break after 2028

## [1.1.0] - 2026-04-08

### Added
- ↻ indicator on recurring events in all calendar views
- Reload button in sidebar (↻) with spinner animation while loading
- Dual delete buttons for recurring events: delete single occurrence (EXDATE) or entire series

### Fixed
- Recurring events created in Thunderbird were shown as simple events — RRULE is now added to all expanded occurrences
- Recurring event dialog was read-only — all fields are now editable for series editing
- Weekday labels invisible in dark mode — fixed `color: inherit` instead of hardcoded fallback
- 412 Precondition Failed when deleting a series after first deleting an occurrence — ETags are cleared on remaining occurrences after EXDATE modification
- Follow-up occurrences not visible after creating a new recurring event — calendar now reloads after create if an RRULE is present

## [1.0.0] - 2026-04-06

### Added
- Initial release
- Month, week, day and list views (FullCalendar)
- Create, edit and delete events with drag & drop and resize
- Recurring events with full RRULE support (daily, weekly, monthly, yearly; end by count or date)
- Multiple calendars with custom colors, show/hide toggle
- CalDAV backend via OpenCloud-bundled Radicale
- Bilingual UI (English / German)
- Dark mode support
- In-app help page (bilingual modal)