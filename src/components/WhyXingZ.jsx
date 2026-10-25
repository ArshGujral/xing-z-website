import { Cable, Handshake, ShieldCheck, Truck } from 'lucide-react'
import SectionHeading, { container } from './SectionHeading.jsx'
import { reasons } from '../content/site.js'

const ICONS = { winding: Cable, testing: ShieldCheck, supply: Truck, support: Handshake }

export default function WhyXingZ() {
  return (
    <section id="why" className="pt-24 pb-20 md:py-28 border-t border-white/5">
      <div className={container}>
        <SectionHeading
          eyebrow="Why Xing-Z"
          title="Built better"
          muted="where it counts."
          intro="Four things buyers ask about before they switch suppliers, and how we answer them."
        />

        <div className="mt-12 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((reason) => {
            const Icon = ICONS[reason.icon]
            return (
              <div
                key={reason.title}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors hover:border-[#d9774f]/50"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#d9774f]/15 border border-[#d9774f]/30 text-[#f0ad87]">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-5 text-white text-lg font-medium tracking-tight">{reason.title}</h3>
                <p className="mt-2 text-white/60 text-sm leading-relaxed">{reason.text}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
