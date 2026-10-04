/** Path of the hero photo (public/landing/, credits in CREDITS.md). 2560x1707 (3:2). */
export const HERO_PHOTO = '/landing/hero.webp'

/**
 * The hero photo: a dentist's gloved hands with a mirror and probe at a smiling patient.
 *
 * "fit": about 70% of the screen, centered, no backdrop. FocusHero draws it twice
 * (blurred behind, sharp in the window); positioning lives in landing.css (.hero-photo).
 * "fill": stretched to cover the whole hero over an ink backdrop. Used once, very blurred,
 * to fill the space around the smaller photo. The ink only shows if the photo fails to
 * load, and white text stays readable on it. Drawn twice by
 * FocusHero: blurred behind, sharp in the window. Positioning lives in landing.css
 * (.hero-photo) and uses viewport units, so both copies line up exactly.
 * Decorative: the headline carries the meaning, so alt is empty.
 */
export default function HeroPhoto({ variant, priority = false }: { variant: 'fit' | 'fill'; priority?: boolean }) {
  return (
    <div className={'absolute inset-0 ' + (variant === 'fill' ? 'bg-ink' : '')}>
      <img
        src={HERO_PHOTO}
        alt=""
        width={2560}
        height={1707}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        draggable={false}
        className={(variant === 'fill' ? 'hero-photo-cover' : 'hero-photo') + ' select-none'}
      />
    </div>
  )
}
