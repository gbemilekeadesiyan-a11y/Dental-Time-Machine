import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Disclaimer from '../../components/Disclaimer'
import Notice from '../../components/Notice'
import type { AppState } from '../../state'
import AssistantBar from './AssistantBar'
import CostCheck from './CostCheck'
import DentistResults from './DentistResults'
import FilterPanel from './FilterPanel'
import PlanCompare from './PlanCompare'
import { FILTER_LABELS, activeKeys, describeValue } from './filterOptions'
import { clearAllFilters, clearFilter, useFilterStore } from './filterStore'

interface Props {
  state: AppState
  onEditCare: () => void
}

/** Age only changes which notes show, never prices (CLAUDE.md section 10). */
const AGE_NOTES = {
  under_18: 'For children, a pediatric dentist specializes in kids’ care. Check that your child is on your plan.',
  '18_64': null,
  '65_plus':
    'Original Medicare usually doesn’t cover routine dental care. Check whether you have a separate dental or Medicare Advantage plan.',
} as const

/** Find dental care: one set of filters, set by hand or by asking in plain words. */
export default function FindCare({ state, onEditCare }: Props) {
  const { filters } = useFilterStore()
  const ageNote = filters.age_range ? AGE_NOTES[filters.age_range] : null

  return (
    <section aria-labelledby="find-care-title" className="space-y-6">
      <div className="space-y-2">
        <h2 id="find-care-title" className="text-4xl font-light tracking-tight text-ink sm:text-5xl">
          Find dental care
        </h2>
        <p className="text-ink/80">Search for dentists near you. Ask in your own words or use the filters, whichever is easier.</p>
      </div>

      <AssistantBar />
      <ActiveChips />
      <FilterPanel />
      {ageNote && <Notice>{ageNote}</Notice>}
      <CostCheck filters={filters} myPlan={state.plan} onEditCare={onEditCare} />
      {/* Mount point (feature/plan-compare): the user's care priced under each plan option. */}
      <PlanCompare state={state} onEditCare={onEditCare} />
      <DentistResults filters={filters} />
      <Disclaimer />
    </section>
  )
}

/** The filters in use, as removable pills. They animate in as the assistant sets them. */
function ActiveChips() {
  const { filters } = useFilterStore()
  const reduceMotion = useReducedMotion()
  const keys = activeKeys(filters)
  if (keys.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filters in use">
      <AnimatePresence initial={false} mode="popLayout">
        {keys.map((key) => (
          <motion.span
            key={key}
            layout={!reduceMotion}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary/10 py-1 pr-1 pl-3 text-sm text-primary"
          >
            <span>
              <span className="font-semibold">{FILTER_LABELS[key]}:</span> {describeValue(key, filters[key])}
            </span>
            <button
              type="button"
              onClick={() => clearFilter(key)}
              aria-label={`Remove ${FILTER_LABELS[key]} filter`}
              className="grid size-7 place-items-center rounded-full hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span aria-hidden="true">×</span>
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <button
        type="button"
        onClick={clearAllFilters}
        className="min-h-9 px-2 text-sm font-medium text-ink underline decoration-muted underline-offset-4 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-primary"
      >
        Clear all
      </button>
    </div>
  )
}
