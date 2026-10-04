import type { ReactNode } from 'react'

/**
 * A calm message box on glass. "problem" is for things the user can fix; it uses
 * the primary blue, never red (CLAUDE.md section 10: calm tone).
 */
export default function Notice({ tone = 'info', children }: { tone?: 'info' | 'problem'; children: ReactNode }) {
  return (
    <div
      role={tone === 'problem' ? 'alert' : 'status'}
      className={
        'glass rounded-2xl border-l-4 p-4 text-sm text-ink ' + (tone === 'problem' ? 'border-l-primary' : 'border-l-muted')
      }
    >
      {children}
    </div>
  )
}
