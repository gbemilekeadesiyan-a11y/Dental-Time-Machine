import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

interface Tab<T extends string> {
  id: T
  label: string
  panel: ReactNode
}

interface Props<T extends string> {
  tabs: readonly Tab<T>[]
  current: T
  onChange: (id: T) => void
  label: string
}

/**
 * Accessible tabs (WAI-ARIA tabs pattern): one panel shows at a time, so the Summary
 * fits on one screen. Arrow keys, Home and End move between tabs.
 */
export default function SummaryTabs<T extends string>({ tabs, current, onChange, label }: Props<T>) {
  const baseId = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(
    tabs.findIndex((t) => t.id === current),
    0,
  )

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    const target = next === null ? undefined : tabs[next]
    if (next === null || !target) return
    e.preventDefault()
    onChange(target.id)
    buttons.current[next]?.focus()
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="glass flex w-full gap-1 rounded-[1.75rem] p-1 sm:w-fit sm:rounded-full"
      >
        {tabs.map((t, i) => {
          const selected = i === index
          return (
            <button
              key={t.id}
              ref={(el) => {
                buttons.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={
                // On phones the three tabs share the row and may wrap to two lines, so none is cut off.
                'min-h-10 flex-1 rounded-full px-2 py-1 text-sm leading-tight transition-colors sm:flex-none sm:px-4 sm:whitespace-nowrap ' +
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ' +
                (selected ? 'bg-primary font-medium text-white shadow-sm' : 'text-muted-text hover:text-ink')
              }
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${baseId}-panel-${t.id}`}
          aria-labelledby={`${baseId}-tab-${t.id}`}
          hidden={i !== index}
          tabIndex={0}
          className="rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          {i === index && t.panel}
        </div>
      ))}
    </div>
  )
}
