import { DISCLAIMER } from '../copy'

/** Shown on every result screen (CLAUDE.md section 10). */
export default function Disclaimer() {
  return <p className="border-t border-line pt-4 text-sm text-muted">{DISCLAIMER}</p>
}
