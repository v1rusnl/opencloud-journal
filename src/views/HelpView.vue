<template>
  <div class="help-overlay" @click.self="$emit('close')">
  <div class="help-view">
    <button class="close-btn" @click="$emit('close')">×</button>
    <div class="help-content">
      <h1>{{ de ? 'Hilfe – Termine' : 'Help – Agenda' }}</h1>

      <section>
        <h2>{{ de ? 'Termine erstellen' : 'Creating events' }}</h2>
        <ul>
          <li v-if="de">Klick auf einen Tag → Neuer Termin für diesen Tag (ganztägig)</li>
          <li v-else>Click on a day → new all-day event for that day</li>
          <li v-if="de">Klick &amp; Ziehen über mehrere Tage → Mehrtägiger Termin</li>
          <li v-else>Click &amp; drag across days → multi-day event</li>
          <li v-if="de">In der Wochen-/Tagesansicht: Klick auf eine Uhrzeit → Termin mit Startzeit</li>
          <li v-else>In week/day view: click a time slot → timed event at that hour</li>
          <li v-if="de">„+ Neu"-Button oben links → Termin ohne Vorgabe erstellen</li>
          <li v-else>"+ New" button top left → create event without preselection</li>
          <li v-if="de">Im Dialog unter „Wiederholen" lässt sich eine Wiederholungsregel festlegen (täglich, wöchentlich, monatlich, jährlich)</li>
          <li v-else>Use "Repeat" in the dialog to set a recurrence rule (daily, weekly, monthly, yearly)</li>
        </ul>
      </section>

      <section>
        <h2>{{ de ? 'Termine bearbeiten' : 'Editing events' }}</h2>
        <ul>
          <li v-if="de">Klick auf einen Termin → Dialog zum Bearbeiten oder Löschen</li>
          <li v-else>Click an event → dialog to edit or delete</li>
          <li v-if="de">Termin ziehen → verschiebt den Termin (Datum/Uhrzeit)</li>
          <li v-else>Drag an event → move it to a new date/time</li>
          <li v-if="de">Mehrtägige Termine haben an beiden Enden einen weißen Anfasser zum Vergrößern/Verkleinern</li>
          <li v-else>Multi-day events have white handles at both edges to extend or shorten them</li>
          <li v-if="de">In der Wochen-/Tagesansicht: unterer Rand eines Termins ziehen → Dauer ändern</li>
          <li v-else>In week/day view: drag the bottom edge of a timed event → change duration</li>
          <li v-if="de">Im Kalender-Dropdown den Kalender wechseln → verschiebt den Termin in einen anderen Kalender</li>
          <li v-else>Change the calendar in the dropdown → moves the event to a different calendar</li>
        </ul>
      </section>

      <section>
        <h2>{{ de ? 'Wiederkehrende Termine' : 'Recurring events' }}</h2>
        <ul>
          <li v-if="de">Wiederkehrende Termine sind im Kalender mit <strong>↻</strong> markiert</li>
          <li v-else>Recurring events are marked with <strong>↻</strong> in the calendar</li>
          <li v-if="de">Wiederholungsoptionen: täglich · wöchentlich (Wochentage wählbar) · monatlich (am Tag X oder am N-ten Wochentag) · jährlich</li>
          <li v-else>Repeat options: daily · weekly (choose weekdays) · monthly (on day X or the Nth weekday) · yearly</li>
          <li v-if="de">Mit „Alle N …" lässt sich ein Intervall festlegen, z.&nbsp;B. alle 2 Wochen (14-tägig)</li>
          <li v-else>Use "Every N …" to set an interval, e.g. every 2 weeks (biweekly)</li>
          <li v-if="de">Ende der Serie: nie · nach N Terminen · bis zu einem Datum</li>
          <li v-else>Series end: never · after N occurrences · until a date</li>
          <li v-if="de">Beim Bearbeiten oder Verschieben eines Serientermins wird immer die <em>gesamte Serie</em> aktualisiert</li>
          <li v-else>Editing or moving a recurring event always updates the <em>entire series</em></li>
          <li v-if="de">Termine aus Thunderbird oder anderen CalDAV-Clients werden korrekt als Serie angezeigt und können hier bearbeitet werden</li>
          <li v-else>Events from Thunderbird or other CalDAV clients are correctly shown as a series and can be edited here</li>
        </ul>
      </section>

      <section>
        <h2>{{ de ? 'Kalender verwalten' : 'Managing calendars' }}</h2>
        <ul>
          <li v-if="de">Haken in der Sidebar → Kalender ein-/ausblenden</li>
          <li v-else>Checkbox in the sidebar → show/hide a calendar</li>
          <li v-if="de">Klick auf einen Kalendernamen → wählt ihn als Standard für neue Termine</li>
          <li v-else>Click a calendar name → sets it as default for new events</li>
          <li v-if="de">Doppelklick auf einen Kalendernamen → umbenennen</li>
          <li v-else>Double-click a calendar name → rename it</li>
          <li v-if="de">„+"-Button neben „Kalender" → neuen Kalender anlegen (Name + Farbe)</li>
          <li v-else>"+" button next to "Calendars" → create a new calendar (name + color)</li>
          <li v-if="de">↻-Button in der Sidebar → Daten manuell vom Server laden (z. B. nach Sync mit Thunderbird)</li>
          <li v-else>↻ button in the sidebar → manually refresh data from the server (e.g. after syncing with Thunderbird)</li>
        </ul>
      </section>

      <section>
        <h2>{{ de ? 'Ansichten' : 'Views' }}</h2>
        <ul>
          <li v-if="de"><strong>Monat</strong> – Übersicht des gesamten Monats</li>
          <li v-else><strong>Month</strong> – overview of the full month</li>
          <li v-if="de"><strong>Woche</strong> – Stundengenaue Wochenansicht mit Zeitraster</li>
          <li v-else><strong>Week</strong> – hourly week view with time grid</li>
          <li v-if="de"><strong>Tag</strong> – Detailansicht eines einzelnen Tages</li>
          <li v-else><strong>Day</strong> – detailed view of a single day</li>
          <li v-if="de"><strong>Liste</strong> – Alle kommenden Termine als Liste</li>
          <li v-else><strong>List</strong> – all upcoming events as a list</li>
        </ul>
      </section>

      <section>
        <h2>{{ de ? 'Abonnements (externe Kalender)' : 'Subscriptions (external calendars)' }}</h2>
        <ul>
          <li v-if="de">„+"-Button neben „Abonnements" → externe iCal-URL (.ics) als Nur-Lese-Kalender einbinden</li>
          <li v-else>"+" button next to "Subscriptions" → add an external iCal URL (.ics) as a read-only calendar</li>
          <li v-if="de">Name, URL und Farbe frei wählbar (z. B. Feiertage, Teamkalender)</li>
          <li v-else>Choose name, URL and color freely (e.g. public holidays, team calendars)</li>
          <li v-if="de">Haken → Abonnement ein-/ausblenden; × beim Hover → Abonnement löschen</li>
          <li v-else>Checkbox → show/hide subscription; × on hover → remove subscription</li>
          <li v-if="de">Abonnierte Termine sind schreibgeschützt – kein Dialog beim Klick, kein Verschieben</li>
          <li v-else>Subscribed events are read-only — no dialog on click, no drag &amp; drop</li>
          <li v-if="de">↻-Button lädt alle Abonnements neu</li>
          <li v-else>↻ button reloads all subscriptions</li>
        </ul>
      </section>

      <section>
        <h2>{{ de ? 'Hinweise' : 'Notes' }}</h2>
        <ul>
          <li v-if="de">Ganztägige Termine: das Enddatum im Dialog ist <em>inklusive</em> — „Ende: 21.04" heißt der Termin läuft bis einschließlich 21.04.</li>
          <li v-else>All-day events: the end date in the dialog is <em>inclusive</em> — "End: Apr 21" means the event runs through Apr 21.</li>
          <li v-if="de">Daten werden direkt im CalDAV-Server (Radicale) gespeichert und sind sofort in anderen Clients (Thunderbird, Smartphone) sichtbar.</li>
          <li v-else>Data is stored directly on the CalDAV server (Radicale) and immediately visible in other clients (Thunderbird, phone).</li>
          <li v-if="de">Das Verschieben von Serienterminen zwischen Kalendern wird nicht unterstützt.</li>
          <li v-else>Moving recurring events between calendars is not supported.</li>
        </ul>
      </section>

      <footer class="help-footer">
        © 2026 <a href="https://www.linux-nerds.org" target="_blank" rel="noopener">linux-nerds.org</a> · Agenda v{{ version }}
      </footer>
    </div>
  </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ (e: 'close'): void }>()
const de = (document.documentElement.lang || navigator.language || '').toLowerCase().startsWith('de')
declare const __APP_VERSION__: string
const version = __APP_VERSION__
</script>

<style scoped>
.help-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.help-view {
  position: relative;
  width: 680px;
  max-width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
  padding: 2rem;
  border-radius: 8px;
  background: var(--oc-role-surface, #fff);
  color: var(--oc-role-on-surface, #1a1a1a);
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.35);
}

.close-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: var(--oc-role-on-surface-variant, #888);
  line-height: 1;
  padding: 0.2rem 0.4rem;
}

.close-btn:hover { color: var(--oc-role-on-surface, #1a1a1a); }

.help-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  color: var(--oc-role-on-surface);
}

h2 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--oc-role-primary, #0082c9);
}

section {
  display: flex;
  flex-direction: column;
}

ul {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

li {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--oc-role-on-surface);
}

.help-footer {
  font-size: 0.75rem;
  color: var(--oc-role-on-surface-variant, #888);
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--oc-role-outline-variant, #ddd);
  text-align: center;
}

.help-footer a {
  color: var(--oc-role-primary, #0082c9);
  text-decoration: none;
}

.help-footer a:hover { text-decoration: underline; }
</style>
