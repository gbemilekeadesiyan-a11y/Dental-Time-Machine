import type { ReactNode } from 'react'

/**
 * The label inside a pill button, for the shared hover roll (see index.css): the label
 * rolls up and out while a copy rolls in from below. The copy is hidden from screen
 * readers, so the button's name is read once.
 */
export default function RollLabel({ children }: { children: ReactNode }) {
  return (
    <span className="roll">
      <span className="roll-a">{children}</span>
      <span className="roll-b" aria-hidden="true">
        {children}
      </span>
    </span>
  )
}
