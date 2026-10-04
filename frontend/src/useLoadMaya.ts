import { useCallback, useState, type Dispatch } from 'react'
import { ApiError, getDemo } from './api'
import type { Action } from './state'

/** Loads Maya's demo procedures and plan. Shared by the start screen and Tell us. */
export function useLoadMaya(dispatch: Dispatch<Action>) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Resolves true when Maya loaded, false when it failed (the error is in `error`). */
  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const demo = await getDemo()
      dispatch({ type: 'loaded_demo', procedures: demo.procedures, plan: demo.plan })
      return true
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  return { load, loading, error }
}
