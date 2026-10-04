import type { ReactNode } from 'react'

/**
 * A calm message box. "problem" is for things the user can fix; it uses
 * orange, never red (CLAUDE.md section 10: calm tone).
 */
export default function Notice({ tone = 'info', children }: { tone?: 'info' | 'problem'; children: ReactNode }) {
  return (
    <div
      role={tone === 'problem' ? 'alert' : 'status'}
      className={
        'rounded-lg border-l-4 p-3 text-sm ' +
        (tone === 'problem' ? 'border-orange bg-orange/10 text-ink' : 'border-line bg-cream text-muted')
      }
    >
      {children}
    </div>
  )
}
