# OpenCloud Journal

A VJOURNAL viewer and editor (Notes, Tasks, Journal) for OpenCloud, based on the architecture of [opencloud-agenda](https://forgejo.linux-nerds.org/frank/opencloud-agenda)

![GPT-5.5](https://img.shields.io/badge/ChatGPT-74aa9c?logo=openai&logoColor=white) ![GPL 3.0](https://img.shields.io/badge/License-GPL_3.0-blue)

> [!IMPORTANT]
> This project is an independent, community-built tool and is not affiliated with, endorsed by, or associated with the OpenCloud project in any way.

<img width="1899" height="904" alt="oc_journal" src="https://github.com/user-attachments/assets/140d6970-be10-47e6-ace2-0f49f7fba2a3" />

## Features

- Uses the OpenCloud user session to create a short-lived app token.
- Discovers CalDAV calendar collections.
- Loads `VJOURNAL` components with a CalDAV `REPORT`.
- Shows journal entries as a searchable chronological list.
- Edits `SUMMARY`, `DESCRIPTION`, `DTSTART`, `CATEGORIES` and `STATUS`.
- Creates new VJOURNAL resources with `PUT` and `If-None-Match: *`.
- Updates and deletes existing resources with ETag / `If-Match` conflict protection.
- Creates a VJOURNAL-oriented CalDAV collection with `MKCALENDAR`.
- German and English UI strings.

> [!Warning]
> Back up Opencloud data (in particular Radicale) before installing or upgrading.
This app reads and writes data directly via CalDAV. While it has been tested carefully, no software is free of bugs and you can recover your calendars if anything goes wrong.

## Development

Requirements: Node.js 24 and pnpm 10.

```bash
corepack enable
corepack prepare pnpm@10 --activate
pnpm install
pnpm build
pnpm test
```

The production bundle is written to `dist/`.

## OpenCloud deployment

1. Download release archive
2. Copy extracted opencloud-journal folder inside OpenCloud web apps directory inside the container, for example:

```text
/var/lib/opencloud/web/assets/apps
```
Typically in Opencloud 7.x default compose, the path is

```text
./config/opencloud/apps:/var/lib/opencloud/web/assets/apps
```

## CalDAV data model

A newly created entry is stored as a standard iCalendar VJOURNAL resource:

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//opencloud-journal//EN
CALSCALE:GREGORIAN
BEGIN:VJOURNAL
UID:...
DTSTAMP:20260807T061500Z
DTSTART;VALUE=DATE:20260807
SUMMARY:Daily note
DESCRIPTION:Text of the journal entry
CATEGORIES:Work,Ideas
STATUS:DRAFT
END:VJOURNAL
END:VCALENDAR
```

The app intentionally keeps the first version focused on interoperable RFC 5545 fields.

## Notes

Some CalDAV servers expose collections that reject `VJOURNAL` queries. Those collections are skipped while other collections remain usable. If a resource changes in another client after it was loaded, save/delete will fail with HTTP 412 instead of silently overwriting the newer version.

## License

The original repository is licensed under the GNU Affero General Public License v3.0. This derivative keeps the existing `LICENSE` file.


## jtxBoard compatibility via DAVx5

The app mirrors the three jtxBoard entry classes over CalDAV (but it should work with other Apps/Programs that support these collection classes:

- **Journal**: `VJOURNAL` with `DTSTART`
- **Note**: `VJOURNAL` without `DTSTART`
- **Task**: `VTODO` with optional start/due date, status, progress and priority -> Also tested with Thunderbird

The UI reads both `VJOURNAL` and `VTODO` collections. Before deleting an externally-synced item, it refreshes the resource ETag so changes made by DAVx5/jtxBoard after page load do not cause avoidable `412 Precondition Failed` errors. Weak ETags are kept verbatim and are not sent through `If-Match`, because HTTP strong comparison cannot match a weak ETag. Existing objects retain unrecognized iCalendar properties when edited, which helps avoid losing jtxBoard-specific metadata.

## Thanks

Special thanks to FrankM from https://linux-nerds.org/topic/1850/opencloud-mein-erster-pr for the idea of user apps. Check out his blog and forum!

## Disclaimer

AI (GPT5.5) was used to support the building process of this app.
