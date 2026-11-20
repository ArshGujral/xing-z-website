import { TrendingUp } from 'lucide-react'
import { aluTracker } from '../content/site.js'

// Top-bar button to the aluminium rate tracker. Same tab, so it reads as part of the site.
export default function AluRatesLink({ className = '' }) {
  return (
    <a
      href={aluTracker}
      title="Aluminium rate tracker"
      className={`liquid-glass h-9 rounded-full px-3.5 inline-flex items-center gap-1.5 text-white text-sm font-medium whitespace-nowrap hover:bg-white/10 transition-colors ${className}`}
    >
      <TrendingUp className="w-4 h-4" aria-hidden="true" />
      Alu rates
    </a>
  )
}
