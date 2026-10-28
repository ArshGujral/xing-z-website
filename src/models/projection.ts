import * as THREE from 'three'

export type PhotoProjection = {
  url: string // the product photo, background grown into the object so edges never pick up white
  matrix: number[] // projection × view of the camera the photo was matched with (img2threejs review camera)
  camera: [number, number, number] // that camera's position in model space (it sits on the +Z side)
  minY?: number // lowest height worth sampling; below it the photo shows floor and shadow
  blank?: [number, number, number, number] // [from, to, sampleFrom, sampleTo]: a hidden part's band, repainted from plain coat
  upMaterial?: THREE.Material // finish for up-facing triangles; defaults to each mesh's own
  maxAngle?: number // degrees from the camera worth trusting; narrower when side hardware crowds the photo's edges
}

const textures = new Map<string, THREE.Texture>()
// Past this angle from the camera the photo is too foreshortened to trust (rim light, stretched pixels).
const DEFAULT_MAX_ANGLE = 62
const UP_FACING = 0.6
const MAX_EDGE = 0.04 // model units; per-vertex sampling needs vertices at least this dense

// Splits triangles on their longest edge until every edge is shorter than MAX_EDGE (positions and normals only),
// so a tall lathe wall gets enough vertices to follow the photo, and blanked bands stop at their own height.
function subdivide(geometry: THREE.BufferGeometry, matrixWorld: THREE.Matrix4): THREE.BufferGeometry {
  const pos = geometry.attributes.position
  const nor = geometry.attributes.normal
  const out: number[] = []
  const outN: number[] = []
  const scale = new THREE.Vector3().setFromMatrixScale(matrixWorld)
  const unit = Math.max(scale.x, scale.y, scale.z) || 1
  const v = (i: number) => [pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i)]
  const len = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * unit
  const mid = (a: number[], b: number[]) => a.map((x, i) => (x + b[i]) / 2)
  const emit = (a: number[], b: number[], c: number[], depth: number) => {
    const ab = len(a, b), bc = len(b, c), ca = len(c, a)
    const longest = Math.max(ab, bc, ca)
    if (longest <= MAX_EDGE || depth > 8) {
      for (const p of [a, b, c]) { out.push(p[0], p[1], p[2]); outN.push(p[3], p[4], p[5]) }
      return
    }
    if (longest === ab) { const m = mid(a, b); emit(a, m, c, depth + 1); emit(m, b, c, depth + 1) }
    else if (longest === bc) { const m = mid(b, c); emit(a, b, m, depth + 1); emit(a, m, c, depth + 1) }
    else { const m = mid(c, a); emit(a, b, m, depth + 1); emit(m, b, c, depth + 1) }
  }
  for (let i = 0; i < pos.count; i += 3) emit(v(i), v(i + 1), v(i + 2), 0)
  const result = new THREE.BufferGeometry()
  result.setAttribute('position', new THREE.Float32BufferAttribute(out, 3))
  result.setAttribute('normal', new THREE.Float32BufferAttribute(outN, 3))
  return result
}

