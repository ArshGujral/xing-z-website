export const container = 'max-w-7xl mx-auto px-5 sm:px-6 md:px-12 lg:px-16'

// A section's heading and its one supporting sentence. No label above it: the heading names the section.
export default function SectionHeading({ title, intro, className = '' }) {
  return (
    <div className={`max-w-3xl ${className}`}>
      <h2 data-reveal className="text-white text-[2rem] sm:text-5xl lg:text-[3.5rem] leading-[1.02] tracking-[-0.03em]">
        {title}
      </h2>
      {intro && (
        <p data-reveal style={{ '--i': 1 }} className="mt-6 max-w-xl text-white text-base sm:text-lg leading-relaxed">
          {intro}
        </p>
      )}
    </div>
  )
}
