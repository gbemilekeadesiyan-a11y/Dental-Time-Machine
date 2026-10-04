import { type Dispatch } from 'react'
import { ArrowRight } from '../components/Icons'
import Notice from '../components/Notice'
import { START_CTA, START_OWN_CARE, TAGLINE } from '../copy'
import type { Action } from '../state'
import { useLoadMaya } from '../useLoadMaya'

interface Props {
  dispatch: Dispatch<Action>
  /** Go to Tell us. */
  onStart: () => void
}

/** The start screen: the tagline and one clear way in. No people photos, testimonials or stats. */
export default function Start({ dispatch, onStart }: Props) {
  const { load, loading, error } = useLoadMaya(dispatch)

  async function seeMaya() {
    if (await load()) onStart()
  }

  return (
    <section aria-labelledby="start-title" className="flex min-h-[70vh] flex-col justify-center gap-10 py-10">
      <p className="text-sm font-semibold tracking-tight text-ink">Dental Time Machine</p>
      <h1 id="start-title" className="max-w-3xl text-4xl leading-[1.08] font-light tracking-tight text-ink sm:text-6xl">
        {TAGLINE}
      </h1>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <button type="button" onClick={seeMaya} disabled={loading} className="btn-primary px-6 text-base">
          {loading ? 'Loading Maya…' : START_CTA}
          <ArrowRight />
        </button>
        <button
          type="button"
          onClick={onStart}
          className="min-h-11 text-base font-medium text-ink underline decoration-muted underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {START_OWN_CARE}
        </button>
      </div>
      {error && (
        <div className="max-w-xl">
          <Notice tone="problem">{error}</Notice>
        </div>
      )}
    </section>
  )
}
