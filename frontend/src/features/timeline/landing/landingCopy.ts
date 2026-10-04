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

  // Feature carousel ("How it works"). No dollar amounts, numbers, logos or testimonials.
  featuresLabel: 'Four steps',
  featuresHeading: 'How it works',
  pause: 'Pause',
  play: 'Play',
  pauseLabel: 'Pause slideshow',
  playLabel: 'Play slideshow',
  /*
   * TODO when the photos are added to public/landing/: rewrite each alt text so it
   * describes the actual photo. These describe the intended subject only.
   */
  features: [
    {
      id: 'tell-us',
      title: 'Tell us your way',
      line: 'Speak it, type it, or upload your plan or treatment estimate. You confirm every detail.',
      image: '/landing/tell-us.webp',
      alt: 'A person at a table reading a printed dental treatment estimate with a phone in hand.',
    },
    {
      id: 'what-it-means',
      title: 'What it means',
      line: 'Each procedure becomes one clear line: what your plan likely pays and what you likely pay.',
      image: '/landing/what-it-means.webp',
      alt: 'A person reviewing a simple cost breakdown on a laptop at home.',
    },
    {
      id: 'two-futures',
      title: 'Two futures',
      line: 'Everything now, or a schedule that respects your plan year. Only your dentist decides what can wait.',
      image: '/landing/two-futures.webp',
      alt: 'A wall calendar with appointments marked across two months.',
    },
    {
      id: 'your-year',
      title: 'Your year',
      line: 'See how much of your annual maximum is used and what may be left when your plan year resets.',
      image: '/landing/your-year.webp',
      alt: 'A calm dental clinic waiting area with natural light.',
    },
  ],
} as const
