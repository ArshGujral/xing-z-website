import * as THREE from 'three'
import { applyPhotoProjection } from './projection'

export type MotorParams = { ring?: boolean; photo?: string }

export type MotorSetup = {
  create: (options: { castShadow?: boolean; receiveShadow?: boolean }) => THREE.Group // img2threejs factory
  projector: { matrix: number[]; camera: number[] } // review camera the photo was matched with
  ringParts?: string[] // component ids hidden for "Without ring"
  ringSpan?: [number, number] // height band the ring covers, repainted as plain coat when it is hidden
  plainCoat?: [number, number] // a clean band of housing in the photo to borrow that coat from
  maxAngle?: number // see applyPhotoProjection
  ringWindow?: number // degrees either side of the front where the photo's ring is clean (no bolts or lugs)
}

// A threaded stud in the instanced unit space (radius 0.5, height 1): a zig-zag lathe, about 30 threads.
function threadedStud(): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [new THREE.Vector2(0, -0.5)]
  for (let i = 0; i <= 60; i++) points.push(new THREE.Vector2(i % 2 ? 0.5 : 0.4, -0.5 + i / 60))
  points.push(new THREE.Vector2(0, 0.5))
  return new THREE.LatheGeometry(points, 16)
}

// Fastener detail the generator's instanced cylinders and domes can't express: hex nuts, threaded studs and
// a hex socket in every button-head screw.
function refineHardware(model: THREE.Group) {
  const sockets: [THREE.Object3D, THREE.InstancedMesh][] = []
  model.traverse((object) => {
    const mesh = object as THREE.InstancedMesh
    if (!mesh.isInstancedMesh) return
    if (mesh.name.endsWith('nuts')) {
      mesh.geometry.dispose()
      mesh.geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 6)
    } else if (mesh.name === 'studs') {
      mesh.geometry.dispose()
      mesh.geometry = threadedStud()
    } else if (mesh.name === 'screw-heads' && mesh.parent) {
      const socket = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.08, 6),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.4 }),
        mesh.count,
      )
      const m = new THREE.Matrix4()
      const lift = new THREE.Matrix4().makeTranslation(0, 0.47, 0)
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, m)
        socket.setMatrixAt(i, m.multiply(lift))
      }
      socket.name = 'screw-sockets'
      sockets.push([mesh.parent, socket])
    }
  })
  sockets.forEach(([parent, socket]) => parent.add(socket))
}

// Builds a family's site model: the img2threejs factory, refined hardware, and the product photo projected onto
// the housing so its real detail (wordmark, cast texture, strap edges) shows. "Without ring" hides the ring's
// parts and repaints the band it covered with plain coat borrowed from the photo.
export function buildMotor(setup: MotorSetup, params: MotorParams = {}): THREE.Group {
  const model = setup.create({ castShadow: true, receiveShadow: true })
  const nodes = (model.userData.sculptRuntime?.nodes ?? {}) as Record<string, THREE.Object3D>
  const ring = params.ring !== false
  if (!ring) setup.ringParts?.forEach((id) => nodes[id] && (nodes[id].visible = false))
  refineHardware(model)
  // The ring's own parts sample only the clean front stretch of the photo's ring, so the photographed bolts
  // (at the photo's lug positions) never repeat on it; its bolts keep their modelled brass.
  const meshes = (model.userData.sculptRuntime?.meshes ?? {}) as Record<string, THREE.Object3D>
  setup.ringParts?.forEach((id) => {
    const mesh = meshes[id]
    if (!mesh) return
    if (id.includes('bolt')) mesh.userData.noProjection = true
    else if (setup.ringWindow) mesh.userData.projectionMaxAngle = setup.ringWindow
  })
  Object.entries(meshes).forEach(([id, mesh]) => {
    if (id.includes('shaft')) mesh.userData.photoBright = true
  })
  if (params.photo) {
    const blank = !ring && setup.ringSpan && setup.plainCoat
      ? ([...setup.ringSpan, ...setup.plainCoat] as [number, number, number, number])
      : undefined
    applyPhotoProjection(model, {
      url: params.photo,
      matrix: setup.projector.matrix,
      camera: setup.projector.camera as [number, number, number],
      blank,
      maxAngle: setup.maxAngle,
      upMaterial: new THREE.MeshPhysicalMaterial({ color: 0x0d0d0d, roughness: 0.78, metalness: 0, specularIntensity: 0.4, envMapIntensity: 0.3 }),
    })
  }
  return model
}
