import { asset } from './content/site.js'

// The product catalogue lives in public/catalogue.json so the admin panel can update it without a code change.
// It holds names, codes and options only; prices are quoted on WhatsApp and never published.
export async function loadCatalogue() {
  const res = await fetch(`${asset('catalogue.json')}?v=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Catalogue failed to load (${res.status})`)
  return res.json()
}

export const productsOf = (catalogue, familyId) => catalogue.products.filter((p) => p.family === familyId)

// Option groups for a family, in the order they first appear, each with its values in that order.
export function optionGroups(products) {
  const groups = new Map()
  for (const p of products) {
    for (const [key, value] of Object.entries(p.attributes ?? {})) {
      if (!groups.has(key)) groups.set(key, [])
      if (!groups.get(key).includes(value)) groups.get(key).push(value)
    }
  }
  return [...groups].map(([key, values]) => ({ key, values })).filter((g) => g.values.length > 0)
}

const sameOn = (a, b, keys) => keys.filter((k) => a.attributes?.[k] === b.attributes?.[k]).length

// Picking a value always lands on a real product: the one with that value that keeps the most of the current choices.
export function pick(products, current, key, value) {
  const keys = Object.keys(current.attributes ?? {}).filter((k) => k !== key)
  const candidates = products.filter((p) => p.attributes?.[key] === value)
  return candidates.sort((a, b) => sameOn(b, current, keys) - sameOn(a, current, keys))[0] ?? current
}

// A value is "direct" when choosing it changes nothing else; otherwise choosing it also moves other options.
export function isDirect(products, current, key, value) {
  const keys = Object.keys(current.attributes ?? {}).filter((k) => k !== key)
  return products.some((p) => p.attributes?.[key] === value && sameOn(p, current, keys) === keys.length)
}

// Optional changes for a product: its own list if it has one, else its family's; "Without ring" only where it has a ring.
export function variantsFor(family, product) {
  const list = product.variants ?? family.variants ?? []
  return list.filter((v) => !(v === 'Without ring' && /without ring/i.test(product.attributes?.Ring ?? '')))
}

export const quoteMessage = (product, variants) =>
  `Hi Xing-Z, I'd like a quote for ${product.name} (code ${product.code})` +
  (variants.length ? `, ${variants.join(', ').toLowerCase()}` : '') +
  '. Quantity: '
