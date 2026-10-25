import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, Menu, Phone, X } from 'lucide-react'
import CopperWires from './CopperWires.jsx'
import { brand, contact, external, nav, whatsappLink } from '../content/site.js'

const tel = `tel:${contact.phone.replace(/\s/g, '')}`

// Intrinsic size of brand.logoSrc, so its box is reserved before the image loads.
const LOGO = { width: 873, height: 357 }

const clamp01 = (t) => Math.min(1, Math.max(0, t))
const lerp = (a, b, t) => a + (b - a) * t
const easeOut = (t) => 1 - (1 - t) ** 4

// Flies the big hero logo up into the nav bar as the page scrolls, and back down on the way up.
// The logo is a single element; two invisible slots, one in the hero and one in the bar, give its start and end boxes.
function useLogoDock(logoRef, heroSlotRef, navSlotRef) {
  const [docked, setDocked] = useState(false)

  useLayoutEffect(() => {
    const logo = logoRef.current
    const heroSlot = heroSlotRef.current
    const navSlot = navSlotRef.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let start // hero slot, in page coordinates
    let end // nav slot, in viewport coordinates (the bar is fixed)
    let distance // scroll needed to dock
    let shown = 0 // progress currently drawn; it trails the scroll position a little so wheel steps glide
    let isDocked = false
    let frame = 0
    let last = 0

    const goal = () => (reduced ? 1 : clamp01(window.scrollY / distance))

    const draw = () => {
      // Shrinking and sliding left run ahead of the climb, so by the time the logo reaches the bar's height
      // it is already small and clear of the nav links.
      const t = easeOut(shown)
      // Its top edge rides up with the page until it meets the bar, so it never closes in on the tagline below it.
      const top = Math.max(start.y - window.scrollY, end.y)
      const width = lerp(start.w, end.w, t)
      logo.style.transform = `translate(${lerp(start.x, end.x, t)}px, ${top}px) scale(${width / start.w})`
      if (isDocked !== shown > 0.98) {
        isDocked = !isDocked
        setDocked(isDocked)
      }
    }

    const tick = (now) => {
      const target = goal()
      const dt = last ? Math.min(now - last, 50) : 16
      last = now
      shown += (target - shown) * (1 - Math.exp(-dt / 100))
      if (Math.abs(target - shown) < 0.002) shown = target
      draw()
      if (shown === target) {
        frame = 0
        last = 0
      } else {
        frame = requestAnimationFrame(tick)
      }
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }

    const measure = () => {
      const h = heroSlot.getBoundingClientRect()
      const n = navSlot.getBoundingClientRect()
      start = { x: h.left, y: h.top + window.scrollY, w: h.width }
      end = { x: n.left, y: n.top, w: n.width }
      // The slot reaches the bar after `rise` px of scroll. Stretch the flight past that for a calmer move,
      // but not so far that the tagline scrolling up underneath catches the still-shrinking logo.
      const rise = Math.max(1, start.y - end.y)
      const gap = heroSlot.nextElementSibling.getBoundingClientRect().top - h.bottom
      distance = Math.max(rise, Math.min(window.innerHeight * 0.3, rise + gap + (h.height - n.height) * 0.6))
      logo.style.width = `${start.w}px`
      shown = goal()
      draw()
    }

    measure()
    logo.style.opacity = '1'

    // The hero column re-centres when fonts load or the viewport changes, which moves the slot.
    const resizeObserver = new ResizeObserver(measure)
    ;[heroSlot, heroSlot.parentElement, navSlot].forEach((el) => resizeObserver.observe(el))
    document.fonts?.ready.then(measure)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [logoRef, heroSlotRef, navSlotRef])

  return docked
}

function NavItem({ item, isOpen, onOpen, onClose }) {
  const hasDropdown = Boolean(item.items)

  return (
    <div
      className="relative"
      onMouseEnter={() => hasDropdown && onOpen(item.label)}
      onMouseLeave={() => hasDropdown && onClose()}
    >
      <a
        href={item.href}
        className="flex items-center gap-1 py-2 text-white/90 hover:text-white text-sm font-medium whitespace-nowrap transition-colors"
      >
        {item.label}
        {hasDropdown && (
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </a>

      {hasDropdown && isOpen && (
        <div className="liquid-glass !absolute !bg-[#0a0706]/60 top-full left-0 z-50 rounded-xl py-3 px-2 min-w-[220px] shadow-xl animate-dropdown">
          {item.items.map((sub) => (
            <a
              key={sub.label}
              href={sub.href}
              className="block px-3 py-2 text-white/80 hover:text-white text-sm rounded-lg hover:bg-white/5 transition-colors"
            >
              {sub.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Hero() {
  const [openDropdown, setOpenDropdown] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  const logoRef = useRef(null)
  const heroSlotRef = useRef(null)
  const navSlotRef = useRef(null)
  const docked = useLogoDock(logoRef, heroSlotRef, navSlotRef)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 sm:px-4 pt-3">
        <nav className="relative">
          {/* The glass sits behind the bar's contents rather than around them, so dropdowns aren't clipped by it. */}
          <div aria-hidden="true" data-solid={docked} className="nav-glass liquid-glass !absolute inset-0 rounded-2xl" />

          <div className="relative flex items-center justify-between gap-6 h-14 sm:h-16 px-4 sm:px-5 md:px-8 lg:px-10">
            <span ref={navSlotRef} aria-hidden="true" className="h-9 sm:h-10 aspect-[873/357] shrink-0" />

            <div className="hidden lg:flex items-center gap-6 xl:gap-8">
              {nav.map((item) => (
                <NavItem
                  key={item.label}
                  item={item}
                  isOpen={openDropdown === item.label}
                  onOpen={setOpenDropdown}
                  onClose={() => setOpenDropdown(null)}
                />
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-5">
              <a
                href={tel}
                className="hidden xl:inline-flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium whitespace-nowrap transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                {contact.phone}
              </a>
              <a
                href={whatsappLink()}
                {...external}
                className="liquid-glass rounded-full px-5 py-2 text-white text-sm font-medium whitespace-nowrap"
              >
                Get a quote
              </a>
            </div>

            <button
              className="lg:hidden relative w-9 h-9 flex items-center justify-center text-white"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              <Menu
                className={`absolute w-6 h-6 transition-all duration-300 ${
                  mobileOpen ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
                }`}
              />
              <X
                className={`absolute w-6 h-6 transition-all duration-300 ${
                  mobileOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
                }`}
              />
            </button>
          </div>
        </nav>

        {/* Positioned and scaled by useLogoDock; the header is fixed at the viewport's top-left, so its coordinates are the viewport's. */}
        <a
          ref={logoRef}
          href="#top"
          aria-label={`${brand.name} home`}
          className="absolute left-0 top-0 block origin-top-left opacity-0 transition-opacity duration-700"
        >
          <img src={brand.logoSrc} alt={brand.name} {...LOGO} draggable="false" className="block w-full h-auto" />
        </a>

        {/* Mobile menu */}
        <div
          className={`lg:hidden absolute left-3 right-3 sm:left-4 sm:right-4 top-full mt-2 z-10 max-h-[calc(100svh-6rem)] overflow-y-auto bg-[#2C221C]/95 backdrop-blur-xl rounded-2xl p-6 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            mobileOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
        >
          <div className="flex flex-col gap-4">
            {nav.map((item) => (
              <div key={item.label}>
                <a href={item.href} onClick={closeMobile} className="block text-white text-base font-medium">
                  {item.label}
                </a>
                {item.items && (
                  <div className="mt-2 pl-4 grid grid-cols-2 gap-x-4 gap-y-2">
                    {item.items.map((sub) => (
                      <a
                        key={sub.label}
                        href={sub.href}
                        onClick={closeMobile}
                        className="text-white/70 hover:text-white text-sm transition-colors"
                      >
                        {sub.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between gap-4">
            <a
              href={tel}
              className="inline-flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              Call us
            </a>
            <a
              href={whatsappLink()}
              {...external}
              className="liquid-glass rounded-full px-5 py-2 text-white text-sm font-medium"
            >
              Get a quote
            </a>
          </div>
        </div>
      </header>

      <section id="top" className="relative h-svh min-h-[580px] w-full overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#1a110b_0%,#0b0706_55%,#050303_100%)]" />
        <CopperWires className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_55%_at_50%_48%,rgba(5,3,2,0.7)_0%,rgba(5,3,2,0.35)_55%,transparent_100%)]" />
        <div className="absolute inset-0 bg-black/10" />

        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5 sm:px-6 md:px-12 lg:px-16 pt-24 pb-10">
          {/* Where the flying logo starts. Shown as-is only when motion is reduced and the logo stays docked. */}
          <img
            ref={heroSlotRef}
            src={brand.logoSrc}
            alt=""
            aria-hidden="true"
            {...LOGO}
            className="invisible motion-reduce:visible w-[min(86vw,40rem,68vh)] h-auto"
          />

          {/* A small lockup line under the logo: one line from tablets up, split after the first sentence on phones. */}
          <h1 className="font-tagline mt-5 sm:mt-6 text-white/90 text-[0.7rem] sm:text-sm md:text-base uppercase tracking-[0.22em] leading-relaxed">
            <span className="sr-only">{brand.name}: </span>
            {brand.tagline[0]}
            <br className="sm:hidden" />{' '}
            <span className="text-[#e39a73]">{brand.tagline[1]}</span>
          </h1>

          <span aria-hidden="true" className="block w-16 h-px mt-6 sm:mt-7 bg-gradient-to-r from-transparent via-[#e08a5f] to-transparent" />

          <p className="max-w-xl mt-5 sm:mt-6 text-white/90 text-sm sm:text-base md:text-lg leading-relaxed text-balance">
            {brand.claim}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-7 sm:mt-9">
            <a
              href={whatsappLink()}
              {...external}
              className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-gray-900 text-sm font-semibold rounded-full hover:bg-white/90 transition-colors"
            >
              Get a quote on WhatsApp
            </a>
            <a
              href="#range"
              className="px-5 sm:px-6 py-2.5 sm:py-3 liquid-glass rounded-full text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              See the range
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
