import { useState } from 'react'
import { container } from './SectionHeading.jsx'
import { categories, external, pages, whatsappLink } from '../content/site.js'

const photographed = categories.filter((c) => c.image)

// The product picker on the paper field: a square plate with the chosen motor's photograph at the left;
// at the right, one tab per photographed line, its name and use, and the two things to do next.
export default function Showcase() {
  const [index, setIndex] = useState(0)
  const motor = photographed[index]

  return (
    <section id="configurator" data-ink="dark" data-logo="black" className="field-paper">
      <div className={`${container} py-28 md:py-40 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-stretch`}>
        <div data-reveal className="bg-[rgb(var(--tone))] aspect-square flex items-center justify-center p-[8%]">
          <img
            key={motor.slug}
            src={motor.image}
            alt={`Xing-Z ${motor.name}`}
            width="900"
            height="900"
            className="w-full h-full object-contain mix-blend-multiply animate-plate-in"
          />
        </div>

        <div className="flex flex-col justify-between gap-12">
          <div>
            <h2 data-reveal className="text-white text-[2rem] sm:text-5xl lg:text-[3.5rem] leading-[1.02] tracking-[-0.03em]">
              See the motor before you order.
            </h2>
            <div data-reveal style={{ '--i': 1 }} role="group" aria-label="Motor line" className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {photographed.map((c, i) => (
                <button
                  key={c.slug}
                  onClick={() => setIndex(i)}
                  aria-pressed={i === index}
                  className={`py-2 text-lg transition-colors duration-200 underline-offset-[6px] decoration-2 ${
                    i === index ? 'text-white underline' : 'text-[#55524c] hover:text-white'
                  }`}
                >
                  {c.short}
                </button>
              ))}
            </div>
          </div>

          <div data-reveal style={{ '--i': 2 }}>
            <h3 className="text-white text-3xl tracking-[-0.02em]">{motor.name}</h3>
            <p className="mt-4 max-w-[34ch] text-white text-lg leading-relaxed">{motor.use}.</p>
          </div>

          <div data-reveal style={{ '--i': 3 }} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href={whatsappLink(`Hi Xing-Z, please send models and prices for your ${motor.name}.`)}
              {...external}
              className="flex items-center h-[72px] px-6 rounded-full bg-white text-on-fg text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              Get prices on WhatsApp
            </a>
            <a
              href={pages.configurator}
              className="flex items-center h-[72px] px-6 rounded-full bg-[rgb(var(--tone))] text-white text-base font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              Open the 3D configurator
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
