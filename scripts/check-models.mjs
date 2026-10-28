import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, basename } from 'node:path'
import * as THREE from 'three'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'))
// Models are roughly unit-sized. These broad limits catch collapsed or runaway geometry.
const MIN_SIZE = 0.05
const MAX_SIZE = 10
const results = new Map()
const resultFor = (family) => {
  if (!results.has(family)) results.set(family, { builds: 0, meshes: 0, specs: 0, errors: [], sizes: [] })
  return results.get(family)
}

function checkSpec(spec, label, result) {
  result.specs++
  if (!Array.isArray(spec.components) || !Array.isArray(spec.materials)) {
    result.errors.push(`${label}: missing components/materials arrays`)
    return
  }
  const ids = new Set()
  const materials = new Set(spec.materials.map((material) => material.id))
  for (const component of spec.components) {
    if (typeof component.id !== 'string' || !component.id.trim() || ids.has(component.id)) {
      result.errors.push(`${label}: missing or duplicate component id ${JSON.stringify(component.id)}`)
    }
    ids.add(component.id)
  }
  for (const component of spec.components) {
    if (component.parent != null && (!ids.has(component.parent) || component.parent === component.id)) {
      result.errors.push(`${label}: ${component.id} has invalid parent ${component.parent}`)
    }
    const seen = new Set([component.id])
    let parent = component.parent
    while (parent != null && ids.has(parent)) {
      if (seen.has(parent)) {
        result.errors.push(`${label}: parent cycle at ${component.id}`)
        break
      }
      seen.add(parent)
      parent = spec.components.find((candidate) => candidate.id === parent)?.parent
    }
    if (!materials.has(component.material)) {
      result.errors.push(`${label}: ${component.id} has unknown material ${component.material}`)
    }
  }
  for (const repetition of spec.repetitions ?? []) {
    if (!materials.has(repetition.material)) {
      result.errors.push(`${label}: ${repetition.id} has unknown material ${repetition.material}`)
    }
  }
}

function checkModel(group, label, result) {
  let meshes = 0
  group.traverse((object) => {
    if (object.isMesh) {
      meshes++
      if (!object.name?.trim()) result.errors.push(`${label}: unnamed mesh (${object.type})`)
    }
    if (object.isInstancedMesh && (!Number.isInteger(object.count) || object.count <= 0)) {
      result.errors.push(`${label}: ${object.name} has invalid instance count ${object.count}`)
    }
    const position = object.geometry?.getAttribute('position')
    if (object.isMesh && (!position || position.count === 0)) {
      result.errors.push(`${label}: ${object.name} has no geometry positions`)
    }
    if (position) {
      for (let i = 0; i < position.count; i++) {
        if (![position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite)) {
          result.errors.push(`${label}: ${object.name} has non-finite position at vertex ${i}`)
          break
        }
      }
    }
  })
  result.meshes += meshes
  if (!meshes) result.errors.push(`${label}: no meshes`)
  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  if (box.isEmpty() || ![...box.min, ...box.max].every(Number.isFinite)) {
    result.errors.push(`${label}: empty or non-finite bounding box`)
  } else {
    result.sizes.push(`${size.x.toFixed(3)} × ${size.y.toFixed(3)}`)
    for (const [axis, value] of [['width', size.x], ['height', size.y]]) {
      if (value < MIN_SIZE || value > MAX_SIZE) {
        result.errors.push(`${label}: ${axis} ${value} outside [${MIN_SIZE}, ${MAX_SIZE}]`)
      }
    }
  }
}

function disposeModel(group) {
  group.traverse((object) => {
    object.geometry?.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!material) continue
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose()
      material.dispose()
    }
  })
}

let server
const originalLoad = THREE.TextureLoader.prototype.load
try {
  // Skip image I/O and DOM creation; geometry and material construction still run normally.
  THREE.TextureLoader.prototype.load = function () { return new THREE.Texture() }
  server = await createServer({
    root,
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { preserveSymlinks: true },
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    appType: 'custom',
  })
  const { MODELS } = await server.ssrLoadModule('/src/models/registry.js')
  const catalogue = await readJson('public/catalogue.json')
  for (const id of Object.keys(MODELS)) resultFor(id)
  for (const filename of (await readdir(resolve(root, 'src/models/specs'))).sort()) {
    if (!filename.endsWith('.json')) continue
    const result = resultFor(basename(filename, '.json'))
    try {
      checkSpec(await readJson(`src/models/specs/${filename}`), filename, result)
    } catch (error) {
      result.errors.push(`${filename}: ${error.message}`)
    }
  }
  for (const [id, entry] of Object.entries(MODELS)) {
    const result = resultFor(id)
    try {
      const families = catalogue.families.filter((family) => (family.model || family.id) === id)
      if (!families.length) throw new Error('No matching catalogue family')
      const mod = await entry.load()
      for (const family of families) {
        const products = catalogue.products.filter((product) => product.family === family.id)
        if (!products.length) throw new Error(`No catalogue products for ${family.id}`)
        const variants = [[], ...(family.variants?.includes('Without ring') ? [['Without ring']] : [])]
        for (const product of products) {
          for (const selected of variants) {
            const label = `${product.code} / ${selected.join(', ') || 'default'}`
            let group
            result.builds++
            try {
              group = mod.createModel(entry.params ? entry.params(product, selected) : {})
              checkModel(group, label, result)
            } catch (error) {
              result.errors.push(`${label}: ${error.stack || error.message}`)
            } finally {
              if (group?.traverse) disposeModel(group)
            }
          }
        }
      }
    } catch (error) {
      result.errors.push(error.stack || error.message)
    }
  }
} catch (error) {
  resultFor('setup').errors.push(error.stack || error.message)
} finally {
  THREE.TextureLoader.prototype.load = originalLoad
  await server?.close()
}

console.table([...results].map(([family, result]) => ({
  family,
  status: result.errors.length ? 'FAIL' : 'PASS',
  builds: result.builds,
  meshes: result.meshes,
  specs: result.specs,
  'width × height': [...new Set(result.sizes)].join('; '),
  failures: result.errors.length,
})))
for (const [family, result] of results) {
  const counts = new Map()
  for (const error of result.errors) counts.set(error, (counts.get(error) ?? 0) + 1)
  for (const [error, count] of counts) console.error(`[${family}] ${error}${count > 1 ? ` (${count} occurrences)` : ''}`)
}
if ([...results.values()].some((result) => result.errors.length)) process.exitCode = 1
