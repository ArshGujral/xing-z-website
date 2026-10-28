import * as THREE from 'three'
import { createXingZSubmersiblePumpModel } from './generated/pump'
import projector from './projectors/pump.json'

export type PumpParams = { photo?: string }

// The photo only shows the pump from the front-left, so triangles turned far from that camera keep the plain
// moulded finish instead of stretched photo pixels.
const MIN_FACING = 0.42 // cos of the widest angle from the camera worth taking photo pixels from (~65 deg)
const SLOT_WINDOW = 0.5 // instanced slots facing the camera closer than ~60 deg are hidden: the photo shows the real ones

const textures = new Map<string, THREE.Texture>()

function photoTexture(url: string): THREE.Texture {
  let texture = textures.get(url)
  if (!texture) {
    texture = new THREE.TextureLoader().load(url)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    textures.set(url, texture)
  }
  return texture
}

// Projects the photo onto camera-facing triangles only (the pump is a box-and-dome, not a revolved can, so the
// motors' angle-clamped wrap would smear the front round the sides). Each triangle goes wholly to the photo or to
// the mesh's own material, so no triangle straddles the two.
function projectFront(model: THREE.Object3D, url: string) {
  const matrix = new THREE.Matrix4().fromArray(projector.matrix)
  const eye = new THREE.Vector3(...(projector.camera as [number, number, number]))
  const photo = new THREE.MeshStandardMaterial({
    map: photoTexture(url),
    color: 0x808080, // the photo already carries its studio lighting; scene lights only add shape on top
    emissive: 0xffffff,
    emissiveMap: photoTexture(url),
    emissiveIntensity: 0.7,
    roughness: 0.85,
    metalness: 0,
  })
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const n = new THREE.Vector3()
  const toEye = new THREE.Vector3()
  const p = new THREE.Vector3()
  model.updateMatrixWorld(true)
  model.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return
    const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    const position = source.attributes.position
    const front: number[] = []
    const rest: number[] = []
    for (let v = 0; v < position.count; v += 3) {
      a.fromBufferAttribute(position, v).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(position, v + 1).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(position, v + 2).applyMatrix4(mesh.matrixWorld)
      n.crossVectors(p.subVectors(b, a), toEye.subVectors(c, a)).normalize()
      toEye.copy(eye).sub(a).add(eye).sub(b).add(eye).sub(c).normalize()
      ;(n.dot(toEye) >= MIN_FACING ? front : rest).push(v)
    }
    if (!front.length) {
      source.dispose()
      return
    }
    const order = [...front, ...rest]
    const geometry = new THREE.BufferGeometry()
    for (const name of ['position', 'normal']) {
      const attribute = source.attributes[name] as THREE.BufferAttribute | undefined
      if (!attribute) continue
      const out = new Float32Array(order.length * 3 * attribute.itemSize)
      order.forEach((v, t) => out.set(attribute.array.slice(v * attribute.itemSize, (v + 3) * attribute.itemSize), t * 3 * attribute.itemSize))
      geometry.setAttribute(name, new THREE.BufferAttribute(out, attribute.itemSize))
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals()
    const uv = new Float32Array(order.length * 6)
    const pos = geometry.attributes.position
    for (let i = 0; i < front.length * 3; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(matrix)
      uv[i * 2] = (p.x + 1) / 2
      uv[i * 2 + 1] = (p.y + 1) / 2
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geometry.addGroup(0, front.length * 3, 0)
    geometry.addGroup(front.length * 3, rest.length * 3, 1)
    source.dispose()
    mesh.geometry.dispose()
    mesh.geometry = geometry
    mesh.material = [photo, mesh.material as THREE.Material]
  })
}

// Hides the instanced slots on the side the photo covers, so its real slots aren't doubled by modelled ones.
function hidePhotographedSlots(model: THREE.Object3D) {
  const eye = new THREE.Vector3(...(projector.camera as [number, number, number])).setY(0).normalize()
  const m = new THREE.Matrix4()
  const out = new THREE.Vector3()
  const zero = new THREE.Matrix4().makeScale(0, 0, 0)
  model.traverse((object) => {
    const slots = object as THREE.InstancedMesh
    if (!slots.isInstancedMesh || !slots.name.endsWith('slots')) return
    for (let i = 0; i < slots.count; i++) {
      slots.getMatrixAt(i, m)
      out.set(1, 0, 0).transformDirection(m) // instance +X points radially outward
      if (out.setY(0).normalize().dot(eye) > SLOT_WINDOW) slots.setMatrixAt(i, zero)
    }
    slots.instanceMatrix.needsUpdate = true
  })
}

// One housing for the 12 W, 20 W and 40 W pumps: the img2threejs model with the product photo on its front.
export function createModel(params: PumpParams = {}): THREE.Group {
  const model = createXingZSubmersiblePumpModel({ castShadow: true, receiveShadow: true })
  if (params.photo) {
    hidePhotographedSlots(model)
    projectFront(model, params.photo)
  }
  return model
}
