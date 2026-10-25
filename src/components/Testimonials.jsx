import { Quote } from 'lucide-react'
import SectionHeading, { container } from './SectionHeading.jsx'
import { partnerLogos, testimonials } from '../content/site.js'

export default function Testimonials() {
  return (
    <section className="py-20 md:py-28 border-t border-white/5">
      <div className={container}>
        <SectionHeading eyebrow="Dealers & OEMs" title="What our partners" muted="tell us." />

        <div className="mt-12 grid gap-4 sm:gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <figure key={i} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <Quote className="w-6 h-6 text-[#d9774f]" />
              <blockquote className="mt-4 flex-1 text-white/80 text-sm sm:text-base leading-relaxed">
                {t.quote}
              </blockquote>
              <figcaption className="mt-6 text-sm">
                <span className="text-white font-medium">{t.name}</span>
                <span className="text-white/50">
                  {' '}
                  · {t.role}, {t.place}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-3 md:grid-cols-6 gap-3">
          {partnerLogos.map((logo, i) =>
            logo.src ? (
              <div key={i} className="h-16 rounded-xl border border-white/10 flex items-center justify-center p-3">
                <img src={logo.src} alt={logo.name} className="max-h-full max-w-full object-contain opacity-70" />
              </div>
            ) : (
              <div
                key={i}
                className="h-16 rounded-xl border border-dashed border-white/15 flex items-center justify-center text-white/30 text-xs"
              >
                Partner logo
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
