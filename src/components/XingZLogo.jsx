import { useId } from 'react'
import { brand } from '../content/site.js'

// The real logo from brand.logoSrc; falls back to a drawn mark + wordmark if that's unset.
export default function XingZLogo({ className = '' }) {
  const id = useId().replace(/:/g, '')

  if (brand.logoSrc) {
    // The bolt runs well above and below the letters, so the image is taller than the wordmark it replaces.
    return <img src={brand.logoSrc} alt={brand.name} className={`h-9 sm:h-10 w-auto ${className}`} />
  }

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}cu`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6c3a4" />
            <stop offset="0.5" stopColor="#d9774f" />
            <stop offset="1" stopColor="#8e3f22" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="28" height="28" rx="8" fill={`url(#${id}cu)`} />
        <path
          d="M9 9.5h12L9 20.5h12"
          fill="none"
          stroke="#1a0b05"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-white text-lg sm:text-xl font-semibold tracking-tight">XING-Z</span>
      <span className="sr-only">{brand.name}</span>
    </span>
  )
}
