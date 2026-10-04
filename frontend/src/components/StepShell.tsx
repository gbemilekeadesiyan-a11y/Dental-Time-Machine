import { useContext, type ReactNode } from 'react'
import { stepOf } from '../copy'
import { StepContext } from '../stepContext'

interface Props {
  titleId: string
  title: ReactNode
  intro?: ReactNode
  /** The left column from 1200 px; above the main column on smaller screens. */
  aside?: ReactNode
  /**
   * 'wide' is 2fr / 3fr, like the landing carousel. 'narrow' is 1fr / 2fr, for a main column
   * that needs the room (the timeline). 'even' is 1fr / 1fr, for two forms side by side.
   */
  columns?: 'wide' | 'narrow' | 'even'
  /** Keeps a short aside in view while the main column scrolls (from 1200 px). Only for asides shorter than the screen. */
  stickyAside?: boolean
  children: ReactNode
  /** Full width under the columns, such as the disclaimer. */
  after?: ReactNode
}

/**
 * The layout of every step page, matching the landing carousel: an eyebrow ("Step 2 of 6"),
 * a bold title and a short intro, then two columns from 1200 px (CLAUDE.md section 11).
 * Spacing is on the 8 px scale: 12 under the eyebrow, 16 under the title, 32 to 48 to the columns.
 */
export default function StepShell({ titleId, title, intro, aside, columns = 'wide', stickyAside = false, children, after }: Props) {
  const step = useContext(StepContext)

  return (
    <section aria-labelledby={titleId} className="space-y-8 desktop:space-y-12">
      <div className="space-y-3">
        {step && <p className="eyebrow">{stepOf(step.number, step.total)}</p>}
        <div className="space-y-4">
          <h2 id={titleId} className="heading-2 text-ink">
            {title}
          </h2>
          {intro && <p className="body-copy text-ink/80">{intro}</p>}
        </div>
      </div>

      {aside ? (
        <div
          className={
            'grid gap-6 desktop:items-start desktop:gap-12 ' +
            { wide: 'desktop:grid-cols-[2fr_3fr]', narrow: 'desktop:grid-cols-[1fr_2fr]', even: 'desktop:grid-cols-2' }[columns]
          }
        >
          <div className={'min-w-0 space-y-6 ' + (stickyAside ? 'desktop:sticky desktop:top-24' : '')}>{aside}</div>
          <div className="min-w-0 space-y-6">{children}</div>
        </div>
      ) : (
        <div className="space-y-6">{children}</div>
      )}

      {after}
    </section>
  )
}
