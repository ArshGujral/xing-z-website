import { useEffect, useState } from 'react'
import { loadCatalogue } from './catalogue.js'
import { asset, categories } from './content/site.js'

// The home page's ranges come from public/catalogue.json, so a range added in the admin panel appears here too.
// `categories` in site.js paints first and stays as the fallback if the catalogue can't load.
// A range is matched and anchored by its catalogue id, which never changes, so renaming it keeps its links working.
const fromFamily = (family) => {
  const known = categories.find((c) => c.family === family.id)
  return {
    slug: known?.slug ?? family.id,
    name: family.name,
    use: family.summary,
    image: family.photo ? asset(family.photo) : null,
    // A range without a photo is drawn as an illustration until one is uploaded.
    motor: known?.motor ?? { attachment: 'blades' },
  }
}

let pending
export function useRanges() {
  const [ranges, setRanges] = useState(categories)
  useEffect(() => {
    let live = true
    pending ??= loadCatalogue().then((c) => c.families.map(fromFamily))
    pending.then((r) => live && r.length && setRanges(r)).catch(() => {})
    return () => {
      live = false
    }
  }, [])
  return ranges
}

export const rangeLinks = (ranges) => ranges.map((c) => ({ label: c.name, href: `#${c.slug}` }))
export const rangeMenu = (ranges) => [...rangeLinks(ranges), { label: 'View all', href: '#range' }]

const words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']
export const countWord = (n) => words[n] ?? String(n)
