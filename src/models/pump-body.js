import * as THREE from 'three'
import { asset } from '../content/site.js'

// The submersible pump, rebuilt from public/products/submersible-pumps.webp. Units: the base band is 1 wide.
// The teal hood is one parametric shell around the outlet: each direction round the outlet has its own vertical
// profile, rounded like a dome over the impeller (front-left) and boxy, taller and drafted over the motor
// (back-right), so the two read as a single moulding. The impeller slots are real openings in that shell.

const TAU = Math.PI * 2
const OUTLET = new THREE.Vector2(-0.1, 0.06) // outlet axis (x, z); front is +z
const BAND_R = 0.49 // the hood sits just inside the band
const WELL_R = 0.14 // the hood rolls down into a well around the outlet collar
const WELL_Y = 0.695
const DOME_N = 2.7, DOME_TOP = 0.685
const SLOT = { count: 52, open: 0.47, from: 0.355, to: 0.585, wall: 0.018 }
const SLOT_ARC = [THREE.MathUtils.degToRad(84), THREE.MathUtils.degToRad(246)]

const smooth = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const wrap = (a) => ((a % TAU) + TAU) % TAU

// The motor block is a drafted box in plan: a flat front panel, a flat right side and back, with rounded vertical corners. Each plane is [normal angle, distance from the band's centre].
const BLOCK_PLANES = [[1.25, 0.45], [0, 0.45], [-Math.PI / 2, 0.42]].map(([a, d]) => [new THREE.Vector2(Math.cos(a), Math.sin(a)), d])

const smin = (a, b, k) => { const h = THREE.MathUtils.clamp(0.5 + (b - a) / (2 * k), 0, 1); return THREE.MathUtils.lerp(b, a, h) - k * h * (1 - h) }

// Distance from the outlet to the hood's foot along a direction: the band edge, cut back by the block's planes.
function footprint(theta, w) {
  const dx = Math.cos(theta), dz = Math.sin(theta), b = OUTLET.x * dx + OUTLET.y * dz
  const circle = -b + Math.sqrt(b * b - OUTLET.lengthSq() + BAND_R * BAND_R)
  if (w <= 0) return circle
  let d = circle
  for (const [n, offset] of BLOCK_PLANES) {
    const facing = n.x * dx + n.y * dz
    if (facing > 0.02) d = smin(d, (offset - n.dot(OUTLET)) / facing, 0.06)
  }
  return THREE.MathUtils.lerp(circle, d, w)
}

// 0 = impeller dome, 1 = motor block. The front seam is the flared panel's S-curve edge: it bows out over the slots.
function blockWeight(theta, s, width = 0.035) {
  const t = wrap(theta), edge = THREE.MathUtils.degToRad(55 + 25 * Math.sin(Math.PI * 0.9 * s))
  const front = 1 - smooth(edge - width, edge + width, t)
  const back = smooth(THREE.MathUtils.degToRad(238), THREE.MathUtils.degToRad(262), t)
  return Math.max(front, back)
}

// A point on the hood: theta round the outlet, phi from the band (0) to the well (PI/2), inset into the wall.
function hoodPoint(theta, phi, inset = 0, out = new THREE.Vector3()) {
  const s = Math.sin(phi), w = blockWeight(theta, s)
  const n = THREE.MathUtils.lerp(DOME_N, 10, w)
  const back = (1 - Math.sin(theta)) / 2 // 0 at the front, 1 at the back
  const y0 = THREE.MathUtils.lerp(0.33, 0.37, w)
  // The deck heights blend gently, so the seam fades out as it reaches the well instead of standing up as a fin.
  const top = THREE.MathUtils.lerp(DOME_TOP, 0.75 + 0.02 * back, blockWeight(theta, s, 0.45))
  const ce = Math.pow(Math.cos(phi), 2 / n), se = Math.pow(s, 2 / n)
  // Both lean inward as they rise (mould draft); the dome far more, so it reads as a slotted cone.
  const r = WELL_R + (footprint(theta, w) - WELL_R) * ce - THREE.MathUtils.lerp(0.11, 0.035, w) * Math.pow(s, THREE.MathUtils.lerp(1, 1.5, w)) * ce - inset * (1 - se * 0.6)
  return out.set(OUTLET.x + r * Math.cos(theta), y0 + (top - y0) * se - inset * se * 0.6, OUTLET.y + r * Math.sin(theta))
}

function hoodNormal(theta, phi, out = new THREE.Vector3()) {
  const e = 1e-4, a = hoodPoint(theta, Math.max(phi - e, 0)), b = hoodPoint(theta, Math.min(phi + e, Math.PI / 2))
  const c = hoodPoint(theta - e, phi), d = hoodPoint(theta + e, phi)
  return out.crossVectors(b.sub(a), d.sub(c)).normalize()
}

// Where the shell reaches a height in a direction (the hood rises monotonically from band to well).
function surfaceAt(theta, y) {
  let lo = 0, hi = Math.PI / 2
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (hoodPoint(theta, mid).y < y) lo = mid; else hi = mid }
  return { theta, phi: lo, point: hoodPoint(theta, lo) }
}