// Paints the photo onto the model (img2threejs projection route): each side-facing triangle takes the photo pixels
// it projects to through the matched camera. Triangles past 62 deg from the camera, and the whole back, sample the
// 62 deg column on their own side at their own height, so bands and edges carry on round the housing without
// mirroring the wordmark. Up-facing triangles (where the photo's screws and shaft would smear) and instanced parts
// keep the model's own finish. Decisions are made per triangle so no triangle straddles two sample regions.
export function applyPhotoProjection(model: THREE.Object3D, { url, matrix, camera, minY = 0.045, blank, upMaterial, maxAngle }: PhotoProjection): void {
  let texture = textures.get(url)
  if (!texture) {
    texture = new THREE.TextureLoader().load(url)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    textures.set(url, texture)
  }
  const MAX_ANGLE = THREE.MathUtils.degToRad(maxAngle ?? DEFAULT_MAX_ANGLE)
  const projector = new THREE.Matrix4().fromArray(matrix)
  const eye = new THREE.Vector3(...camera)
  // The photo shown as photographed: its own studio tones (deep blacks, satin highlights, crinkle, embossed
  // wordmark) come straight from the pixels, unlit and untone-mapped, with a faint live reflection on top so
  // the surface still glints as the model turns.
  const photoMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 1,
    roughness: 0.4,
    metalness: 0,
    specularIntensity: 0.5,
    envMapIntensity: 0.25,
    toneMapped: false,
  })
  // Bright parts (a painted shaft) keep their full photographed colour; only the dark coat needs taming.
  const brightMaterial = photoMaterial.clone()
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const centre = new THREE.Vector3()
  const faceNormal = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()
  const p = new THREE.Vector3()
  model.updateMatrixWorld(true)
  model.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || mesh.userData.noProjection) return
    // A mesh may narrow its own window, e.g. a ring sampling only a clean stretch of the photo between features.
    const meshMax = mesh.userData.projectionMaxAngle
    const limit = typeof meshMax === 'number' ? THREE.MathUtils.degToRad(meshMax) : MAX_ANGLE
    const original = mesh.material as THREE.Material
    const flat = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    if (!flat.attributes.normal) flat.computeVertexNormals()
    const source = subdivide(flat, mesh.matrixWorld)
    flat.dispose()
    const position = source.attributes.position
    const sideTris: number[] = []
    const upTris: number[] = []
    const uvByVertex = new Float32Array(position.count * 2)
    for (let v = 0; v < position.count; v += 3) {
      for (let k = 0; k < 3; k++) corners[k].fromBufferAttribute(position, v + k).applyMatrix4(mesh.matrixWorld)
      faceNormal.crossVectors(e1.subVectors(corners[1], corners[0]), e2.subVectors(corners[2], corners[0])).normalize()
      if (faceNormal.y > UP_FACING) {
        upTris.push(v)
        continue
      }
      sideTris.push(v)
      centre.copy(corners[0]).add(corners[1]).add(corners[2]).divideScalar(3)
      const facing = faceNormal.dot(e1.subVectors(eye, centre).normalize()) >= 0.05
      const side = Math.sign(centre.x || 1)
      const inBlank = blank && centre.y >= blank[0] && centre.y <= blank[1]
      for (let k = 0; k < 3; k++) {
        p.copy(corners[k])
        const angle = Math.atan2(p.x, p.z)
        const target = facing ? THREE.MathUtils.clamp(angle, -limit, limit) : side * limit
        if (target !== angle) {
          const r = Math.hypot(p.x, p.z)
          p.set(r * Math.sin(target), p.y, r * Math.cos(target))
        }
        if (inBlank) p.y = blank[2] + ((p.y - blank[0]) / (blank[1] - blank[0])) * (blank[3] - blank[2])
        p.y = Math.max(p.y, minY)
        p.applyMatrix4(projector) // divides by w: normalized device coordinates
        uvByVertex[(v + k) * 2] = (p.x + 1) / 2
        uvByVertex[(v + k) * 2 + 1] = (p.y + 1) / 2
      }
    }

    // Rebuild with side triangles first (photo) and up-facing ones after (the model's own finish).
    const order = [...sideTris, ...upTris]
    const geometry = new THREE.BufferGeometry()
    for (const name of Object.keys(source.attributes)) {
      if (name === 'uv') continue
      const attribute = source.attributes[name] as THREE.BufferAttribute
      const out = new Float32Array(order.length * 3 * attribute.itemSize)
      order.forEach((v, t) => out.set(attribute.array.slice(v * attribute.itemSize, (v + 3) * attribute.itemSize), t * 3 * attribute.itemSize))
      geometry.setAttribute(name, new THREE.BufferAttribute(out, attribute.itemSize))
    }
    const uv = new Float32Array(order.length * 6)
    order.forEach((v, t) => uv.set(uvByVertex.slice(v * 2, v * 2 + 6), t * 6))
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    if (!geometry.attributes.normal) geometry.computeVertexNormals()
    geometry.addGroup(0, sideTris.length * 3, 0)
    geometry.addGroup(sideTris.length * 3, upTris.length * 3, 1)
    source.dispose()
    mesh.geometry.dispose()
    mesh.geometry = geometry
    mesh.material = [mesh.userData.photoBright ? brightMaterial : photoMaterial, upMaterial ?? original]
  })
}
