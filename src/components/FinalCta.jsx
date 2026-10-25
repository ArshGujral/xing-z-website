import { Check, Factory, Store } from 'lucide-react'
import CopperWires from './CopperWires.jsx'
import { container } from './SectionHeading.jsx'
import { external, partnerOffers, partnerSteps, whatsappLink } from '../content/site.js'

const ICONS = { store: Store, factory: Factory }

export default function FinalCta() {
  return (
    <section id="dealers" className="relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 bg-stage" />
      <CopperWires className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-hush-wide" />

      <div className={`relative ${container} py-24 md:py-32`}>
        <div className="text-center">
          <p className="text-accent text-xs sm:text-sm font-medium uppercase tracking-[0.18em]">Dealers & OEM</p>
          <h2 className="mt-4 text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
            Sell the motor
            <br />
            <span className="text-white/60">built to last the season.</span>
          </h2>
          <p className="text-white/80 text-sm sm:text-base md:text-lg leading-relaxed max-w-md mx-auto mt-6 sm:mt-8">
            Dealer pricing, OEM volumes and repair stock. Tell us what you need and we'll reply on WhatsApp.
          </p>
        </div>

        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
          {partnerOffers.map((offer, i) => {
            const Icon = ICONS[offer.icon]
            return (
              <div
                key={offer.title}
                className="liquid-glass !bg-page/50 rounded-3xl p-6 sm:p-8 flex flex-col"
              >
                <span className="w-11 h-11 rounded-xl border border-[#d9774f]/40 bg-[#d9774f]/10 flex items-center justify-center text-accent-soft">
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="mt-5 text-white text-xl sm:text-2xl font-medium tracking-[-0.01em]">{offer.title}</h3>
                <ul className="mt-5 space-y-3 flex-1">
                  {offer.points.map((point) => (
                    <li key={point} className="flex gap-3 text-white/75 text-sm sm:text-base leading-snug">
                      <Check className="w-4 h-4 mt-0.5 flex-none text-accent" />
                      {point}
                    </li>
                  ))}
                </ul>
                <a
                  href={whatsappLink(offer.cta.message)}
                  {...external}
                  className={`mt-7 self-start px-5 sm:px-6 py-2.5 sm:py-3 rounded-full text-sm font-semibold transition-colors ${
                    i === 0
                      ? 'bg-white text-page hover:bg-white/90'
                      : 'liquid-glass text-white hover:bg-white/10'
                  }`}
                >
                  {offer.cta.label}
                </a>
              </div>
            )
          })}
        </div>

        <div className="mt-4 md:mt-6 max-w-5xl mx-auto liquid-glass !bg-page/50 rounded-3xl p-6 sm:p-8">
          <p className="text-center text-white/50 text-xs sm:text-sm font-medium uppercase tracking-[0.18em]">How to start</p>
          <ol className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4">
            {partnerSteps.map((step, i) => (
              <li key={step.title} className="flex sm:flex-col gap-4 sm:gap-3 sm:items-center sm:text-center">
                <span className="w-9 h-9 flex-none rounded-full border border-[#d9774f]/70 text-accent-soft text-sm font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-white text-base font-medium">{step.title}</h3>
                  <p className="mt-1 text-white/60 text-sm leading-relaxed sm:max-w-[16rem] sm:mx-auto">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