// phi at which the dome profile reaches a height, for horizontal slot ends.
const phiAtY = (y) => Math.asin(Math.pow((y - 0.33) / (DOME_TOP - 0.33), DOME_N / 2))

const slotOpen = (theta) => {
  const t = wrap(theta)
  if (t < SLOT_ARC[0] || t > SLOT_ARC[1]) return false
  return ((t / TAU) * SLOT.count) % 1 < SLOT.open
}

function hoodGeometry(inset, withSlots) {
  const nT = 408, thetas = [], phis = []
  const p1 = phiAtY(SLOT.from), p2 = phiAtY(SLOT.to)
  for (let i = 0; i <= nT; i++) thetas.push(-Math.PI / 2 + (i / nT) * TAU) // seam at the back, inside the motor block
  for (let j = 0; j <= 56; j++) phis.push((j / 56) * (Math.PI / 2))
  phis.push(p1, p2); phis.sort((a, b) => a - b)
  const pos = [], nor = [], idx = [], p = new THREE.Vector3(), nm = new THREE.Vector3()
  for (const t of thetas) for (const f of phis) {
    hoodPoint(t, f, inset, p); pos.push(p.x, p.y, p.z)
    hoodNormal(t, Math.min(Math.max(f, 1e-3), Math.PI / 2 - 1e-3), nm); nor.push(nm.x, nm.y, nm.z)
  }
  const cols = phis.length
  for (let i = 0; i < nT; i++) {
    const open = withSlots && slotOpen((thetas[i] + thetas[i + 1]) / 2)
    for (let j = 0; j < cols - 1; j++) {
      if (open && phis[j] >= p1 - 1e-9 && phis[j + 1] <= p2 + 1e-9) continue
      const a = i * cols + j, b = (i + 1) * cols + j
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

// The moulded thickness showing at each slot's sides and ends.
function slotWalls() {
  const pos = [], quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...b, ...d, ...c)
  const P = (t, f, i) => hoodPoint(t, f, i).toArray()
  const p1 = phiAtY(SLOT.from), p2 = phiAtY(SLOT.to), step = TAU / SLOT.count
  for (let k = 0; k < SLOT.count; k++) {
    const ta = k * step, tb = ta + step * SLOT.open
    if (ta < SLOT_ARC[0] || tb > SLOT_ARC[1]) continue
    for (let j = 0; j < 12; j++) {
      const fa = p1 + ((p2 - p1) * j) / 12, fb = p1 + ((p2 - p1) * (j + 1)) / 12
      quad(P(ta, fa, 0), P(ta, fb, 0), P(ta, fa, SLOT.wall), P(ta, fb, SLOT.wall))
      quad(P(tb, fb, 0), P(tb, fa, 0), P(tb, fb, SLOT.wall), P(tb, fa, SLOT.wall))
    }
    for (let j = 0; j < 4; j++) {
      const a = ta + ((tb - ta) * j) / 4, b = ta + ((tb - ta) * (j + 1)) / 4
      quad(P(b, p1, 0), P(a, p1, 0), P(b, p1, SLOT.wall), P(a, p1, SLOT.wall))
      quad(P(a, p2, 0), P(b, p2, 0), P(a, p2, SLOT.wall), P(b, p2, SLOT.wall))
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}

// The well round the outlet: teal walls from the hood's inner edge down to the collar.
function wellWall() {
  const pos = [], idx = [], n = 96
  for (let i = 0; i <= n; i++) {
    const p = hoodPoint(-Math.PI / 2 - (i / n) * TAU, Math.PI / 2)
    pos.push(p.x, p.y, p.z, p.x, WELL_Y - 0.005, p.z)
    if (i < n) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const lathe = (points, segments = 96, start = 0, length = TAU) =>
  new THREE.LatheGeometry(points.map((p) => new THREE.Vector2(...p)), segments, start, length)

// The base strainer: a deep rounded bowl whose vertical intake slots are gaps between ribs, dark inside.
function addBowl(group, black, shadow) {
  const profile = [[0, -0.04], [0.17, -0.04], [0.29, -0.022], [0.38, 0.005], [0.445, 0.045], [0.485, 0.1], [0.503, 0.16], [0.508, 0.21], [0.508, 0.255]]
  const radiusAt = (y) => { for (let i = 1; i < profile.length; i++) if (y <= profile[i][1]) { const a = profile[i - 1], b = profile[i]; return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) } return 0.507 }
  const low = 0.0, high = 0.225, t = 0.014, count = 52, open = 0.5
  const add = (g, m = black) => { const mesh = new THREE.Mesh(g, m); group.add(mesh); return mesh }
  add(lathe([...profile.filter((p) => p[1] < low), [radiusAt(low), low], [radiusAt(low) - t, low]]))
  add(lathe([[radiusAt(high) - t, high], [radiusAt(high), high], ...profile.filter((p) => p[1] > high)]))
  const rib = [[radiusAt(low), low], ...profile.filter((p) => p[1] > low && p[1] < high), [radiusAt(high), high], [radiusAt(high) - t, high], [radiusAt(low) - t, low], [radiusAt(low), low]]
  for (let i = 0; i < count; i++) add(lathe(rib, 4, (i * TAU) / count, (TAU / count) * (1 - open)))
  add(lathe(profile.map(([r, y]) => [r * 0.9, y + 0.006]), 64), shadow).material.side = THREE.DoubleSide
}

export function createPumpModel() {
  const root = new THREE.Group()
  root.name = 'submersible-pump'
  const mat = (color, roughness, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.6, envMapIntensity: 0.45, ...extra })
  // ACES tone mapping pulls this saturated teal toward grey, so the plastic skips it to keep the photo's colour.
  const teal = mat('#00967f', 0.55, { clearcoat: 0, envMapIntensity: 0.3, toneMapped: false })
  const black = mat('#1d1d1d', 0.55)
  const nozzleBlack = mat('#171717', 0.42, { clearcoat: 0.3 })
  const shadow = new THREE.MeshBasicMaterial({ color: '#060606' })
  const add = (g, m, name) => { const mesh = new THREE.Mesh(g, m); mesh.name = name; root.add(mesh); return mesh }

  addBowl(root, Object.assign(black.clone(), { side: THREE.DoubleSide }), shadow) // seen from inside through the slots
  // The rim band, with a raised black skirt under the motor block.
  add(lathe([[0.49, 0.25], [0.512, 0.256], [0.512, 0.328], [0.5, 0.335], [0.49, 0.335]]), black, 'rim-band')
  add(lathe([[0.47, 0.33], [0.487, 0.33], [0.487, 0.38], [0.47, 0.38]]), black, 'skirt')
  add(new THREE.CircleGeometry(0.5, 64).rotateX(-Math.PI / 2).translate(0, 0.3, 0), shadow, 'core')
  for (const deg of [180, 118, 300]) {
    const a = THREE.MathUtils.degToRad(deg), clip = add(new THREE.BoxGeometry(0.08, 0.026, 0.016), teal, 'clip')
    clip.position.set(Math.cos(a) * 0.516, 0.3, Math.sin(a) * 0.516)
    clip.rotation.y = -a + Math.PI / 2
  }

  add(hoodGeometry(0, true), teal, 'hood')
  const tealInside = Object.assign(teal.clone(), { side: THREE.DoubleSide })
  add(slotWalls(), tealInside, 'slot-walls')
  add(hoodGeometry(0.06, false), shadow, 'impeller-shadow').material.side = THREE.DoubleSide
  // The well round the outlet: teal walls down to the black collar.
  add(wellWall(), tealInside, 'well')

  // Stepped barb outlet on its collar.
  const outlet = add(lathe([[0, WELL_Y - 0.004], [WELL_R + 0.004, WELL_Y - 0.004], [WELL_R + 0.004, WELL_Y + 0.004], [0.125, WELL_Y + 0.008], [0.125, WELL_Y + 0.012], [0.11, WELL_Y + 0.025], [0.08, WELL_Y + 0.03], [0.08, WELL_Y + 0.045],
    [0.062, WELL_Y + 0.05], [0.062, WELL_Y + 0.130], [0.072, WELL_Y + 0.132], [0.058, WELL_Y + 0.180], [0.072, WELL_Y + 0.182], [0.058, WELL_Y + 0.230], [0.07, WELL_Y + 0.232], [0.056, WELL_Y + 0.265], [0.044, WELL_Y + 0.265], [0.044, WELL_Y + 0.230], [0, WELL_Y + 0.230]], 96), nozzleBlack, 'outlet')
  outlet.position.set(OUTLET.x, 0, OUTLET.y)

  // The moulded mark on the motor block's flared panel, laid on the shell's surface there.
  const texture = new THREE.TextureLoader().load(asset('xingz-logo-white.png'))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const geometry = new THREE.PlaneGeometry(0.2, 0.2 * 357 / 873, 24, 4)
  const centre = surfaceAt(THREE.MathUtils.degToRad(57), 0.55), n = hoodNormal(centre.theta, centre.phi)
  const frame = new THREE.Object3D()
  frame.position.copy(centre.point)
  frame.lookAt(centre.point.clone().add(n))
  frame.updateMatrix()
  geometry.applyMatrix4(frame.matrix)
  // Wrap the flat mark onto the shell so it hugs the panel's curve.
  const p = geometry.attributes.position
  for (let i = 0; i < p.count; i++) {
    const hit = surfaceAt(Math.atan2(p.getZ(i) - OUTLET.y, p.getX(i) - OUTLET.x), p.getY(i))
    hit.point.addScaledVector(hoodNormal(hit.theta, hit.phi), 0.003)
    p.setXYZ(i, hit.point.x, hit.point.y, hit.point.z)
  }
  geometry.computeVertexNormals()
  add(geometry, new THREE.MeshPhysicalMaterial({ color: '#00705f', map: texture, toneMapped: false, transparent: true, depthWrite: false, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }), 'moulded-wordmark')

  root.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = o.material !== shadow })
  return root
}
