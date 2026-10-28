// Each family has a solid procedural model informed by its catalogue photo.
// `load` returns a module whose `createModel(params)` gives a THREE.Group; `params(product, variants)` turns a
// catalogue product and its chosen optional changes into that model's options (stack length, ring, finish...).
// A family without an entry shows its photo.


const hasRing = (product, variants) => !variants.includes('Without ring') && product.attributes.Ring !== 'Without ring'

export const MODELS = {
  capcan: { load: () => import('./capcan.ts') },
  'h-frame': { load: () => import('./h-frame.ts') },
  exhaust: { load: () => import('./exhaust.ts') },
  pump: { load: () => import('./pump.ts') },
  'high-speed': {
    load: () => import('./high-speed.ts'),
    params: (product, variants) => ({ ring: hasRing(product, variants) }),
  },
  110: {
    load: () => import('./110.ts'),
    params: (product, variants) => ({ ring: hasRing(product, variants) }),
  },
  kit: {
    load: () => import('./kit.ts'),
    params: (product, variants) => ({ ring: hasRing(product, variants) }),
  },
}

export const hasModel = (id) => Boolean(id && MODELS[id])
