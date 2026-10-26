import { container } from './SectionHeading.jsx'
import { reasons } from '../content/site.js'

const INK = { copper: 'dark', paper: 'dark', steel: 'light', ink: 'light' }
const LOGO = { copper: 'black', paper: 'black', steel: 'white', ink: 'white' }

// Why Xing-Z: one reason per full-bleed colour field. The phrase sits large at a bottom corner and its
// explanation small near the top of the opposite side, so the eye travels the diagonal. Alternate fields mirror.
export default function WhyXingZ() {
  return (
    <section id="why" aria-label="Why Xing-Z">
      {reasons.map((reason, i) => {
        const mirrored = i % 2 === 1
        const Heading = i === 0 ? 'h2' : 'h3'
        return (
          <div
            key={reason.phrase}
            data-ink={INK[reason.field]}
            data-logo={LOGO[reason.field]}
            className={`field-${reason.field}`}
          >
            <div className={`${container} min-h-[60svh] md:min-h-[70svh] py-16 md:py-20 flex flex-col justify-between gap-16`}>
              <p
                data-reveal
                className={`max-w-[30ch] text-white text-base sm:text-lg leading-relaxed ${
                  mirrored ? 'md:self-start ml-auto md:ml-0 text-right md:text-left' : 'md:ml-[58%]'
                }`}
              >
                {reason.text}
              </p>
              <Heading
                data-reveal
                style={{ '--i': 1 }}
                className={`text-white text-[11vw] md:text-[clamp(56px,8.5vw,128px)] leading-[0.92] tracking-[-0.045em] max-w-[11ch] ${
                  mirrored ? 'md:self-end md:text-right' : ''
                }`}
              >
                {reason.phrase}
              </Heading>
            </div>
          </div>
        )
      })}
    </section>
  )
}
