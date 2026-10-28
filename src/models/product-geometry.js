import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export function finishes() {
  const pixels = new Uint8Array(256 * 256 * 4)
  let seed = 9321
  for (let i = 0; i < pixels.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const v = 105 + ((seed >>> 16) % 45)
    pixels[i] = pixels[i + 1] = pixels[i + 2] = v; pixels[i + 3] = 255
  }
  const grain = new THREE.DataTexture(pixels, 256, 256)
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping
  grain.repeat.set(4, 3); grain.needsUpdate = true
  const material = (color, roughness, metalness = 0, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, metalness, envMapIntensity: .75, ...extra })
  return {
    coat: material('#111313', .43, .05, { bumpMap: grain, bumpScale: .0012 }),
    cast: material('#111313', .56, .03, { bumpMap: grain, bumpScale: .003 }),
    gloss: material('#090b0b', .21, .15, { clearcoat: .7, clearcoatRoughness: .16 }),
    alloy: material('#9b9e9d', .42, .85, { bumpMap: grain, bumpScale: .0018 }),
    steel: material('#b9bdbe', .24, 1), brass: material('#c7ad6c', .3, 1),
    shaft: material('#08776e', .25, .72), green: material('#00613b', .24, .75),
    black: material('#040505', .72), polymer: material('#111515', .46, 0, { bumpMap: grain, bumpScale: .0008 }),
    teal: material('#008e78', .55, 0, { bumpMap: grain, bumpScale: .00065, specularIntensity: .55 }),
  }
}

export function part(parent, name, geometry, material, position = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name; mesh.position.fromArray(position); mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh); return mesh
}
export const profile = (points, segments = 128, start = 0, length = Math.PI * 2) => new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), segments, start, length)
export const box = (x, y, z, bevel = .008) => new RoundedBoxGeometry(x, y, z, 3, bevel)
export function ring(parent, name, outer, inner, height, y, material) {
  const bevel = Math.min(.004, height / 4)
  return part(parent, name, profile([[inner, y], [outer - bevel, y], [outer, y + bevel], [outer, y + height - bevel], [outer - bevel, y + height], [inner, y + height], [inner, y]]), material)
}

// The bolt's local +Y points out of the surface; washers, shank and head share that axis.
export function fastener(parent, name, position, direction, radius, material, { screw = false, length = .04, nut = false } = {}) {
  const assembly = new THREE.Group(); assembly.name = name; assembly.position.fromArray(position)
  assembly.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...direction).normalize())
  parent.add(assembly)
  const washer = radius * 1.22
  ring(assembly, 'washer', washer, radius * .46, .006, 0, material)
  part(assembly, 'shank', new THREE.CylinderGeometry(radius * .46, radius * .46, length, 24), material, [0, -length / 2, 0])
  if (screw) {
    part(assembly, 'domed-head', profile([[0, .006], [radius * .85, .006], [radius, .011], [radius * .96, .019], [radius * .65, .025], [0, .027]], 32), material)
    const recess = new THREE.MeshStandardMaterial({ color: '#121616', roughness: .7 })
    part(assembly, 'drive-slot', box(radius * 1.15, .001, radius * .17, .0005), recess, [0, .026, 0])
    part(assembly, 'drive-cross', box(radius * .17, .001, radius * 1.15, .0005), recess, [0, .026, 0])
  } else {
    const shape = new THREE.Shape()
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; i ? shape.lineTo(Math.cos(a) * radius, Math.sin(a) * radius) : shape.moveTo(radius, 0) }
    shape.closePath()
    if (nut) { const hole = new THREE.Path(); hole.absarc(0, 0, radius * .43, 0, Math.PI * 2, true); shape.holes.push(hole) }
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: radius * .52, bevelEnabled: true, bevelSize: .0025, bevelThickness: .0025, bevelSegments: 2, curveSegments: 24, steps: 1 })
    geometry.rotateX(-Math.PI / 2)
    part(assembly, nut ? 'hex-nut' : 'hex-head', geometry, material, [0, .009, 0])
  }
  return assembly
}

export function threadedShaft(parent, name, radius, bottom, length, material, threaded = false) {
  const points = [[0, bottom], [radius * .9, bottom], [radius, bottom + .004]]
  if (threaded) for (let y = bottom + .008; y < bottom + length - Math.min(.12, length * .15); y += .013) points.push([radius, y], [radius * .91, y + .005], [radius, y + .011])
  points.push([radius, bottom + length - .006], [radius * .9, bottom + length], [0, bottom + length])
  return part(parent, name, profile(points, 64), material)
}
