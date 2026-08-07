<template>
  <div class="event-dialog-overlay" @click.self="$emit('close')">
    <div class="event-dialog">
      <h2>{{ isNew ? t('New Event') : t('Edit Event') }}</h2>

      <label>
        {{ t('Title') }}
        <input v-model="form.title" type="text" :placeholder="t('Event title')" autofocus />
      </label>

      <label class="row">
        <input v-model="form.allDay" type="checkbox" />
        {{ t('All day') }}
      </label>

      <div class="date-row">
        <label>
          {{ t('Start') }}
          <input v-if="form.allDay" v-model="form.startDate" type="date" />
          <input v-else v-model="form.startDateTime" type="datetime-local" />
        </label>
        <label>
          {{ t('End') }}
          <input v-if="form.allDay" v-model="form.endDate" type="date" />
          <input v-else v-model="form.endDateTime" type="datetime-local" />
        </label>
      </div>

      <label>
        {{ t('Location') }}
        <input v-model="form.location" type="text" :placeholder="t('Location')" />
      </label>

      <label>
        {{ t('Description') }}
        <textarea v-model="form.description" rows="3" :placeholder="t('Description')" />
      </label>

      <!-- Repeat — always editable; note shown when editing a recurring series -->
      <p v-if="event?.seriesUid" class="series-note">{{ t('Edits apply to the full series.') }}</p>

      <label>
        {{ t('Repeat') }}
        <select v-model="form.repeatFreq">
          <option value="NONE">{{ t('None') }}</option>
          <option value="DAILY">{{ t('Daily') }}</option>
          <option value="WEEKLY">{{ t('Weekly') }}</option>
          <option value="MONTHLY">{{ t('Monthly') }}</option>
          <option value="YEARLY">{{ t('Yearly') }}</option>
        </select>
      </label>

      <label v-if="form.repeatFreq !== 'NONE'" class="row repeat-interval">
        {{ t('Every') }}
        <input type="number" v-model.number="form.repeatInterval" min="1" max="99" class="count-input" />
        {{ intervalUnitLabel }}
      </label>

      <div v-if="form.repeatFreq === 'MONTHLY'" class="repeat-monthly">
        <label class="row">
          <input type="radio" v-model="form.monthlyType" value="DAYOFMONTH" />
          {{ t('On day') }} {{ autoMonthDay }}
        </label>
        <label class="row">
          <input type="radio" v-model="form.monthlyType" value="NTHWEEKDAY" />
          {{ t('On the') }} {{ autoNthWeekdayLabel }}
        </label>
      </div>

      <div v-if="form.repeatFreq === 'WEEKLY'" class="repeat-days">
        <label v-for="(label, day) in weekDayLabels" :key="day" class="day-label">
          <input type="checkbox" :value="day" v-model="form.repeatDays" />
          {{ label }}
        </label>
      </div>

      <div v-if="form.repeatFreq !== 'NONE'" class="repeat-end">
        <label>
          {{ t('End') }}
          <select v-model="form.repeatEndType">
            <option value="NEVER">{{ t('Never') }}</option>
            <option value="COUNT">{{ t('After') }}</option>
            <option value="UNTIL">{{ t('Until') }}</option>
          </select>
        </label>
        <label v-if="form.repeatEndType === 'COUNT'" class="row">
          <input type="number" v-model.number="form.repeatCount" min="1" max="999" class="count-input" />
          {{ t('times') }}
        </label>
        <input v-if="form.repeatEndType === 'UNTIL'" type="date" v-model="form.repeatUntil" />
      </div>

      <label>
        {{ t('Calendar') }}
        <select v-model="form.calendarHref">
          <option v-for="cal in calendars" :key="cal.href" :value="cal.href">
            {{ cal.displayName }}
          </option>
        </select>
      </label>

      <div class="actions">
        <template v-if="!isNew">
          <button v-if="event?.seriesUid" class="danger" @click="handleDeleteOccurrence">{{ t('Delete occurrence') }}</button>
          <button class="danger" @click="handleDelete">{{ event?.seriesUid ? t('Delete series') : t('Delete') }}</button>
        </template>
        <span class="spacer" />
        <button @click="$emit('close')">{{ t('Cancel') }}</button>
        <button class="primary" @click="handleSave">{{ t('Save') }}</button>
      </div>

      <p v-if="saveError" class="error-msg">{{ saveError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import type { Calendar, CalendarEvent } from '@/services/caldav'
import { useI18n } from '@/composables/useI18n'
import { DAY_NAMES, getNthWeekday, parseRrule, buildRrule as buildRruleUtil } from '@/utils/rrule'
import type { RepeatFreq, RepeatEnd } from '@/utils/rrule'
import { addDays } from '@/utils/eventFormat'

const { t } = useI18n()

const props = defineProps<{
  event?: CalendarEvent | null
  defaultStart?: Date
  defaultEnd?: Date
  defaultAllDay?: boolean
  calendars: Calendar[]
  activeCalendarHref?: string | null
}>()

const emit = defineEmits<{
  (e: 'save', event: Omit<CalendarEvent, 'uid' | 'calendarHref' | 'etag'> & { calendarHref: string }): void
  (e: 'update', event: CalendarEvent): void
  (e: 'delete', event: CalendarEvent): void
  (e: 'delete-occurrence', event: CalendarEvent): void
  (e: 'close'): void
}>()

const isNew = computed(() => !props.event)

const weekDayLabels: Record<string, string> = {
  MO: t('Mo'), TU: t('Tu'), WE: t('We'), TH: t('Th'),
  FR: t('Fr'), SA: t('Sa'), SU: t('Su'),
}

const DAY_LABELS: Record<string, string> = {
  SU: t('Sun'), MO: t('Mon'), TU: t('Tue'), WE: t('Wed'),
  TH: t('Thu'), FR: t('Fri'), SA: t('Sat'),
}
const ORDINALS = [t('1st'), t('2nd'), t('3rd'), t('4th')]

function nthWeekdayLabel(byday: string): string {
  const m = byday.match(/^(-?\d+)([A-Z]{2})$/)
  if (!m) return byday
  const n = parseInt(m[1])
  const day = DAY_LABELS[m[2]] ?? m[2]
  const ord = n === -1 ? t('Last') : (ORDINALS[n - 1] ?? `${n}.`)
  return `${ord} ${day}`
}

const saveError = ref<string | null>(null)

function toLocalDateString(d: Date) {
  return d.toLocaleDateString('sv') // 'sv' locale gives YYYY-MM-DD
}
function toLocalDateTimeString(d: Date) {
  return d.toLocaleDateString('sv') + 'T' + d.toTimeString().slice(0, 5)
}

const defaultStart = props.defaultStart ?? new Date()
const defaultEnd = props.defaultEnd ?? new Date(defaultStart.getTime() + 60 * 60 * 1000)
const defaultCalHref =
  props.event?.calendarHref
    ? props.calendars.find(c => props.event!.calendarHref.startsWith(c.href))?.href ?? props.activeCalendarHref ?? props.calendars[0]?.href ?? ''
    : props.activeCalendarHref ?? props.calendars[0]?.href ?? ''

// For all-day events, iCal DTEND is exclusive (= last day + 1).
// Show the inclusive last day in the dialog; add 1 day back when saving.
function allDayEndForDisplay(d: Date): Date {
  return addDays(d, -1)
}

const parsedRrule = props.event?.rrule ? parseRrule(props.event.rrule) : null

const form = reactive({
  title: props.event?.title ?? '',
  allDay: props.event?.allDay ?? props.defaultAllDay ?? false,
  startDate: toLocalDateString(props.event?.start ?? defaultStart),
  endDate: toLocalDateString(
    props.event?.allDay
      ? allDayEndForDisplay(props.event.end)
      : (props.event?.end ?? defaultEnd),
  ),
  startDateTime: toLocalDateTimeString(props.event?.start ?? defaultStart),
  endDateTime: toLocalDateTimeString(props.event?.end ?? defaultEnd),
  location: props.event?.location ?? '',
  description: props.event?.description ?? '',
  calendarHref: defaultCalHref,
  repeatFreq: (parsedRrule?.freq ?? 'NONE') as RepeatFreq,
  repeatInterval: parsedRrule?.interval ?? 1,
  repeatDays: parsedRrule?.days ?? [] as string[],
  monthlyType: (parsedRrule?.monthlyType ?? 'DAYOFMONTH') as 'DAYOFMONTH' | 'NTHWEEKDAY',
  monthlyByday: parsedRrule?.monthlyByday ?? '',
  repeatEndType: (parsedRrule?.endType ?? 'NEVER') as RepeatEnd,
  repeatCount: parsedRrule?.count ?? 10,
  repeatUntil: parsedRrule?.until ?? '',
})

// Auto-compute Nth weekday from start date (used as default for monthly NTHWEEKDAY)
const startDateForCalc = computed(() =>
  new Date(form.allDay ? form.startDate + 'T00:00:00' : form.startDateTime)
)
const autoNthWeekday = computed(() => getNthWeekday(startDateForCalc.value))
const autoNthWeekdayLabel = computed(() => nthWeekdayLabel(autoNthWeekday.value))
const autoMonthDay = computed(() => startDateForCalc.value.getDate())

const INTERVAL_UNITS: Record<string, string> = {
  DAILY: t('day(s)'), WEEKLY: t('week(s)'), MONTHLY: t('month(s)'), YEARLY: t('year(s)'),
}
const intervalUnitLabel = computed(() => INTERVAL_UNITS[form.repeatFreq] ?? '')

function buildRrule(): string | undefined {
  return buildRruleUtil({
    freq: form.repeatFreq,
    interval: form.repeatInterval >= 1 ? form.repeatInterval : 1,
    days: form.repeatDays,
    monthlyType: form.monthlyType,
    monthlyByday: form.monthlyByday,
    endType: form.repeatEndType,
    count: form.repeatCount,
    until: form.repeatUntil,
    startDate: startDateForCalc.value,
  })
}

function parseDates() {
  if (form.allDay) {
    const start = new Date(form.startDate + 'T00:00:00')
    // Dialog shows inclusive end → add 1 day to make it exclusive (iCal/FC convention)
    const end = new Date(form.endDate + 'T00:00:00')
    end.setDate(end.getDate() + 1)
    return { start, end }
  }
  return {
    start: new Date(form.startDateTime),
    end: new Date(form.endDateTime),
  }
}

function handleSave() {
  saveError.value = null
  if (!form.title.trim()) { saveError.value = t('Title is required.'); return }
  const { start, end } = parseDates()
  if (end < start) { saveError.value = t('End must be after start.'); return }
  if (!form.calendarHref) { saveError.value = t('Please select a calendar.'); return }

  if (isNew.value) {
    emit('save', {
      title: form.title.trim(),
      start,
      end,
      allDay: form.allDay,
      location: form.location || undefined,
      description: form.description || undefined,
      calendarHref: form.calendarHref,
      rrule: buildRrule(),
    })
  } else {
    // Compute the target calendarHref: if the user picked a different calendar,
    // build a new .ics URL in that collection (same UID, new collection path).
    const currentCal = props.calendars.find(c => props.event!.calendarHref.startsWith(c.href))
    const calendarChanged = form.calendarHref !== currentCal?.href

    if (calendarChanged && props.event!.seriesUid) {
      saveError.value = t('Moving recurring events between calendars is not supported.')
      return
    }

    const eventUid = props.event!.seriesUid ?? props.event!.uid
    const newCalendarHref = calendarChanged
      ? `${form.calendarHref.replace(/\/$/, '')}/${eventUid}.ics`
      : props.event!.calendarHref

    emit('update', {
      ...props.event!,
      title: form.title.trim(),
      start,
      end,
      allDay: form.allDay,
      location: form.location || undefined,
      description: form.description || undefined,
      calendarHref: newCalendarHref,
      rrule: buildRrule(),
    })
  }
}

function handleDelete() {
  if (props.event) emit('delete', props.event)
}

function handleDeleteOccurrence() {
  if (props.event) emit('delete-occurrence', props.event)
}
</script>

<style scoped>
.event-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.event-dialog {
  background: var(--oc-role-surface, #fff);
  color: var(--oc-role-on-surface, #1a1a1a);
  border: 1px solid var(--oc-role-outline-variant, #ddd);
  border-radius: 8px;
  padding: 1.5rem;
  width: 480px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.35);
}

h2 {
  margin: 0;
  font-size: 1.2rem;
  color: inherit;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--oc-role-on-surface-variant, #666);
}

label.row {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

input[type='text'],
input[type='date'],
input[type='datetime-local'],
select,
textarea {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--oc-role-outline-variant, #ccc);
  border-radius: 4px;
  font-size: 0.95rem;
  font-family: inherit;
  background: var(--oc-role-surface-container-high, #f5f5f5);
  color: var(--oc-role-on-surface, #1a1a1a);
}

input[type='text']:focus,
input[type='date']:focus,
input[type='datetime-local']:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--oc-role-primary, #0082c9);
  box-shadow: 0 0 0 2px rgba(0, 130, 201, 0.25);
}

/* color-scheme is inherited from .calendar-view, where it is derived from the
   OpenCloud theme — `light dark` here would hand the choice back to the OS. */

textarea {
  resize: vertical;
}

.date-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}

.spacer {
  flex: 1;
}

button {
  padding: 0.4rem 1rem;
  border-radius: 4px;
  border: 1px solid var(--oc-role-outline-variant, #ccc);
  cursor: pointer;
  font-size: 0.9rem;
  font-family: inherit;
  background: var(--oc-role-surface-container-high, #f0f0f0);
  color: var(--oc-role-on-surface, #1a1a1a);
}

button:hover {
  background: var(--oc-role-surface-container-highest, #e0e0e0);
}

button.primary {
  background: var(--oc-role-primary, #0082c9);
  color: var(--oc-role-on-primary, #fff);
  border-color: transparent;
}

button.primary:hover {
  opacity: 0.9;
}

button.danger {
  background: var(--oc-role-error, #e9322d);
  color: var(--oc-role-on-error, #fff);
  border-color: transparent;
}

button.danger:hover {
  opacity: 0.9;
}

.error-msg {
  color: var(--oc-role-error, #e9322d);
  font-size: 0.85rem;
  margin: 0;
}

.repeat-monthly {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.repeat-days {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.day-label {
  display: flex;
  flex-direction: row !important;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.85rem;
  font-weight: normal;
  color: inherit;
  cursor: pointer;
}

.repeat-end {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.repeat-end label {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
}

.count-input {
  width: 4.5rem;
}

.series-note {
  margin: 0;
  font-size: 0.8rem;
  color: var(--oc-role-on-surface-variant, #888);
  font-style: italic;
}

.event-dialog {
  max-height: 90vh;
  overflow-y: auto;
}
</style>
