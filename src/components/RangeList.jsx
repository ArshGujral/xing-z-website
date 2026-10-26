import { ArrowUpRight } from 'lucide-react'
import SectionHeading, { container } from './SectionHeading.jsx'
import { categories, external, whatsappLink } from '../content/site.js'

// The range as a poster on the copper field: each line's name set large at the left, what it is for at the right.
// Every line is a link that opens WhatsApp with that line named.
export default function RangeList() {
  return (
    <section id="range" data-ink="dark" data-logo="black" className="field-copper">
      <div className={`${container} py-28 md:py-40`}>
        <SectionHeading
          title="Nine motor lines."
          intro="Pick a line and we'll send models, sizes and prices on WhatsApp."
        />

        <ul className="mt-14 md:mt-20">
          {categories.map((category, i) => (
            <li key={category.slug} id={category.slug} data-reveal style={{ '--i': Math.min(i, 6) }} className="scroll-mt-24">
              <a
                href={whatsappLink(`Hi Xing-Z, please send models and prices for your ${category.name}.`)}
                {...external}
                className="group flex flex-col md:flex-row md:items-baseline md:justify-between gap-1.5 md:gap-8 py-1 text-white transition-colors duration-200 hover:text-[#fbf3ea] focus-visible:text-[#fbf3ea]"
              >
                <span className="text-[12vw] md:text-[clamp(56px,8.5vw,128px)] leading-[0.95] tracking-[-0.045em]">
                  {category.short}
                </span>
                <span className="flex items-center gap-2 pb-3 md:pb-0 text-base md:text-lg md:text-right">
                  {category.use}
                  <ArrowUpRight className="w-4 h-4 flex-none transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
