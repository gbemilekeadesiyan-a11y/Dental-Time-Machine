/**
 * Plan-year dates and the calendar reminder file for the Summary step.
 *
 * Dates only: no dollar math here. The reminder text receives the amount already
 * formatted from the engine's max_left (CLAUDE.md section 2).
 * The file is built in the browser and handed to the user; nothing is sent or stored.
 */

const DAY_MS = 24 * 60 * 60 * 1000
/** How long before the reset the reminder fires. */
export const REMIND_DAYS_BEFORE = 30

/** Midnight local time, so day counts don't drift with the clock. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

/** Whole days from a to b (both at local midnight). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

/**
 * The next time the plan year resets, on or after today. Null when reset_date
 * isn't a real "MM-DD" date.
 */
export function nextResetDate(resetDate: string, today: Date = new Date()): Date | null {
  const match = /^(\d{2})-(\d{2})$/.exec(resetDate)
  if (!match) return null
  const month = Number(match[1]) - 1
  const day = Number(match[2])
  const base = startOfDay(today)
  // Eight years always reaches a leap year, for a 02-29 reset date.
  for (let year = base.getFullYear(); year <= base.getFullYear() + 8; year++) {
    const candidate = new Date(year, month, day)
    // Skips dates that don't exist that year (for example 02-29), which roll over.
    if (candidate.getMonth() !== month || candidate.getDate() !== day) continue
    if (candidate >= base) return candidate
  }
  return null
}

export interface ResetTiming {
  resetsOn: Date
  daysUntilReset: number
  /** When the calendar reminder fires, or null when the reset is too close to bother. */
  remindOn: Date | null
}

export function resetTiming(resetDate: string, today: Date = new Date()): ResetTiming | null {
  const resetsOn = nextResetDate(resetDate, today)
  if (!resetsOn) return null
  const daysUntilReset = daysBetween(today, resetsOn)
  let remindOn: Date | null = addDays(resetsOn, -REMIND_DAYS_BEFORE)
  if (daysBetween(today, remindOn) < 1) {
    // Inside the 30 days already: remind tomorrow, if that's still before the reset.
    remindOn = daysUntilReset > 1 ? addDays(startOfDay(today), 1) : null
  }
  return { resetsOn, daysUntilReset, remindOn }
}

// ---------- the .ics file (RFC 5545) ----------

function icsDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}${mm}${dd}`
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function icsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Lines longer than 75 octets are folded: CRLF plus one space (RFC 5545 section 3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder()
  const parts: string[] = []
  let current = ''
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74
    if (bytes.encode(current + ch).length > limit) {
      parts.push(current)
      current = ch
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export interface ReminderEvent {
  date: Date
  title: string
  description: string
}

/** One all-day event with a 9 am alert, as an .ics calendar file. */
export function buildIcs(event: ReminderEvent, now: Date = new Date()): string {
  const uid = `${crypto.randomUUID()}@dental-time-machine`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dental Time Machine//Plan reset reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(event.date, 1))}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(event.description)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT9H',
    `DESCRIPTION:${icsText(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Hand the file to the browser as a download. Nothing leaves the device. */
export function downloadIcs(ics: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
