import { brand, contact, external, footerLinks, whatsappLink } from '../content/site.js'

const tel = `tel:${contact.phone.replace(/\s/g, '')}`
const pad = 'max-w-7xl mx-auto px-5 sm:px-6 md:px-12 lg:px-16'

// The close, on the ink field: short notes along the top, the phone number as the display line, and one row
// of links and credits. The range is listed on the page already, so only the page links repeat here.
export default function Footer() {
  const pageLinks = footerLinks.filter((column) => column.title !== 'Range').flatMap((column) => column.links)

  return (
    <footer id="contact" data-ink="light" data-logo="white" className="field-ink">
      <div className={`${pad} min-h-[90svh] pt-10 md:pt-12 pb-8 flex flex-col`}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-10 text-white text-sm leading-relaxed">
            <div>
              <img src={brand.logoSrc} alt={brand.name} width="873" height="357" className="h-8 w-auto" />
              <p className="mt-4 max-w-[28ch]">{brand.claim.join(' ')}</p>
            </div>
            <p>
              {contact.address.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
              <span className="block mt-2">GSTIN: {contact.gstin}</span>
            </p>
            <p>
              <a href={whatsappLink()} {...external} className="block hover:text-accent-hi transition-colors">
                WhatsApp us
              </a>
              <a href={`mailto:${contact.email}`} className="block hover:text-accent-hi transition-colors">
                {contact.email}
              </a>
            </p>
          </div>
          <a href="#top" className="text-white text-sm hover:text-accent-hi transition-colors">
            Back to top
          </a>
        </div>

        <div className="mt-auto pt-24">
          <h2 className="text-white text-[12vw] md:text-[clamp(56px,8.5vw,128px)] leading-[0.95] tracking-[-0.045em] whitespace-nowrap">
            <a href={tel} className="transition-colors duration-200 hover:text-accent-hi">
              {contact.phone}
            </a>
          </h2>

          <div className="mt-10 flex flex-col md:flex-row md:items-baseline md:justify-between gap-3 text-white text-sm">
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
              {pageLinks.map((link) => (
                <a key={link.label} href={link.href} className="hover:text-accent-hi transition-colors">
                  {link.label}
                </a>
              ))}
            </nav>
            <span>
              © {new Date().getFullYear()} {brand.name}. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
