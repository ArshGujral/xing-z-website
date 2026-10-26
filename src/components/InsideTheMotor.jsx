import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import SectionHeading, { container } from './SectionHeading.jsx'
import { asset, pages, parts } from '../content/site.js'

// Coordinates are the motor photo's pixels (456 × 900). The outer shell is that photo clipped along
// its seams. The rotor, bearing and stator are drawn to the same perspective; the capacitor is a photo.
// All inner parts sit hidden inside the shell until they move out.
const MOTOR = { href: asset('products/h-frame-exploded.webp'), width: 456, height: 900 }
const CAPACITOR = { href: asset('parts/capacitor.webp'), x: 187, y: 650, width: 100, height: 229 }

// Where each part ends up, when it starts, and its index in `parts`.
// Parts that move on both axes leave along the shaft first, then slide clear.
const MOVES = {
  cover: { y: -170, delay: 0, part: 2 },
  cup: { y: 150, delay: 0, part: 6 },
  housing: { delay: 0, part: 4 },
  bearings: { y: -330, delay: 150, part: 1 },
  stator: { x: 470, y: -140, delay: 220, part: 3 },
  rotor: { x: -450, y: -220, delay: 300, part: 0 },
  capacitor: { x: 400, y: 160, delay: 360, part: 5 },
}
const SECOND_AXIS_DELAY = 450

// Assembled, the motor is shown larger and centred in the panel.
const ASSEMBLED = { transform: 'translate(62px, -35px) scale(1.12)', origin: '228px 450px' }

// Numbered badges in exploded positions: badge centre and the point its leader touches.
const CALLOUTS = [
  { part: 0, badge: [-420, 169], target: [-322, 169] },
  { part: 1, badge: [1000, -38], target: [287, -38] },
  { part: 2, badge: [1000, 120], target: [443, 120] },
  { part: 3, badge: [1000, 371], target: [893, 371] },
  { part: 4, badge: [-420, 600], target: [18, 600] },
  { part: 5, badge: [1000, 925], target: [689, 925] },
  { part: 6, badge: [-420, 910], target: [24, 910] },
]

// Seams traced from the photo. Neighbouring pieces overlap by a couple of pixels so the
// assembled motor shows no hairlines; the shaft is cut slightly wider than its hole in the cover.
const CLIPS = {
  shaft: 'M217 -5 H259 V282 H217 Z',
  cover: 'M-10 236 H470 V347 H435 A210 68 0 0 1 25 347 H-10 Z M218 236 H258 V281 H218 Z',
  housing: 'M-10 345 H25 A210 68 0 0 0 435 345 H470 V627 H440 A210 70 0 0 1 24 627 H-10 Z',
  cup: 'M-10 625 H24 A210 70 0 0 0 440 625 H470 V910 H-10 Z',
}

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

// Two nested groups per part: the outer moves on x, the inner on y. Exploding, y leads;
// assembling, x leads, so parts retrace their path back into the shell.
function Moving({ name, exploded, active, children }) {
  const m = MOVES[name]
  const both = m.x && m.y
  const axis = (key) => {
    const leads = key === 'y' ? exploded : !exploded
    const delay = (exploded ? m.delay : 0) + (both && !leads ? SECOND_AXIS_DELAY : 0)
    const v = exploded ? m[key] ?? 0 : 0
    return {
      transform: key === 'x' ? `translate(${v}px, 0px)` : `translate(0px, ${v}px)`,
      transition: `transform 0.9s ${EASE} ${delay}ms`,
    }
  }
  const x = axis('x')
  return (
    <g
      style={{
        transform: x.transform,
        opacity: active === null || active === m.part ? 1 : 0.2,
        transition: `${x.transition}, opacity 0.3s ease`,
      }}
    >
      <g style={axis('y')}>{children}</g>
    </g>
  )
}

// Vertical cylinder wall: straight sides plus the visible lower rim.
const wall = (cx, top, bottom, rx, ry) =>
  `M${cx - rx} ${top} L${cx - rx} ${bottom} A${rx} ${ry} 0 0 0 ${cx + rx} ${bottom} L${cx + rx} ${top} Z`

const ring = (cx, cy, rxOut, ryOut, rxIn, ryIn) =>
  `M${cx - rxOut} ${cy} A${rxOut} ${ryOut} 0 1 0 ${cx + rxOut} ${cy} A${rxOut} ${ryOut} 0 1 0 ${cx - rxOut} ${cy} Z ` +
  `M${cx - rxIn} ${cy} A${rxIn} ${ryIn} 0 1 0 ${cx + rxIn} ${cy} A${rxIn} ${ryIn} 0 1 0 ${cx - rxIn} ${cy} Z`

