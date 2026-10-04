import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

/**
 * The one page width (CLAUDE.md section 11): up to 1200 px, centered, with side padding
 * of 16 px on phones, 24 px from 810 px and 40 px from 1200 px. Every landing section and
 * step screen sits in one; nothing else sets a page max-width.
 */
export default function Container({ children, className = '' }: Props) {
  return <div className={'mx-auto w-full max-w-[1200px] px-4 tablet:px-6 desktop:px-10 ' + className}>{children}</div>
}
