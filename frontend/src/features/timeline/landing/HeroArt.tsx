/**
 * Original abstract art for the hero: a soft blue gradient with crisp "time" shapes
 * (annual rings, clock ticks, a calendar dot grid, sweeping timelines).
 * Drawn here, no photos or faces. Crisp edges are what make the blurred background
 * and the sharp window look different. Colors are section 11 tokens.
 */
export default function HeroArt() {
  const rings = [120, 170, 220, 270, 320, 370, 420]
  const ticks = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6)
  const dots: { x: number; y: number }[] = []
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 12; col++) dots.push({ x: 120 + col * 44, y: 150 + row * 44 })
  }

  return (
    <div className="absolute inset-0 bg-linear-to-br from-gradient-from via-primary to-gradient-to">
      <svg
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="1180" cy="380" r="360" className="fill-white/10" />
        <circle cx="320" cy="860" r="320" className="fill-primary-deep/50" />
        <circle cx="820" cy="120" r="140" className="fill-white/5" />

        {rings.map((r) => (
          <circle key={r} cx="1180" cy="380" r={r} fill="none" strokeWidth="1.5" className="stroke-white/35" />
        ))}
        {ticks.map((a) => (
          <line
            key={a}
            x1={1180 + Math.cos(a) * 430}
            y1={380 + Math.sin(a) * 430}
            x2={1180 + Math.cos(a) * 460}
            y2={380 + Math.sin(a) * 460}
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-white/60"
          />
        ))}

        {dots.map((d) => (
          <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r="3" className="fill-white/45" />
        ))}

        <path d="M -40 720 C 380 540, 860 940, 1640 620" fill="none" strokeWidth="2" className="stroke-white/30" />
        <path d="M -40 790 C 420 610, 900 1000, 1640 700" fill="none" strokeWidth="1.5" className="stroke-white/20" />
        <path d="M -40 640 C 340 470, 820 860, 1640 540" fill="none" strokeWidth="1" className="stroke-white/20" />
      </svg>
    </div>
  )
}
