import { FileText, Mail, MapPin, MessageCircle, Phone } from 'lucide-react'
import XingZLogo from './XingZLogo.jsx'
import { container } from './SectionHeading.jsx'
import { brand, contact, external, footerLinks, whatsappLink } from '../content/site.js'

export default function Footer() {
  const details = [
    { icon: MapPin, content: contact.address.map((line) => <span key={line} className="block">{line}</span>) },
    { icon: Phone, content: contact.phone, href: `tel:${contact.phone.replace(/\s/g, '')}` },
    { icon: MessageCircle, content: 'Chat on WhatsApp', href: whatsappLink(), external: true },
    { icon: Mail, content: contact.email, href: `mailto:${contact.email}` },
    { icon: FileText, content: `GSTIN: ${contact.gstin}` },
  ]

  return (
    <footer id="contact" className="border-t border-white/10 bg-page-3">
      <div className={`${container} py-14 md:py-20 grid gap-12 lg:grid-cols-[1.2fr_2fr]`}>
        <div>
          <XingZLogo />
          <p className="mt-4 max-w-xs text-white/60 text-sm leading-relaxed">{brand.claim}</p>
          <ul className="mt-6 space-y-3 text-sm text-white/70">
            {details.map(({ icon: Icon, content, href, external: isExternal }, i) => (
              <li key={i} className="flex gap-3">
                <Icon className="w-4 h-4 mt-0.5 flex-none text-accent" />
                {href ? (
                  <a href={href} {...(isExternal ? external : {})} className="hover:text-white transition-colors">
                    {content}
                  </a>
                ) : (
                  <span>{content}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
          {footerLinks.map((column) => (
            <div key={column.title}>
              <h3 className="text-white text-sm font-medium">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-white/60 hover:text-white text-sm transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className={`${container} py-6 text-xs text-white/40`}>
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
