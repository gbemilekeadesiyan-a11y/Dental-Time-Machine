import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { LOCKED_HELP, LOCKED_LABEL, MOVE_TO_NEXT_YEAR, MOVE_TO_THIS_YEAR } from '../copy'
import { formatMoney } from '../format'
import { ArrowLeft, ArrowRight, LockIcon } from './Icons'
import type { Year } from '../types'

interface Props {
  id: string
  label: string
  year: Year
  /** False until the user confirms "My dentist said this can wait". */
  canMove: boolean
  /** From the latest /calculate result, when there is one. */
  youPay: number | undefined
  /** "Comes after the root canal", when it depends on another procedure. */
  note: string | undefined
  onMove: (id: string, to: Year) => void
  /** Reports where the pointer is while dragging, so the timeline can highlight a column. */
  onDragAt: (point: { x: number; y: number } | null) => void
  /** Reports where the chip was dropped. The timeline decides which year that is. */
  onDrop: (id: string, point: { x: number; y: number }) => void
}

/** One procedure on the timeline. Drag it across the wall, or use its button (CLAUDE.md section 11). */
export default function TimelineChip({ id, label, year, canMove, youPay, note, onMove, onDragAt, onDrop }: Props) {
  const reduceMotion = useReducedMotion()
  const other: Year = year === 'this_year' ? 'next_year' : 'this_year'

  // Page coordinates from Framer Motion, converted to the viewport for getBoundingClientRect().
  const toViewport = (info: PanInfo) => ({ x: info.point.x - window.scrollX, y: info.point.y - window.scrollY })

  return (
    <motion.li
      layoutId={`chip-${id}`}
      layout={!reduceMotion}
      drag={canMove}
      dragSnapToOrigin
      dragElastic={0.15}
      whileDrag={{ scale: 1.04, zIndex: 20, cursor: 'grabbing' }}
      onDrag={(_, info) => onDragAt(toViewport(info))}
      onDragEnd={(_, info) => {
        onDragAt(null)
        onDrop(id, toViewport(info))
      }}
      className={
        'relative list-none space-y-2 rounded-2xl p-4 ring-1 ring-ink/5 ' +
        (canMove ? 'cursor-grab bg-card shadow-md shadow-primary/10' : 'bg-bg')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-ink">{label}</span>
        {youPay !== undefined && (
          <span className="text-sm tabular-nums text-muted-text">you&apos;ll likely pay {formatMoney(youPay)}</span>
        )}
      </div>
      {note && <p className="text-xs text-muted-text">{note}</p>}

      {canMove ? (
        <button
          type="button"
          onClick={() => onMove(id, other)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-card px-4 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {other === 'next_year' ? MOVE_TO_NEXT_YEAR : MOVE_TO_THIS_YEAR}
          {other === 'next_year' ? <ArrowRight /> : <ArrowLeft />}
        </button>
      ) : (
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted-text">
            <LockIcon />
            {LOCKED_LABEL}
          </p>
          <p className="text-xs text-muted-text">{LOCKED_HELP}</p>
        </div>
      )}
    </motion.li>
  )
}
