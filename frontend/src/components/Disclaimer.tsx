import { DISCLAIMER } from '../copy'

/** Shown on every result screen (CLAUDE.md section 10). Sits on the page background, so it uses ink. */
export default function Disclaimer() {
  return <p className="border-t border-ink/10 pt-4 text-sm text-ink/75">{DISCLAIMER}</p>
}
