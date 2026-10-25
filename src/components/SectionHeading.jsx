export const container = 'max-w-7xl mx-auto px-5 sm:px-6 md:px-12 lg:px-16'

export default function SectionHeading({ eyebrow, title, muted, intro, center = false }) {
  return (
    <div className={center ? 'text-center max-w-2xl mx-auto' : 'max-w-2xl'}>
      <p className="text-accent text-xs sm:text-sm font-medium uppercase tracking-[0.18em]">{eyebrow}</p>
      <h2 className="mt-4 text-white text-3xl sm:text-4xl md:text-5xl leading-[1.05] tracking-[-0.02em]">
        {title} {muted && <span className="text-white/60">{muted}</span>}
      </h2>
      {intro && (
        <p
          className={`mt-5 max-w-xl text-white/70 text-sm sm:text-base md:text-lg leading-relaxed ${
            center ? 'mx-auto' : ''
          }`}
        >
          {intro}
        </p>
      )}
    </div>
  )
}
