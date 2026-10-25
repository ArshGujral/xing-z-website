import CopperWires from './CopperWires.jsx'
import { container } from './SectionHeading.jsx'
import { external, whatsappLink } from '../content/site.js'

export default function FinalCta() {
  return (
    <section id="dealers" className="relative overflow-hidden border-t border-white/5">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#1a110b_0%,#0b0706_60%,#050303_100%)]" />
      <CopperWires className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_50%,rgba(5,3,2,0.82)_0%,rgba(5,3,2,0.45)_60%,transparent_100%)]" />

      <div className={`relative ${container} py-24 md:py-36 text-center`}>
        <p className="text-[#e39a73] text-xs sm:text-sm font-medium uppercase tracking-[0.18em]">Dealers & OEM</p>
        <h2 className="mt-4 text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
          Sell the motor
          <br />
          <span className="text-white/60">built to last the season.</span>
        </h2>
        <p className="text-white/80 text-sm sm:text-base md:text-lg leading-relaxed max-w-md mx-auto mt-6 sm:mt-8">
          Dealer pricing, OEM volumes and repair stock. Tell us what you need and we'll reply on WhatsApp.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
          <a
            href={whatsappLink("Hi Xing-Z, I'd like to become a dealer.")}
            {...external}
            className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-900 text-sm font-semibold rounded-full hover:bg-white/90 transition-colors"
          >
            Become a dealer
          </a>
          <a
            href={whatsappLink()}
            {...external}
            className="px-5 sm:px-6 py-2.5 sm:py-3 liquid-glass rounded-full text-white text-sm font-semibold hover:bg-white/10 transition-colors"
          >
            Get a quote on WhatsApp
          </a>
        </div>
      </div>
    </section>
  )
}