const around = (count, fn) => Array.from({ length: count }, (_, k) => fn((k / count) * Math.PI * 2, k))

function Rotor({ fill }) {
  const cx = 237
  return (
    <>
      <rect x="223" y="262" width="28" height="246" rx="6" fill={fill.shaft} />
      <path d={wall(cx, 305, 455, 105, 34)} fill={fill.steel} />
      <path d={wall(cx, 305, 455, 105, 34)} fill={fill.skew} />
      <path d={wall(cx, 305, 325, 105, 34)} fill={fill.alu} />
      <path d={wall(cx, 435, 455, 105, 34)} fill={fill.alu} />
      <ellipse cx={cx} cy="305" rx="105" ry="34" fill={fill.aluTop} />
      {around(12, (a, k) => (
        <line
          key={k}
          x1={cx + Math.cos(a) * 105 * 0.5}
          y1={305 + Math.sin(a) * 34 * 0.5}
          x2={cx + Math.cos(a) * 105 * 0.88}
          y2={305 + Math.sin(a) * 34 * 0.88}
          stroke="#7d838a"
          strokeWidth="6"
          strokeLinecap="round"
        />
      ))}
      <ellipse cx={cx} cy="305" rx="34" ry="11" fill="#3a3f45" />
      <rect x="223" y="262" width="28" height="44" fill={fill.shaft} />
    </>
  )
}

function Bearing({ fill }) {
  const cx = 237
  const cy = 284
  const rx = 46
  const ry = 15
  return (
    <>
      <path d={wall(cx, cy, cy + 16, rx, ry)} fill={fill.steel} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#e3e6e9" />
      <ellipse cx={cx} cy={cy} rx={rx * 0.8} ry={ry * 0.8} fill="#24272b" />
      {around(12, (a, k) => (
        <circle key={k} cx={cx + Math.cos(a) * rx * 0.66} cy={cy + Math.sin(a) * ry * 0.66} r="4.2" fill={fill.ball} />
      ))}
      <ellipse cx={cx} cy={cy} rx={rx * 0.5} ry={ry * 0.5} fill="#cfd3d7" />
      <ellipse cx={cx} cy={cy} rx={rx * 0.32} ry={ry * 0.32} fill="#0c0d0e" />
    </>
  )
}

function Stator({ fill }) {
  const cx = 232
  const top = 420
  const copperTop = 384
  const band = `M${cx - 170} ${copperTop} A170 55 0 0 0 ${cx + 170} ${copperTop} L${cx + 170} ${top} A170 55 0 0 1 ${cx - 170} ${top} Z`
  return (
    <>
      <path d={wall(cx, top, 600, 188, 60)} fill={fill.steel} />
      <path d={wall(cx, top, 600, 188, 60)} fill={fill.stack} />
      <path d={ring(cx, top, 188, 60, 120, 39)} fill="#aeb3b8" fillRule="evenodd" />
      <ellipse cx={cx} cy={copperTop} rx="122" ry="40" fill="#0b0b0b" />
      {/* Copper end turns standing proud of the stack */}
      <path d={band} fill={fill.copper} />
      <path d={band} fill={fill.turns} />
      <path d={ring(cx, copperTop, 170, 55, 122, 40)} fill={fill.copperTop} fillRule="evenodd" />
      {around(18, (a, k) => (
        <line
          key={k}
          x1={cx + Math.cos(a) * 124}
          y1={copperTop + Math.sin(a) * 40.5}
          x2={cx + Math.cos(a) * 168}
          y2={copperTop + Math.sin(a) * 54.5}
          stroke="rgba(70, 20, 8, 0.55)"
          strokeWidth="2.5"
        />
      ))}
    </>
  )
}

function MotorPiece({ id, clip }) {
  return (
    <image
      href={MOTOR.href}
      x="0"
      y="0"
      width={MOTOR.width}
      height={MOTOR.height}
      clipPath={`url(#${id}-clip-${clip})`}
    />
  )
}

