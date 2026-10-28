// Each family's procedural 3D model (built with img2threejs from that family's photo).
// `load` returns a module whose `createModel(params)` gives a THREE.Group; `params(product, variants)` turns a
// catalogue product and its chosen optional changes into that model's options (stack length, ring, finish...).
// A family without an entry shows its photo.
import { asset } from '../content/site.js'

const hasRing = (product, variants) => !variants.includes('Without ring') && product.attributes.Ring !== 'Without ring'

export const MODELS = {
  'high-speed': {
    load: () => import('./high-speed.ts'),
    params: (product, variants) => ({ ring: hasRing(product, variants), photo: asset('models/high-speed-photo.webp') }),
  },
  110: {
    load: () => import('./110.ts'),
    params: (product, variants) => ({ ring: hasRing(product, variants), photo: asset('models/110-photo.webp') }),
  },
  kit: {
    load: () => import('./kit.ts'),
    params: (product, variants) => ({ ring: hasRing(product, variants), photo: asset('models/kit-photo.webp') }),
  },
}

export const hasModel = (id) => Boolean(id && MODELS[id])
