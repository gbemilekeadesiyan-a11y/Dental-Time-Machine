import { useState } from 'react'
import RollLabel from '../../components/RollLabel'
import { DISCLAIMER } from '../../copy'
import { formatMoney } from '../../format'
import { RESET_WORDING } from '../../glossary'
import { buildIcs, downloadIcs, resetTiming } from './calendarFile'
import {
  daysText,
  REMINDER_ALL_USED,
  REMINDER_BUTTON,
  REMINDER_CHECK_PLAN,
  REMINDER_EVENT_TITLE,
  REMINDER_FILENAME,
  REMINDER_PRIVACY,
  REMINDER_TITLE,
} from './summaryCopy'

interface Props {
  /** The plan's "MM-DD" reset date, as the user entered it. */
  resetDate: string
  /** From the engine: Result.max_left.this_year. */
  leftThisYear: number
}

const longDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' })
const fullDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

/**
 * "Use it before it resets" (challenge bonus: remind about unused end-of-year benefits).
 * Counts the days to the plan's reset date and offers a calendar reminder 30 days before.
 * The only dollar figure is the engine's max_left.this_year.
 */
export default function ResetReminder({ resetDate, leftThisYear }: Props) {
  const [added, setAdded] = useState(false)
  const timing = resetTiming(resetDate)
  if (!timing) return null

  const resets = longDate.format(timing.resetsOn)
  const left = formatMoney(leftThisYear)
  const hasLeft = leftThisYear > 0

  function addReminder() {
    if (!timing?.remindOn) return
    const description = [
      `You may have ${left} of your dental plan's annual maximum left this plan year.`,
      `Your plan resets on ${resets}.`,
      REMINDER_CHECK_PLAN,
      RESET_WORDING,
      DISCLAIMER,
    ].join('\n\n')
    downloadIcs(buildIcs({ date: timing.remindOn, title: REMINDER_EVENT_TITLE, description }), REMINDER_FILENAME)
    setAdded(true)
  }

  return (
    <section aria-labelledby="reset-reminder-title" className="rounded-2xl bg-primary/5 p-4 ring-1 ring-primary/15 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div data-narrate="reset" className="min-w-0 flex-1 basis-64 space-y-1">
          <h4 id="reset-reminder-title" className="text-sm font-semibold tracking-wide text-primary uppercase">
            {REMINDER_TITLE}
          </h4>
          <p className="text-ink">
            Your plan resets <strong className="font-semibold">{resets}</strong>, {daysText(timing.daysUntilReset)}.{' '}
            {hasLeft ? (
              <>
                You have <strong className="font-semibold text-savings-deep">{left}</strong> of your annual maximum left
                this plan year.
              </>
            ) : (
              REMINDER_ALL_USED
            )}
          </p>
          {hasLeft && <p className="text-sm text-muted-text">{REMINDER_CHECK_PLAN}</p>}
        </div>
        {hasLeft && timing.remindOn && (
          <button type="button" onClick={addReminder} data-narrate="reminder" className="btn-primary shrink-0">
            <RollLabel>
              <CalendarIcon />
              {REMINDER_BUTTON}
            </RollLabel>
          </button>
        )}
      </div>
      <p role="status" className="mt-2 text-sm text-muted-text empty:hidden">
        {added && timing.remindOn
          ? `Reminder file downloaded for ${fullDate.format(timing.remindOn)}. Open it to add it to your calendar. ${REMINDER_PRIVACY}`
          : ''}
      </p>
    </section>
  )
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
      <path d="M3 8.5h14M7 2.5v4M13 2.5v4" strokeLinecap="round" />
    </svg>
  )
}
