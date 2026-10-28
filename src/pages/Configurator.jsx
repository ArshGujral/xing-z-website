import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Move3d, Image as ImageIcon } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import ModelViewer from '../components/ModelViewer.jsx'
import WhatsAppFab from '../components/WhatsAppFab.jsx'
import { container } from '../components/SectionHeading.jsx'
import { asset, brand, contact, external, whatsappLink } from '../content/site.js'
import { isDirect, loadCatalogue, optionGroups, pick, productsOf, quoteMessage, variantsFor } from '../catalogue.js'
import { hasModel } from '../models/registry.js'

const homeLinks = [
  { label: 'Range', href: './#range' },
  { label: 'Why Xing-Z', href: './#why' },
  { label: 'Inside the Motor', href: './#inside' },
  { label: 'Dealers/OEM', href: './#dealers' },
]

const codeFromUrl = () => new URLSearchParams(window.location.search).get('code')

function Chip({ selected, dim, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={title}
      className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
        selected
          ? 'bg-white text-page'
          : dim
            ? 'bg-white/[0.03] text-white/45 hover:text-white/80 hover:bg-white/[0.07]'
            : 'bg-white/[0.06] text-white/85 hover:bg-white/[0.12] hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

// Build a motor from the catalogue: range, then options, then send the exact product code on WhatsApp.
// Every combination the chips can reach is a real product from the catalogue.
export default function Configurator() {
  const [catalogue, setCatalogue] = useState(null)
  const [error, setError] = useState(null)
  const [code, setCode] = useState(codeFromUrl)
  const [variants, setVariants] = useState([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadCatalogue()
      .then((data) => {
        setCatalogue(data)
        setCode((c) => (data.products.some((p) => p.code === c) ? c : data.products[0]?.code))
      })
      .catch((e) => setError(e.message))
  }, [])

  const product = catalogue?.products.find((p) => p.code === code)
  const family = catalogue?.families.find((f) => f.id === product?.family)
  const familyProducts = useMemo(() => (catalogue && family ? productsOf(catalogue, family.id) : []), [catalogue, family])
  const groups = useMemo(() => optionGroups(familyProducts), [familyProducts])
  const available = family && product ? variantsFor(family, product) : []

  // Keep the link shareable: ?code= always names the build on screen.
  useEffect(() => {
    if (!code) return
    const url = new URL(window.location.href)
    url.searchParams.set('code', code)
    window.history.replaceState(null, '', url)
    setVariants((v) => v.filter((x) => available.includes(x)))
    setCopied(false)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  const chooseFamily = (id) => {
    const first = productsOf(catalogue, id)[0]
    if (first) setCode(first.code)
  }
  const chooseOption = (key, value) => setCode(pick(familyProducts, product, key, value).code)
  const toggleVariant = (v) => setVariants((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]))
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(product.code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const in3d = family && hasModel(family.model)

  return (
    <>
      <PageHeader links={homeLinks} />
      <main className="pt-[calc(6.5rem+env(safe-area-inset-top))] sm:pt-[calc(7.5rem+env(safe-area-inset-top))] pb-20">
        <div className={container}>
          <div className="max-w-2xl">
            <p className="text-accent text-xs sm:text-sm font-medium uppercase tracking-[0.18em]">3D configurator</p>
            <h1 className="mt-4 text-white text-3xl sm:text-4xl md:text-5xl leading-[1.05] tracking-[-0.02em]">
              Build your motor. <span className="text-white/60">Then get a quote.</span>
            </h1>
            <p className="mt-5 max-w-xl text-white/70 text-sm sm:text-base md:text-lg leading-relaxed">
              Pick a range and its options. Every combination is a real Xing-Z product; send it to us on WhatsApp for a
              price.
            </p>
          </div>

          {error && (
            <p className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-white/80">
              The catalogue couldn't load ({error}). Refresh the page, or{' '}
              <a href={whatsappLink()} {...external} className="text-accent underline underline-offset-4">
                message us on WhatsApp
              </a>
              .
            </p>
          )}

          {!catalogue && !error && <p className="mt-10 text-white/50">Loading the catalogue…</p>}

          {catalogue && product && family && (
            <>
              <div className="mt-10 md:mt-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
                {/* Stage */}
                <div className="lg:sticky lg:top-24 relative aspect-square sm:aspect-[4/3] lg:aspect-auto lg:h-[min(76svh,720px)] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_50%_58%,rgba(34,151,132,0.22),rgba(255,255,255,0.015)_68%)]">
                  <ModelViewer
                    modelId={family.model}
                    product={product}
                    variants={variants}
                    photo={asset(product.photo ?? family.photo)}
                    alt={`Xing-Z ${product.name}`}
                  />
                  <div className="pointer-events-none absolute left-4 top-4 sm:left-5 sm:top-5 flex items-center gap-2">
                    <span className="liquid-glass rounded-full px-3 py-1 text-white text-xs font-medium">{family.name}</span>
                  </div>
                  <div className="pointer-events-none absolute left-4 bottom-4 sm:left-5 sm:bottom-5 flex items-center gap-1.5 text-white/55 text-xs">
                    {in3d ? (
                      <>
                        <Move3d className="w-3.5 h-3.5" /> Drag to turn it around
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3.5 h-3.5" /> Photo for now; the 3D model is on its way
                      </>
                    )}
                  </div>
                  <span className="pointer-events-none absolute right-4 bottom-4 sm:right-5 sm:bottom-5 rounded-full bg-page/70 px-3 py-1 text-white text-xs font-semibold tracking-wide">
                    {product.code}
                  </span>
                </div>

                {/* Options */}
                <div className="flex flex-col gap-8">
                  <fieldset>
                    <legend className="text-white text-sm font-medium">Range</legend>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {catalogue.families
                        .filter((f) => productsOf(catalogue, f.id).length)
                        .map((f) => {
                          const active = f.id === family.id
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => chooseFamily(f.id)}
                              aria-pressed={active}
                              className={`flex items-center gap-3 rounded-2xl border p-2 pr-3 text-left transition-colors ${
                                active
                                  ? 'border-[#229784]/70 bg-[#229784]/10'
                                  : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                              }`}
                            >
                              <span className="w-11 h-11 flex-none rounded-xl bg-white/[0.04] p-1">
                                <img src={asset(f.photo)} alt="" className="w-full h-full object-contain" loading="lazy" />
                              </span>
                              <span className="text-white text-sm font-medium leading-tight">{f.name}</span>
                            </button>
                          )
                        })}
                    </div>
                  </fieldset>

                  {groups.map((g) => (
                    <fieldset key={g.key}>
                      <legend className="text-white text-sm font-medium">{g.key}</legend>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {g.values.map((value) => {
                          const direct = isDirect(familyProducts, product, g.key, value)
                          return (
                            <Chip
                              key={value}
                              selected={product.attributes?.[g.key] === value}
                              dim={!direct}
                              title={direct ? undefined : 'Choosing this also changes other options'}
                              onClick={() => chooseOption(g.key, value)}
                            >
                              {value}
                            </Chip>
                          )
                        })}
                      </div>
                    </fieldset>
                  ))}

                  {available.length > 0 && (
                    <fieldset>
                      <legend className="text-white text-sm font-medium">Optional changes</legend>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {available.map((v) => {
                          const on = variants.includes(v)
                          return (
                            <button
                              key={v}
                              type="button"
                              role="switch"
                              aria-checked={on}
                              onClick={() => toggleVariant(v)}
                              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                                on ? 'bg-[#229784]/20 text-white' : 'bg-white/[0.06] text-white/80 hover:bg-white/[0.12]'
                              }`}
                            >
                              <span
                                className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                                  on ? 'bg-[#229784] border-[#229784]' : 'border-white/30'
                                }`}
                              >
                                {on && <Check className="w-3 h-3 text-white" />}
                              </span>
                              {v}
                            </button>
                          )
                        })}
                      </div>
                    </fieldset>
                  )}

                  {/* Result */}
                  <div className="liquid-glass !bg-white/[0.03] rounded-3xl p-5 sm:p-6">
                    <p className="text-accent text-xs font-medium uppercase tracking-[0.18em]">Your build</p>
                    <h2 className="mt-3 text-white text-xl sm:text-2xl font-medium tracking-[-0.01em]">{product.name}</h2>
                    {variants.length > 0 && <p className="mt-1 text-white/70 text-sm">{variants.join(' · ')}</p>}
                    <div className="mt-4 flex items-center gap-2">
                      <span className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-white text-sm font-semibold tracking-wide">
                        {product.code}
                      </span>
                      <button
                        type="button"
                        onClick={copyCode}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-white/60 hover:text-white text-xs transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy code'}
                      </button>
                    </div>
                    <p className="mt-3 text-white/45 text-xs leading-relaxed">{product.description}</p>
                    <a
                      href={whatsappLink(quoteMessage(product, variants))}
                      {...external}
                      className="mt-5 flex items-center justify-center w-full px-6 py-3 bg-white text-page text-sm font-semibold rounded-full hover:bg-white/90 transition-colors"
                    >
                      Get a quote on WhatsApp
                    </a>
                    <p className="mt-3 text-center text-white/45 text-xs">Prices are shared on WhatsApp, for dealers and OEMs.</p>
                  </div>
                </div>
              </div>

              {/* Every product in the range, for buyers who already know the code */}
              <section className="mt-16 md:mt-24" aria-labelledby="range-list">
                <h2 id="range-list" className="text-white text-xl sm:text-2xl font-medium tracking-[-0.01em]">
                  Everything in {family.name}
                </h2>
                <ul className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {familyProducts.map((p) => {
                    const active = p.code === product.code
                    return (
                      <li key={p.code}>
                        <button
                          type="button"
                          onClick={() => {
                            setCode(p.code)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className={`w-full flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-colors ${
                            active ? 'border-[#229784]/70 bg-[#229784]/10' : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                          }`}
                        >
                          <span className="text-white text-sm">{p.name}</span>
                          <span className="flex-none text-white/55 text-xs font-semibold tracking-wide">{p.code}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-white/10 bg-page-3">
        <div className={`${container} py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-white/50`}>
          <span>
            © {new Date().getFullYear()} {brand.name} · {contact.address.join(', ')} · GSTIN {contact.gstin}
          </span>
          <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="hover:text-white transition-colors">
            {contact.phone}
          </a>
        </div>
      </footer>
      <WhatsAppFab />
    </>
  )
}
