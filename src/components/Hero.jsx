import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, Menu, Phone, X } from 'lucide-react'
import { NeuralNoise } from './ui/neural-noise.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { brand, contact, external, nav, whatsappLink } from '../content/site.js'
import { useTheme } from '../theme.jsx'
import { rangeMenu, useRanges } from '../ranges.js'

const tel = `tel:${contact.phone.replace(/\s/g, '')}`

// Intrinsic size of brand.logoSrc, so its box is reserved before the image loads.
const LOGO = { width: 873, height: 357 }

const clamp01 = (t) => Math.min(1, Math.max(0, t))
const lerp = (a, b, t) => a + (b - a) * t

// Animate the single logo from the hero slot to the header slot as the page scrolls.
function useLogoDock(logoRef, heroSlotRef, navSlotRef) {
  const [docked, setDocked] = useState(false)

  useLayoutEffect(() => {
    const logo = logoRef.current
    const heroSlot = heroSlotRef.current
    const navSlot = navSlotRef.current
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let start
    let end
    let distance
    let progress = 0
    let isDocked = false
    let frame = 0
    let previousTime = 0
    let active = true

    const goal = () => motion.matches ? 1 : clamp01(window.scrollY / distance)

    const draw = () => {
      const travel = progress + progress ** 2 * (1 - progress)
      // The logo starts drifting left as it rises so it clears the navigation on arrival.
      const slide = travel + 0.25 * travel * (1 - travel)
      const width = lerp(start.width, end.width, travel)
      const height = width * LOGO.height / LOGO.width
      const left = lerp(start.x, end.x, slide) - width / 2
      const top = lerp(start.y, end.y, travel) - height / 2
      logo.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${width / start.width})`

      const atHeader = progress >= 0.96
      if (isDocked !== atHeader) {
        isDocked = atHeader
        setDocked(atHeader)
      }
    }

    const tick = (now) => {
      const target = goal()
      const elapsed = previousTime ? Math.min(now - previousTime, 50) : 16
      previousTime = now
      progress += (target - progress) * (1 - Math.exp(-elapsed / 64))
      if (Math.abs(target - progress) < 0.002) progress = target
      draw()

      frame = progress === target ? 0 : requestAnimationFrame(tick)
      if (!frame) previousTime = 0
    }

    const onScroll = () => {
      if (!frame && progress !== goal()) frame = requestAnimationFrame(tick)
    }

    const measure = () => {
      if (!active) return
      const heroBox = heroSlot.getBoundingClientRect()
      const navBox = navSlot.getBoundingClientRect()
      const origin = logo.offsetParent.getBoundingClientRect()
      const center = (box) => ({
        x: box.left + box.width / 2 - origin.left,
        y: box.top + box.height / 2 - origin.top,
        width: box.width,
      })

      start = center(heroBox)
      start.y += window.scrollY
      end = center(navBox)
      distance = Math.max(96, (start.y - end.y) * 1.08)

      cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
      progress = goal()
      logo.style.width = `${start.width}px`
      draw()
    }

    measure()
    logo.style.opacity = '1'

    const observer = new ResizeObserver(measure)
    observer.observe(heroSlot)
    observer.observe(heroSlot.parentElement)
    observer.observe(navSlot)
    document.fonts?.ready.then(measure)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    motion.addEventListener('change', measure)
    return () => {
      active = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
      motion.removeEventListener('change', measure)
    }
  }, [logoRef, heroSlotRef, navSlotRef])

  return docked
}

// In-page links scroll so a section's first line of text lands just under the floating bar. Measuring the
// bar, rather than relying on CSS offsets, keeps the stop right on phones whose status bar overlaps the page.
function useAnchorScroll(barRef) {
  useEffect(() => {
    const onClick = (event) => {
      const link = event.target.closest?.('a[href^="#"]')
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
        return
      }
      const id = decodeURIComponent(link.hash.slice(1))
      const target = id === 'top' ? null : document.getElementById(id)
      if (id !== 'top' && !target) return
      event.preventDefault()

      let top = 0
      if (target) {
        // Sections line up by their eyebrow; anything else, such as a product card, by its top edge.
        const mark = (target.tagName === 'SECTION' && target.querySelector('p, h2')) || target
        top = window.scrollY + mark.getBoundingClientRect().top - barRef.current.getBoundingClientRect().bottom - 20
      }
      history.pushState(null, '', link.hash)
      window.scrollTo({ top: Math.max(0, top) })
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [barRef])
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
        <div className="liquid-glass !absolute !bg-page/60 top-full left-0 z-50 rounded-xl py-3 px-2 min-w-[220px] shadow-xl animate-dropdown">
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
  const { theme } = useTheme()
  const logoSrc = theme === 'light' ? brand.logoOnLight : brand.logoSrc
  // The Range menu lists whatever ranges the catalogue holds.
  const ranges = useRanges()
  const menu = nav.map((item) => (item.href === '#range' ? { ...item, items: rangeMenu(ranges) } : item))

  const logoRef = useRef(null)
  const heroSlotRef = useRef(null)
  const navSlotRef = useRef(null)
  const barRef = useRef(null)
  const docked = useLogoDock(logoRef, heroSlotRef, navSlotRef)
  useAnchorScroll(barRef)

  return (
    <>
      {/* Held off the top edge (and below the iPhone status bar) instead of padded down from it: Safari paints
          the status bar area solid when a fixed element touches the top, and this way the page shows through. */}
      <header className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 px-3 sm:px-4">
        <nav ref={barRef} className="relative">
          {/* The glass sits behind the bar's contents rather than around them, so dropdowns aren't clipped by it. */}
          <div aria-hidden="true" data-solid={docked} className="nav-glass liquid-glass !absolute inset-0 rounded-2xl" />

          <div className="relative flex items-center justify-between gap-6 h-14 sm:h-16 px-4 sm:px-5 md:px-8 lg:px-10">
            <span ref={navSlotRef} aria-hidden="true" className="h-9 sm:h-10 aspect-[873/357] shrink-0" />

            <div className="hidden lg:flex items-center gap-6 xl:gap-8">
              {menu.map((item) => (
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
              <ThemeToggle />
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

            <div className="lg:hidden flex items-center gap-3">
              <ThemeToggle />
              <button
                className="relative w-9 h-9 flex items-center justify-center text-white"
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
          </div>
        </nav>

        {/* Positioned and scaled by useLogoDock, in the header's coordinates. */}
        <a
          ref={logoRef}
          href="#top"
          aria-label={`${brand.name} home`}
          className="absolute left-0 top-0 block origin-top-left opacity-0 transition-opacity duration-700 motion-reduce:transition-none"
        >
          <img src={logoSrc} alt={brand.name} {...LOGO} draggable="false" className="block w-full h-auto" />
        </a>

        {/* Mobile menu */}
        <div
          className={`lg:hidden absolute left-3 right-3 sm:left-4 sm:right-4 top-full mt-2 z-10 max-h-[calc(100svh-6rem-env(safe-area-inset-top))] overflow-y-auto bg-panel/95 backdrop-blur-xl rounded-2xl p-6 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            mobileOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
        >
          <div className="flex flex-col gap-4">
            {menu.map((item) => (
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
        <div className="absolute inset-0 bg-stage" />
        {/* The same teal filaments as the Dealers section, so the page opens and closes on one backdrop */}
        <NeuralNoise {...(theme === 'light' ? { base: '#1a7a6b', glow: '#229784', strength: 0.7 } : { base: '#229784', glow: '#a0d5cd', strength: 0.9 })} />
        <div className="absolute inset-0 bg-hush" />

        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5 sm:px-6 md:px-12 lg:px-16 pt-[calc(6rem+env(safe-area-inset-top))] pb-10">
          {/* Where the flying logo starts. Shown as-is only when motion is reduced and the logo stays docked. */}
          <img
            ref={heroSlotRef}
            src={logoSrc}
            alt=""
            aria-hidden="true"
            {...LOGO}
            className="invisible motion-reduce:visible w-[min(58vw,16rem,32vh)] h-auto"
          />

          {/* The tagline sits under the logo as a two-line caption about the logo's width, so the pair reads as one lockup. */}
          <p className="font-tagline mt-4 text-white/80 text-[0.66rem] sm:text-xs uppercase tracking-[0.26em] leading-[1.9]">
            {brand.tagline[0]}
            <br />
            <span className="text-accent">{brand.tagline[1]}</span>
          </p>

          <h1 className="mt-10 sm:mt-12 max-w-4xl text-white text-[1.65rem] sm:text-4xl md:text-5xl leading-[1.1] tracking-[-0.02em] text-balance">
            {brand.claim[0]} <span className="text-white/60">{brand.claim[1]}</span>
          </h1>

          <p className="mt-5 max-w-xl text-white/75 text-sm sm:text-base md:text-lg leading-relaxed text-balance">{brand.supporting}</p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-8 sm:mt-10">
            <a
              href={whatsappLink()}
              {...external}
              className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-page text-sm font-semibold rounded-full hover:bg-white/90 transition-colors"
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
