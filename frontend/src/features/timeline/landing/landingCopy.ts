/** Every word on the landing page. Our own text; nothing taken from other sites. */

import { RESET_WORDING } from '../../../glossary'

export const LANDING = {
  start: 'Start',

  // Header links. They scroll to the sections with these ids.
  nav: {
    howItWorks: { label: 'How it works', id: 'how-it-works' },
    whyTiming: { label: 'Why timing', id: 'why-timing' },
  },
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
  /** Photos are in public/landing/ (1200x900 WebP); credits in public/landing/CREDITS.md. Alt text describes each photo. */
  features: [
    {
      id: 'tell-us',
      title: 'Tell us your way',
      line: 'Speak it, type it, or upload your plan or treatment estimate. You confirm every detail.',
      image: '/landing/tell-us.webp',
      alt: 'A smiling girl with braces sits in a dental chair, talking with her dentist while her father smiles beside her.',
    },
    {
      id: 'what-it-means',
      title: 'What it means',
      line: 'Each procedure becomes one clear line: what your plan likely pays and what you likely pay.',
      image: '/landing/what-it-means.webp',
      alt: 'A stethoscope resting on a fanned stack of banknotes.',
    },
    {
      id: 'two-futures',
      title: 'Two futures',
      line: 'Everything now, or a schedule that respects your plan year. Only your dentist decides what can wait.',
      image: '/landing/two-futures.webp',
      alt: 'A man in a red shirt holds his cheek with his eyes shut, as if he has a toothache.',
    },
    {
      id: 'your-year',
      title: 'Your year',
      line: 'See how much of your annual maximum is used and what may be left when your plan year resets.',
      image: '/landing/your-year.webp',
      alt: 'An open planner with a monthly calendar and handwritten notes, with glasses and a pen on top.',
    },
  ],
} as const
