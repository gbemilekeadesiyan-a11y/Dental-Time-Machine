import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, getDentists, isAbortError } from '../../api'
import Notice from '../../components/Notice'
import { SORT_LABELS, daysFromToday, matchAndSort } from './filterOptions'
import type { DentistResult, DentistSearchResponse, Filters } from './types'

const PAGE = 20
const DEBOUNCE_MS = 400

interface Search {
  zip: string
  radius: number
  outcome: { ok: true; data: DentistSearchResponse } | { ok: false; message: string }
}

/**
 * Dentists near the ZIP, narrowed by every filter. The registry is only asked again
 * when the ZIP changes or the distance grows; everything else filters what we have.
 */
export default function DentistResults({ filters }: { filters: Filters }) {
  const { zip, max_distance_miles: miles } = filters
  const [search, setSearch] = useState<Search | null>(null)
  // How many cards to show; starts over whenever the filters change.
  const [page, setPage] = useState({ filters, count: PAGE })
  const shown = page.filters === filters ? page.count : PAGE
  const reduceMotion = useReducedMotion()

  const validZip = /^\d{5}$/.test(zip)
  const covered = search !== null && search.zip === zip && search.radius >= miles && search.outcome.ok

  useEffect(() => {
    if (!validZip || covered) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      getDentists(zip, miles, { signal: controller.signal })
        .then((data) => setSearch({ zip, radius: miles, outcome: { ok: true, data } }))
        .catch((e: unknown) => {
          if (isAbortError(e)) return
          const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
          setSearch({ zip, radius: miles, outcome: { ok: false, message } })
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [zip, miles, validZip, covered])

  const matches = useMemo(
    () => (search?.outcome.ok ? matchAndSort(search.outcome.data.dentists, filters) : []),
    [search, filters],
  )

  if (!validZip) {
    return <Notice>Enter a five-digit ZIP code, or tell the assistant where you are, to see dentists near you.</Notice>
  }
  const current = search !== null && search.zip === zip && (search.radius >= miles || !search.outcome.ok)
  if (!current) {
    return <div className="glass h-40 animate-pulse rounded-3xl motion-reduce:animate-none" role="status" aria-label="Finding dentists" />
  }
  if (!search.outcome.ok) {
    return <Notice tone="problem">{search.outcome.message}</Notice>
  }
  const { data } = search.outcome

  return (
    <section aria-labelledby="results-title" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="results-title" className="text-xl font-semibold tracking-tight text-ink" aria-live="polite">
          {matches.length === 1 ? '1 dentist matches' : `${matches.length} dentists match`}
        </h3>
        <span className="text-sm text-ink/75">{SORT_LABELS[filters.sort]}</span>
      </div>

      {data.note && <Notice tone={data.source === 'unavailable' ? 'problem' : 'info'}>{data.note}</Notice>}
      {data.source === 'npi' && (
        <p className="text-xs text-ink/75">
          Names, addresses and specialties come from the CMS NPI Registry. Distances are approximate (ZIP to ZIP).
          Network, languages, new patients, openings and referral details are demo data.
        </p>
      )}

      {data.source === 'npi' && matches.length === 0 && (
        <Notice>No dentists match all of your filters. Try a longer distance or remove a filter.</Notice>
      )}

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {matches.slice(0, shown).map((d) => (
            <motion.li
              key={d.npi}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <DentistCard dentist={d} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {matches.length > shown && (
        <button type="button" onClick={() => setPage({ filters, count: shown + PAGE })} className="btn-secondary w-full">
          Show more dentists
        </button>
      )}
    </section>
  )
}

function opening(iso: string): string {
  const days = daysFromToday(iso)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function DentistCard({ dentist: d }: { dentist: DentistResult }) {
  return (
    <article className="glass space-y-3 rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-ink">{d.name}</h4>
          <p className="text-sm text-muted-text">{d.specialty_label}</p>
        </div>
        <span className="text-sm text-ink tabular-nums">
          {d.distance_miles === 0 ? 'In your ZIP' : `About ${d.distance_miles} mi`}
        </span>
      </div>
      <p className="text-sm text-ink/80">{d.address}</p>

      <ul className="flex flex-wrap gap-2" aria-label="Details (demo data)">
        <Badge strong>Next opening: {opening(d.next_available)}</Badge>
        <Badge strong={d.in_network}>{d.in_network ? 'In-network' : 'Out-of-network'}</Badge>
        <Badge strong={d.accepting_new}>{d.accepting_new ? 'Accepting new patients' : 'Not taking new patients'}</Badge>
        {d.no_referral_required && <Badge>No referral needed</Badge>}
        <Badge>{d.languages.join(', ')}</Badge>
        <li className="self-center text-xs text-muted-text">Demo details</li>
      </ul>

      <a
        href={`https://npiregistry.cms.hhs.gov/provider-view/${d.npi}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-2"
      >
        View in the NPI Registry<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </article>
  )
}

function Badge({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <li
      className={
        'rounded-full px-3 py-1 text-xs ' +
        (strong ? 'bg-primary/10 font-semibold text-primary' : 'bg-card text-ink shadow-sm ring-1 ring-ink/5')
      }
    >
      {children}
    </li>
  )
}
