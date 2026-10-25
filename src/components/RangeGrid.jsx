import { ArrowUpRight } from 'lucide-react'
import Motor from './Motor.jsx'
import SectionHeading, { container } from './SectionHeading.jsx'
import { categories, external, whatsappLink } from '../content/site.js'

function RangeCard({ category }) {
  return (
    <article
      id={category.slug}
      className="group relative rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden scroll-mt-24 transition-colors hover:border-[#d9774f]/50"
    >
      <div className="relative aspect-[4/3] bg-[radial-gradient(ellipse_at_50%_62%,rgba(217,119,79,0.2),transparent_65%)]">
        {category.image ? (
          <>
            {/* Spotlight and floor shadow so black housings read against the dark card */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_55%_at_50%_45%,rgba(255,226,206,0.13),transparent_70%)]" />
            <div className="absolute left-1/2 bottom-[7%] -translate-x-1/2 w-1/2 h-5 rounded-[50%] bg-black/80 blur-md" />
            <img
              src={category.image}
              alt={category.name}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-contain px-6 pt-6 pb-5 transition-transform duration-500 group-hover:scale-[1.04] drop-shadow-[0_14px_22px_rgba(0,0,0,0.55)]"
            />
          </>
        ) : (
          <Motor
            {...category.motor}
            className="absolute inset-0 w-full h-full p-6 sm:p-8 transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="p-5 sm:p-6 border-t border-white/5">
        <h3 className="text-white text-lg font-medium tracking-tight">{category.name}</h3>
        <p className="mt-1.5 text-white/60 text-sm leading-relaxed">{category.use}</p>
        <a
          href={whatsappLink(`Hi Xing-Z, please share prices for your ${category.name.toLowerCase()}.`)}
          {...external}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#e39a73] hover:text-[#f6c3a4] transition-colors"
        >
          Get prices on WhatsApp
          <ArrowUpRight className="w-4 h-4" />
        </a>
      </div>
    </article>
  )
}

export default function RangeGrid() {
  return (
    <section id="range" className="pt-24 pb-20 md:py-28">
      <div className={container}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <SectionHeading
            eyebrow="The range"
            title="Nine motor lines."
            muted="One standard of build."
            intro="From cooler pumps to blower motors. Pick a category and we'll send models, sizes and prices on WhatsApp."
          />
          <a
            href={whatsappLink('Hi Xing-Z, please send me your full catalogue.')}
            {...external}
            className="liquid-glass self-start md:self-auto rounded-full px-5 py-2.5 text-white text-sm font-medium whitespace-nowrap hover:bg-white/10 transition-colors"
          >
            Get the catalogue
          </a>
        </div>

        <div className="mt-12 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <RangeCard key={category.slug} category={category} />
          ))}
        </div>
      </div>
    </section>
  )
}
