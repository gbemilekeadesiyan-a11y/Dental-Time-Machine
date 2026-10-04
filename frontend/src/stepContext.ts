import { createContext } from 'react'

/** Which step is on screen, for the "Step N of 6" eyebrow. Null outside the step pages. */
export const StepContext = createContext<{ number: number; total: number } | null>(null)
