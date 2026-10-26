import { MeshGradient } from '@paper-design/shaders-react'

// Original palettes from the shadcn component; pass `colors` / `overlayColors` to restyle it.
const VIOLET = ['#000000', '#8b5cf6', '#ffffff', '#1e1b4b', '#4c1d95']
const VIOLET_OVERLAY = ['#000000', '#ffffff', '#8b5cf6', '#000000']

// An animated mesh-gradient backdrop: a full-strength mesh with a slower, fainter one over it for depth.
// Ported from hero-shader.tsx. The current @paper-design/shaders-react has no `wireframe` or
// `backgroundColor` props, so the overlay is a plain second mesh.
export function ShaderBackground({
  children,
  className = 'min-h-[650px] w-full relative overflow-hidden',
  colors = VIOLET,
  overlayColors = VIOLET_OVERLAY,
}) {
  return (
    <div className={className}>
      {/* SVG filters for children that want them: style={{ filter: 'url(#glass-effect)' }} or url(#gooey-filter) */}
      <svg className="absolute inset-0 w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <filter id="gooey-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="gooey" />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
        </defs>
      </svg>

      <MeshGradient className="absolute inset-0 w-full h-full" colors={colors} speed={0.3} />
      <MeshGradient className="absolute inset-0 w-full h-full opacity-60" colors={overlayColors} speed={0.2} />

      {children}
    </div>
  )
}
