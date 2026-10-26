import { container } from './SectionHeading.jsx'
import { stats } from '../content/site.js'

export default function TrustStrip() {
  return (
    <section aria-label="Xing-Z in numbers" className="border-y border-white/10 bg-page-2">
      <div className={`${container} grid grid-cols-2 md:grid-cols-4`}>
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`py-8 md:py-10 px-3 md:px-8 text-center md:text-left border-white/10 ${
              i % 2 ? 'border-l' : ''
            } ${i >= 2 ? 'border-t md:border-t-0' : ''} ${i === 2 ? 'md:border-l' : ''}`}
          >
            <div className="text-copper text-3xl sm:text-4xl xl:text-5xl font-medium tracking-[-0.02em] whitespace-nowrap">
              {stat.value}
            </div>
            <div className="mt-2 text-white/60 text-xs sm:text-sm">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
