import { container } from './SectionHeading.jsx'
import { makingSteps } from '../content/site.js'
import { useTheme } from '../theme.jsx'

// How a motor is made, carried by size: three tiles stand bottom-aligned, each larger than the one before,
// so the motor grows from stamped steel to the finished unit. The heading fills the ground above the small tiles.
const SPANS = ['md:col-span-3 md:h-[30vh]', 'md:col-span-4 md:h-[44vh]', 'md:col-span-5 md:h-[60vh]']
const PHONE_HEIGHTS = ['h-[62vw]', 'h-[74vw]', 'h-[86vw]']

export default function Making() {
  const { theme } = useTheme()

  return (
    <section
      id="making"
      data-ink={theme === 'light' ? 'dark' : 'light'}
      data-logo={theme === 'light' ? 'copper' : 'white'}
      className="field-ground"
    >
      <div className={`${container} py-28 md:py-40`}>
        <div className="relative grid grid-cols-1 md:grid-cols-12 gap-x-2.5 gap-y-10 md:items-end">
          <h2
            data-reveal
            className="md:absolute md:top-0 md:left-0 md:w-[52%] text-white text-[2rem] sm:text-5xl lg:text-[3.5rem] leading-[1.02] tracking-[-0.03em]"
          >
            From sheet steel to motor.
          </h2>

          {makingSteps.map((step, i) => (
            <figure key={step.stage} data-reveal style={{ '--i': i + 1 }} className={SPANS[i]}>
              <div className={`${PHONE_HEIGHTS[i]} md:h-full overflow-hidden ${i === 2 ? 'bg-[#df8a5a] p-[10%]' : 'bg-white/5'}`}>
                <img
                  src={step.image}
                  alt={step.alt}
                  width="900"
                  height="900"
                  loading="lazy"
                  className={`w-full h-full ${i === 2 ? 'object-contain' : 'object-cover'}`}
                />
              </div>
              <figcaption className="mt-4">
                <h3 className="text-white text-3xl tracking-[-0.02em]">{step.stage}</h3>
                <p className="mt-2 max-w-[30ch] text-white text-base sm:text-lg leading-relaxed">{step.text}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
