import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowRight, Box } from 'lucide-react'
import SectionHeading, { container } from './SectionHeading.jsx'
import { asset, external, pages, whatsappLink } from '../content/site.js'
import { loadCatalogue, productsOf, quoteMessage } from '../catalogue.js'

const ModelViewer = lazy(() => import('./ModelViewer.jsx'))
const EXHAUST_FAMILY = 'exhaust'
const MARUTI_996_CODE = '996 (1 14)(M)'

export default function ConfiguratorTeaser() {
  const stageRef = useRef(null)
  const [nearStage, setNearStage] = useState(false)
  const [featured, setFeatured] = useState(null)

  useEffect(() => {
    let active = true
    loadCatalogue()
      .then((catalogue) => {
        const family = catalogue.families.find((entry) => entry.id === EXHAUST_FAMILY)
        const products = productsOf(catalogue, EXHAUST_FAMILY)
        const product = products.find(({ code }) => code === MARUTI_996_CODE)
          ?? products.find(({ name }) => /^996\b/.test(name))
        if (active && family && product) setFeatured({ family, product })
      })
      .catch(() => {
        // The product photo and general configurator link still work without the catalogue.
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setNearStage(true)
      observer.disconnect()
    }, { rootMargin: '120px' })
    observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [])

  const product = featured?.product
  const name = product?.name ?? '996 Exhaust'
  const photo = asset(product?.photo ?? featured?.family.photo ?? 'products/exhaust-motors.webp')
  const configuratorHref = asset(pages.configurator + (product ? `?code=${encodeURIComponent(product.code)}` : ''))
  const poster = <img src={photo} alt={`Xing-Z ${name}`} loading="lazy" className="absolute inset-0 h-full w-full object-contain p-5 sm:p-8" />

  return (
    <section id="configurator" className="pt-24 pb-20 md:py-28 lg:pt-24 border-t border-white/5">
      <div className={`${container} grid gap-12 lg:gap-16 lg:grid-cols-2 items-center`}>
        <div>
          <SectionHeading
            eyebrow="3D configurator"
            title="See the 996 Exhaust in 3D."
            muted="Build it before you order."
            intro="Choose a catalogue variant in the configurator, then send the exact build to us on WhatsApp for a quote."
          />
          <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <a
              href={whatsappLink(product ? quoteMessage(product, []) : "Hi Xing-Z, I'd like a quote for a 996 Exhaust motor.")}
              {...external}
              className="px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-page text-sm font-semibold rounded-full hover:bg-white/90 transition-colors"
            >
              Quote this build
            </a>
            <a
              href={configuratorHref}
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 liquid-glass rounded-full text-white text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              Open configurator
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="min-w-0 rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_35%,rgba(34,151,132,0.16),rgba(255,255,255,0.02)_65%)] p-5 sm:p-8">
          <p className="flex items-center gap-1.5 text-xs text-white/60">
            <Box className="w-3.5 h-3.5" aria-hidden="true" />
            {name}
          </p>
          <div ref={stageRef} className="relative mt-2 aspect-square sm:aspect-[4/3] max-h-[25rem] overflow-hidden rounded-2xl">
            {product && nearStage ? (
              <Suspense fallback={poster}>
                <ModelViewer modelId={featured.family.model} product={product} photo={photo} alt={`Xing-Z ${name}`} preview />
              </Suspense>
            ) : poster}
          </div>
        </div>
      </div>
    </section>
  )
}
