import { useId } from 'react'

const FINISHES = {
  Graphite: ['#5a5f66', '#1d1f23'],
  Silver: ['#e1e4e8', '#80868d'],
  Copper: ['#f0ad87', '#8e3f1f'],
}

const fade = (on) => ({ opacity: on ? 1 : 0, transition: 'opacity 0.5s ease' })

// Side view of a cooler motor, drawn until real product photos are added.
// Every optional part is always rendered and faded in/out, so variant changes animate.
export default function Motor({
  finish = 'Graphite',
  mount = 'standard', // standard | hframe | strainer | none
  attachment = 'blades', // blades | blower | pump | none
  fast = false,
  cap = false,
  clamp = false,
  plate = 'XZ',
  className = '',
}) {
  const id = useId().replace(/:/g, '')
  const [hi, lo] = FINISHES[finish] ?? FINISHES.Graphite
  const tone = (color) => ({ stopColor: color, transition: 'stop-color 0.6s ease' })
  const solid = { fill: lo, transition: 'fill 0.6s ease' }
  const shaft = attachment === 'pump' ? 16 : attachment === 'blower' ? 18 : 32
  const x0 = 186 + shaft
  const body = `url(#${id}b)`
  const steel = `url(#${id}s)`
  const copper = `url(#${id}c)`

  return (
    <svg viewBox="0 0 260 170" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={tone(lo)} />
          <stop offset="0.22" style={tone(hi)} />
          <stop offset="0.7" style={tone(lo)} />
          <stop offset="1" style={tone(lo)} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6e747b" />
          <stop offset="0.35" stopColor="#f4f6f8" />
          <stop offset="1" stopColor="#4d5257" />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a2610" />
          <stop offset="0.3" stopColor="#f5b08a" />
          <stop offset="0.55" stopColor="#c8643d" />
          <stop offset="1" stopColor="#4f1b0a" />
        </linearGradient>
        <pattern id={`${id}w`} x="0" y="58" width="4" height="52" patternUnits="userSpaceOnUse">
          <rect width="4" height="52" fill={copper} />
          <rect x="3.2" width="0.8" height="52" fill="rgba(45, 12, 4, 0.55)" />
        </pattern>
        <radialGradient id={`${id}g`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.6" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="135" cy="156" rx="112" ry="9" fill={`url(#${id}g)`} />

      {/* Air rush for high-speed variants */}
      <g style={fade(fast)} stroke="#e39a73" strokeWidth="2" strokeLinecap="round" strokeDasharray="14 26">
        <line className="animate-speed-dash" x1="4" y1="70" x2="44" y2="70" />
        <line className="animate-speed-dash" x1="12" y1="84" x2="46" y2="84" />
        <line className="animate-speed-dash" x1="4" y1="98" x2="44" y2="98" />
      </g>

      {/* Mounts */}
      <g style={fade(mount === 'hframe')} fill={steel}>
        <rect x="80" y="60" width="9" height="86" rx="2" />
        <rect x="152" y="60" width="9" height="86" rx="2" />
        <rect x="62" y="140" width="118" height="8" rx="3" />
      </g>
      <g style={fade(mount === 'strainer')}>
        <rect x="72" y="120" width="100" height="26" rx="5" fill="#1d2024" />
        {Array.from({ length: 11 }, (_, i) => (
          <rect key={i} x={78 + i * 8.6} y="124" width="4" height="18" rx="2" fill="#3d4248" />
        ))}
      </g>
      <g style={fade(mount === 'standard')}>
        <rect x="78" y="118" width="86" height="12" rx="3" style={solid} />
        <rect x="68" y="128" width="30" height="7" rx="2" fill={steel} />
        <rect x="144" y="128" width="30" height="7" rx="2" fill={steel} />
      </g>

      {/* Shaft, end bells and housing */}
      <rect x="184" y="80" width={shaft + 4} height="8" rx="2" fill={steel} />
      <rect x="168" y="56" width="20" height="56" rx="7" fill={body} />
      <rect x="50" y="52" width="22" height="64" rx="9" fill={body} />
      <rect x="62" y="44" width="114" height="80" rx="16" fill={body} />
      <rect x="80" y="58" width="80" height="52" rx="6" fill={`url(#${id}w)`} />
      <rect x="80" y="58" width="80" height="52" rx="6" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
      {[69, 81, 93].map((y) => (
        <rect key={y} x="80" y={y} width="80" height="4" style={solid} />
      ))}
      <rect x="128" y="112" width="34" height="9" rx="2" fill="#d8d2c8" />
      <text x="145" y="118.6" textAnchor="middle" fontSize="6" fontWeight="700" fill="#2a2420" letterSpacing="0.5">
        {plate}
      </text>

      <g style={fade(clamp)}>
        <rect x="104" y="38" width="14" height="92" rx="4" fill="none" stroke={steel} strokeWidth="4" />
      </g>

      {/* Terminal box and supply lead */}
      <path d="M94 40 C 94 20, 62 16, 26 24" fill="none" stroke="#141414" strokeWidth="5" strokeLinecap="round" />
      <path d="M93 39 C 93 19, 62 15, 26 23" fill="none" stroke="#3c3c3c" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="18" y="21" width="9" height="6" rx="1.5" fill={copper} />
      <rect x="84" y="34" width="22" height="12" rx="3" fill="#222428" />

      <g style={fade(cap)}>
        <path d="M122 36 C 114 40, 110 40, 104 40" fill="none" stroke="#141414" strokeWidth="3" />
        <rect x="116" y="10" width="46" height="30" rx="10" fill="#2b3442" />
        <rect x="116" y="17" width="46" height="4" fill="#8a94a3" opacity="0.6" />
        <rect x="126" y="25" width="26" height="9" rx="2" fill="#e8e3da" />
      </g>

      {/* Attachments on the shaft */}
      <g style={fade(attachment === 'blades')}>
        <rect x={x0 - 4} y="74" width="12" height="20" rx="3" fill="#25282c" />
        <ellipse cx={x0 + 10} cy="84" rx="6" ry="58" fill={steel} opacity="0.9" />
        <ellipse cx={x0 + 10} cy="84" rx="2.5" ry="58" fill="rgba(0, 0, 0, 0.35)" />
        <g style={fade(fast)}>
          <ellipse className="animate-blade" cx={x0 + 10} cy="84" rx="14" ry="62" fill="rgba(230, 235, 240, 0.2)" />
        </g>
      </g>
      <g style={fade(attachment === 'blower')}>
        <rect x={x0} y="30" width="40" height="108" rx="8" fill="#202327" />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={x0 + 4 + i * 4} y="36" width="2" height="96" rx="1" fill="#6b7178" />
        ))}
        <rect x={x0} y="30" width="40" height="8" rx="4" fill={steel} />
        <rect x={x0} y="130" width="40" height="8" rx="4" fill={steel} />
      </g>
      <g style={fade(attachment === 'pump')}>
        <rect x={x0 + 14} y="36" width="12" height="40" rx="3" fill="#2a2e33" />
        <rect x={x0 + 12} y="32" width="16" height="6" rx="2" fill="#3a3f45" />
        <circle cx={x0 + 20} cy="94" r="26" fill="#1f2226" />
        <circle cx={x0 + 20} cy="94" r="18" fill="none" stroke="#3a3f45" strokeWidth="2" />
        <circle cx={x0 + 20} cy="94" r="5" fill={steel} />
      </g>
    </svg>
  )
}
