import { external, whatsappLink } from '../content/site.js'

// The page's last call to action: the whole copper band is one link to WhatsApp, its verb set across the width.
export default function EnquireBand() {
  return (
    <section aria-label="Enquire on WhatsApp" data-ink="dark" data-logo="black" className="field-copper">
      <a
        href={whatsappLink()}
        {...external}
        className="group block overflow-hidden transition-colors duration-150 hover:bg-[#140b07] focus-visible:bg-[#140b07]"
      >
        <span className="relative max-w-7xl mx-auto px-5 sm:px-6 md:px-12 lg:px-16 min-h-[46svh] md:min-h-[60svh] pt-8 md:pt-12 pb-6 flex flex-col">
          <span className="flex items-start justify-between gap-6">
            <span className="max-w-[26ch] text-white text-lg md:text-xl leading-snug transition-colors duration-150 group-hover:text-[#df8a5a] group-focus-visible:text-[#df8a5a]">
              Tell us the motors and volumes you need. We reply on WhatsApp.
            </span>
            <svg
              viewBox="0 0 48 48"
              aria-hidden="true"
              className="w-8 h-8 md:w-12 md:h-12 flex-none text-white transition-[color,transform] duration-150 group-hover:text-[#df8a5a] group-hover:-translate-y-1 group-hover:translate-x-1"
            >
              <path d="M12 36 36 12M16 12h20v20" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="square" />
            </svg>
          </span>
          <h2 className="mt-auto pt-10 text-white text-[24vw] md:text-[min(22vw,288px)] leading-[0.78] tracking-[-0.06em] transition-colors duration-150 group-hover:text-[#df8a5a] group-focus-visible:text-[#df8a5a]">
            Enquire
          </h2>
        </span>
      </a>
    </section>
  )
}
