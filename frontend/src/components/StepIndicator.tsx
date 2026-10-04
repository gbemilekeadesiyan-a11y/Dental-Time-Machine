interface Props {
  steps: readonly { id: string; label: string }[]
  current: number
  onSelect: (index: number) => void
}

/** A slim, clickable step line: Tell us · What it means · Two futures · Your year. */
export default function StepIndicator({ steps, current, onSelect }: Props) {
  return (
    <nav aria-label="Steps" className="glass w-fit max-w-full rounded-full px-2 py-1">
      <ol className="flex flex-wrap items-center gap-x-0.5 gap-y-1">
        {steps.map((s, i) => {
          const active = i === current
          return (
            <li key={s.id} className="flex items-center">
              {i > 0 && (
                <span aria-hidden="true" className="px-0.5 text-muted">
                  ·
                </span>
              )}
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={active ? 'step' : undefined}
                className={
                  'min-h-8 rounded-full px-2.5 text-sm whitespace-nowrap transition-colors ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ' +
                  (active ? 'bg-primary font-medium text-white' : 'text-muted-text hover:text-ink')
                }
              >
                <span className="sr-only">Step {i + 1}: </span>
                {s.label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
