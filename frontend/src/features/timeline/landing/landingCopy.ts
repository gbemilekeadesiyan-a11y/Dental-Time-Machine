/** Every word on the landing page. Our own text; nothing taken from other sites. */

import { RESET_WORDING } from '../../../glossary'

export const LANDING = {
  appName: 'Dental Time Machine',
  start: 'Start',
  seeMaya: "See Maya's example",
  loadingMaya: 'Loading Maya…',
  /** Read by screen readers as one heading; drawn as two drifting halves. */
  headline: 'Same care, smarter timing',
  left: { sans: 'Same', serif: 'care' },
  right: { sans: 'Smarter', serif: 'timing' },
  revealLabel: 'Why timing matters',
  /** Uses the approved reset sentence from CLAUDE.md section 10, word for word. */
  revealText: `Your dental plan has a yearly limit. ${RESET_WORDING} We do the math so you can see what changes if you change when you get care.`,
} as const