export default function InsideTheMotor() {
  const id = useId().replace(/:/g, '')
  const panelRef = useRef(null)
  const [exploded, setExploded] = useState(false)
  const [active, setActive] = useState(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setExploded(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setExploded(true)
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(panelRef.current)
    return () => observer.disconnect()
  }, [])

  const url = (name) => `url(#${id}-${name})`
  const motion = { exploded, active }
  const fill = Object.fromEntries(
    ['steel', 'alu', 'aluTop', 'shaft', 'skew', 'stack', 'copper', 'copperTop', 'turns', 'ball'].map((n) => [n, url(n)]),
  )

  return (
    <section id="inside" data-ink="light" data-logo="white" className="field-steel">
      <div className={`${container} py-28 md:py-40`}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <SectionHeading
            title="Take one apart."
            intro="Every Xing-Z motor is built from named components. Here's what goes into our H Frame motor."
          />
          <a
            href={pages.inside}
            className="inline-flex items-center gap-1.5 self-start md:self-auto text-base font-medium text-accent hover:text-accent-hi whitespace-nowrap transition-colors"
          >
            Full materials breakdown
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="mt-14 md:mt-20 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12 items-center">
          <div>
            <div
              ref={panelRef}
              data-reveal
              className="relative aspect-[1540/1370] overflow-hidden bg-[#183c37]"
            >
              <button
                onClick={() => setExploded((e) => !e)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 rounded-full bg-white text-on-fg px-5 py-2 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                {exploded ? 'Assemble' : 'Explode'}
              </button>

              <svg
                viewBox="-480 -270 1540 1370"
                className="absolute inset-0 w-full h-full"
                role="img"
                aria-label="Exploded view of a Xing-Z H Frame motor"
              >
                <defs>
                  {Object.entries(CLIPS).map(([name, d]) => (
                    <clipPath key={name} id={`${id}-clip-${name}`}>
                      <path d={d} clipRule="evenodd" />
                    </clipPath>
                  ))}
                  <linearGradient id={`${id}-shaft`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#0d2b27" />
                    <stop offset="0.3" stopColor="#2f6b61" />
                    <stop offset="0.42" stopColor="#4f8f84" />
                    <stop offset="0.7" stopColor="#173f39" />
                    <stop offset="1" stopColor="#0a201d" />
                  </linearGradient>
                  {/* The cover behind the shaft, which the photo never shows: sampled beside the shaft, row by row */}
                  <linearGradient id={`${id}-notch`} x1="0" y1="0" x2="0" y2="1">
                    {[
                      [0, '#a6a6a6'], [0.12, '#b4b4b4'], [0.2, '#bfbfbf'], [0.24, '#c7c7c7'], [0.29, '#bbbbbb'],
                      [0.32, '#b4b4b5'], [0.34, '#888889'], [0.37, '#565656'], [0.44, '#747374'], [0.54, '#565557'],
                      [0.66, '#484848'], [0.8, '#3e3e3e'], [1, '#3a3a3a'],
                    ].map(([offset, color]) => (
                      <stop key={offset} offset={offset} stopColor={color} />
                    ))}
                  </linearGradient>
                  <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#3c4045" />
                    <stop offset="0.18" stopColor="#9aa0a6" />
                    <stop offset="0.3" stopColor="#d7dbdf" />
                    <stop offset="0.55" stopColor="#8b9197" />
                    <stop offset="0.85" stopColor="#474c52" />
                    <stop offset="1" stopColor="#2a2d31" />
                  </linearGradient>
                  <linearGradient id={`${id}-alu`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#6f757b" />
                    <stop offset="0.3" stopColor="#e6e9ec" />
                    <stop offset="0.6" stopColor="#9aa0a6" />
                    <stop offset="1" stopColor="#4f545a" />
                  </linearGradient>
                  <linearGradient id={`${id}-aluTop`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f0f2f4" />
                    <stop offset="1" stopColor="#aab0b6" />
                  </linearGradient>
                  <pattern id={`${id}-skew`} width="9" height="10" patternUnits="userSpaceOnUse" patternTransform="skewX(-18)">
                    <rect x="7" width="1.4" height="10" fill="rgba(0, 0, 0, 0.35)" />
                  </pattern>
                  <pattern id={`${id}-stack`} width="10" height="6" patternUnits="userSpaceOnUse">
                    <rect y="5" width="10" height="0.8" fill="rgba(0, 0, 0, 0.35)" />
                  </pattern>
                  <linearGradient id={`${id}-copper`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#5a1e0b" />
                    <stop offset="0.25" stopColor="#f2a57e" />
                    <stop offset="0.5" stopColor="#c8643d" />
                    <stop offset="0.8" stopColor="#7a2e14" />
                    <stop offset="1" stopColor="#3e1608" />
                  </linearGradient>
                  <linearGradient id={`${id}-copperTop`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f6b18c" />
                    <stop offset="1" stopColor="#b85a33" />
                  </linearGradient>
                  <pattern id={`${id}-turns`} width="10" height="3.6" patternUnits="userSpaceOnUse">
                    <rect y="2.8" width="10" height="0.8" fill="rgba(60, 15, 5, 0.5)" />
                  </pattern>
                  <radialGradient id={`${id}-ball`} cx="0.35" cy="0.35" r="0.65">
                    <stop offset="0" stopColor="#ffffff" />
                    <stop offset="1" stopColor="#7d838a" />
                  </radialGradient>
                  <radialGradient id={`${id}-floor`}>
                    <stop offset="0" stopColor="#000" stopOpacity="0.7" />
                    <stop offset="1" stopColor="#000" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <g
                  style={{
                    transform: exploded ? 'translate(0px, 0px) scale(1)' : ASSEMBLED.transform,
                    transformOrigin: ASSEMBLED.origin,
                    transition: `transform 1.1s ${EASE}`,
                  }}
                >
                  {/* Back to front. Inner parts sit hidden inside the shell until they move out. */}
                  <Moving name="housing" {...motion}>
                    <ellipse cx="232" cy="330" rx="212" ry="68" fill="#161616" />
                    <ellipse cx="232" cy="336" rx="198" ry="60" fill="#070707" />
                  </Moving>
                  <Moving name="rotor" {...motion}>
                    <Rotor fill={fill} />
                  </Moving>
                  <Moving name="bearings" {...motion}>
                    <Bearing fill={fill} />
                  </Moving>
                  <Moving name="stator" {...motion}>
                    <Stator fill={fill} />
                  </Moving>
                  <Moving name="capacitor" {...motion}>
                    <image {...CAPACITOR} />
                  </Moving>
                  <Moving name="cup" {...motion}>
                    <ellipse cx="232" cy="905" rx="215" ry="26" fill={url('floor')} />
                    <ellipse cx="232" cy="617" rx="210" ry="70" fill="#161616" />
                    <ellipse cx="232" cy="621" rx="198" ry="63" fill="#070707" />
                    <MotorPiece id={id} clip="cup" />
                  </Moving>
                  <Moving name="housing" {...motion}>
                    <MotorPiece id={id} clip="housing" />
                  </Moving>
                  <Moving name="cover" {...motion}>
                    <path d="M218 245 Q238 237 258 244 V281 H218 Z" fill={url('notch')} />
                    <MotorPiece id={id} clip="cover" />
                  </Moving>
                  {/* The visible shaft stays on top, so the assembled motor matches the photo exactly */}
                  <Moving name="rotor" {...motion}>
                    <MotorPiece id={id} clip="shaft" />
                  </Moving>

                  <g style={{ opacity: exploded ? 1 : 0, transition: `opacity 0.5s ease ${exploded ? 1300 : 0}ms` }}>
                    {CALLOUTS.map(({ part, badge: [bx, by], target: [tx, ty] }) => {
                      const dim = active !== null && active !== part
                      return (
                        <g key={part} style={{ opacity: dim ? 0.25 : 1, transition: 'opacity 0.3s ease' }}>
                          <line
                            x1={bx > tx ? bx - 44 : bx + 44}
                            y1={by}
                            x2={tx}
                            y2={ty}
                            stroke="#d9774f"
                            strokeWidth="3"
                            strokeDasharray="10 8"
                            opacity="0.7"
                          />
                          <circle cx={tx} cy={ty} r="7" fill="#f0ad87" />
                          <circle cx={bx} cy={by} r="40" style={{ fill: 'rgb(var(--accent))' }} />
                          <text x={bx} y={by + 14} textAnchor="middle" fontSize="40" fontWeight="600" style={{ fill: 'rgb(var(--on-fg))' }}>
                            {part + 1}
                          </text>
                        </g>
                      )
                    })}
                  </g>
                </g>
              </svg>
            </div>
            {/* Below the panel rather than inside it, where it collided with the capacitor on phones */}
            <p className="mt-3 text-white text-sm">
              Outer parts and capacitor photographed; inner parts illustrated.
            </p>
          </div>

          <ol className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
            {parts.map((part, i) => (
              <li
                key={part.name}
                data-reveal
                style={{ '--i': i }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className="flex items-center gap-4 bg-[#183c37] p-3 pr-5 transition-colors hover:bg-[#143430]"
              >
                <img src={part.thumb} alt="" loading="lazy" className="w-20 h-20 flex-none object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="w-6 h-6 flex-none rounded-full bg-accent text-on-fg text-[13px] font-semibold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <h3 className="text-white text-lg leading-snug">{part.name}</h3>
                    {part.brand && <span className="ml-auto flex-none text-accent text-sm">{part.brand}</span>}
                  </div>
                  <p className="mt-1 text-white text-sm leading-snug">{part.role}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
