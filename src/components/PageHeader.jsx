import { ArrowLeft } from 'lucide-react'
import ThemeToggle from './ThemeToggle.jsx'
import { brand, external, whatsappLink } from '../content/site.js'
import { useTheme } from '../theme.jsx'

// The glass bar for pages other than home: the logo back to the home page, its sections, and the quote action.
export default function PageHeader({ links = [], action = true }) {
  const { theme } = useTheme()
  const logo = theme === 'light' ? brand.logoOnLight : brand.logoSrc

  return (
    <header className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 px-3 sm:px-4">
      <nav className="relative">
        <div aria-hidden="true" data-solid="true" className="nav-glass liquid-glass !absolute inset-0 rounded-2xl" />
        <div className="relative flex items-center justify-between gap-6 h-14 sm:h-16 px-4 sm:px-5 md:px-8 lg:px-10">
          <a href="./" aria-label={`${brand.name} home`} className="flex items-center gap-3 group">
            <ArrowLeft className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
            <img src={logo} alt={brand.name} width="873" height="357" className="h-8 sm:h-9 w-auto" />
          </a>

          <div className="hidden md:flex items-center gap-6">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="text-white/85 hover:text-white text-sm font-medium transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {action && (
              <a
                href={whatsappLink()}
                {...external}
                className="hidden sm:inline-flex liquid-glass rounded-full px-5 py-2 text-white text-sm font-medium whitespace-nowrap"
              >
                Get a quote
              </a>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
