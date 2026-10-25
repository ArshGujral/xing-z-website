import { useEffect, useState } from 'react'
import { ArrowRight, Box } from 'lucide-react'
import Motor from './Motor.jsx'
import SectionHeading, { container } from './SectionHeading.jsx'
import { external, pages, whatsappLink } from '../content/site.js'

// Stand-in options until the configurator's real variant list is settled.
const OPTIONS = [
  { key: 'finish', label: 'Finish', values: ['Graphite', 'Silver', 'Copper'] },
  { key: 'mount', label: 'Mount', values: ['Standard', 'H Frame'] },
  { key: 'speed', label: 'Speed', values: ['Standard', 'High-speed'] },
]

// Each step changes one option, so the loop reads as someone clicking through variants.
const SEQUENCE = [
  { finish: 'Graphite', mount: 'Standard', speed: 'Standard' },
  { finish: 'Silver', mount: 'Standard', speed: 'Standard' },
  { finish: 'Silver', mount: 'H Frame', speed: 'Standard' },
  { finish: 'Silver', mount: 'H Frame', speed: 'High-speed' },
  { finish: 'Copper', mount: 'H Frame', speed: 'High-speed' },
  { finish: 'Copper', mount: 'Standard', speed: 'High-speed' },
  { finish: 'Graphite', mount: 'Standard', speed: 'High-speed' },
]

export default function ConfiguratorTeaser() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setStep((s) => (s + 1) % SEQUENCE.length), 1800)
    return () => clearInterval(timer)
  }, [])

  const build = SEQUENCE[step]
  const prev = SEQUENCE[(step - 1 + SEQUENCE.length) % SEQUENCE.length]
  const changed = OPTIONS.find((o) => build[o.key] !== prev[o.key])?.key
  const summary = `${build.finish} finish, ${build.mount} mount, ${build.speed} speed`

  return (
    <section id="configurator" className="pt-24 pb-20 md:py-28 lg:pt-24 border-t border-white/5">
      <div className={`${container} grid gap-12 lg:gap-16 lg:grid-cols-2 items-center`}>
        <div>
          <SectionHeading
            eyebrow="3D configurator"
            title="Change the variant."
            muted="See it before you order."
            intro="Pick finish, mount and speed and the motor updates in 3D. When it looks right, send the exact build to us on WhatsApp for a quote."
          />
          <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <a
              href={pages.configurator}
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-900 text-sm font-semibold rounded-full hover:bg-white/90 transition-colors"
            >
              Try it
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href={whatsappLink(`Hi Xing-Z, I'd like a quote for this build: ${summary}.`)}
              {...external}
              className="px-5 sm:px-6 py-2.5 sm:py-3 liquid-glass rounded-full text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              Quote this build
            </a>
          </div>
        </div>

        <div className="relative rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_35%,rgba(217,119,79,0.16),rgba(255,255,255,0.02)_65%)] p-5 sm:p-8">
          <div className="flex items-center justify-between text-xs text-white/50">
            <span className="inline-flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5" />
              Live preview
            </span>
            <span className="hidden sm:inline">Drag to rotate in the full configurator</span>
          </div>

          <Motor
            finish={build.finish}
            mount={build.mount === 'H Frame' ? 'hframe' : 'standard'}
            fast={build.speed === 'High-speed'}
            // On laptops the motor gives up height so the whole card, option rows included, fits on one screen
            // when the Configurator link brings it to the top.
            className="mt-2 w-full h-auto lg:max-h-[max(11rem,calc(100svh-22.5rem))] animate-float-3d"
          />

          <div className="mt-4 space-y-3">
            {OPTIONS.map((option) => (
              <div key={option.key} className="flex items-center justify-between gap-3">
                <span
                  className={`text-xs sm:text-sm transition-colors duration-300 ${
                    changed === option.key ? 'text-[#e39a73]' : 'text-white/60'
                  }`}
                >
                  {option.label}
                </span>
                <div className="flex rounded-full bg-white/5 p-1">
                  {option.values.map((value) => (
                    <span
                      key={value}
                      className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-300 ${
                        build[option.key] === value ? 'bg-white text-gray-900' : 'text-white/60'
                      }`}
                    >
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
