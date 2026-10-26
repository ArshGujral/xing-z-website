import { container } from './SectionHeading.jsx'
import { external, partnerOffers, partnerSteps, whatsappLink } from '../content/site.js'

// Dealers & OEM on the paper field: the two offers side by side as plain lists, then how to start,
// its order carried by position.
export default function Dealers() {
  return (
    <section id="dealers" data-ink="dark" data-logo="black" className="field-paper">
      <div className={`${container} py-28 md:py-40`}>
        <h2 data-reveal className="max-w-3xl text-white text-[2rem] sm:text-5xl lg:text-[3.5rem] leading-[1.02] tracking-[-0.03em]">
          Sell it, or build it into your coolers.
        </h2>
        <p data-reveal style={{ '--i': 1 }} className="mt-6 max-w-xl text-white text-base sm:text-lg leading-relaxed">
          Dealer pricing, OEM volumes and repair stock. Tell us what you need and we'll reply on WhatsApp.
        </p>

        <div className="mt-16 md:mt-24 grid grid-cols-1 md:grid-cols-2 gap-14 md:gap-16">
          {partnerOffers.map((offer, i) => (
            <div key={offer.title} data-reveal style={{ '--i': i + 1 }} className="flex flex-col">
              <h3 className="text-white text-3xl tracking-[-0.02em]">{offer.title}</h3>
              <ul className="mt-7 space-y-4 flex-1">
                {offer.points.map((point) => (
                  <li key={point} className="text-white text-lg leading-snug">
                    {point}
                  </li>
                ))}
              </ul>
              <a
                href={whatsappLink(offer.cta.message)}
                {...external}
                className={`mt-9 self-start px-7 py-3.5 rounded-full text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
                  i === 0 ? 'bg-white text-on-fg' : 'bg-[rgb(var(--tone))] text-white'
                }`}
              >
                {offer.cta.label}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-20 md:mt-28 bg-[rgb(var(--tone))] px-6 sm:px-10 py-10 sm:py-12">
          <h3 data-reveal className="text-white text-3xl tracking-[-0.02em]">How to start</h3>
          <ol className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {partnerSteps.map((step, i) => (
              <li key={step.title} data-reveal style={{ '--i': i + 1 }}>
                <h4 className="text-white text-lg font-semibold">{step.title}</h4>
                <p className="mt-2 max-w-[32ch] text-white text-base sm:text-lg leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
