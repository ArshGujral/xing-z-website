import * as THREE from 'three'

const LOGO_ASPECT = 873 / 357 // public/xingz-logo-*.png
const textures = new Map<string, THREE.Texture>()

function logoTexture(url: string): THREE.Texture {
  let texture = textures.get(url)
  if (!texture) {
    texture = new THREE.TextureLoader().load(url)
    texture.userData.shared = true
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    textures.set(url, texture)
  }
  return texture
}

export type WordmarkOptions = {
  url: string // the white logo, tinted by `color`
  radius: number // just outside the surface it sits on
  y: number // centre height in the parent's space
  width: number // arc length across the can
  color?: THREE.ColorRepresentation
}

// The moulded XING-Z mark on a housing: the logo on a thin cylinder segment hugging the can, a touch lighter and
// glossier than the powder coat so it reads in the highlights the way the embossed mark does on the real motor.
// img2threejs records it as the coat's `embossed-wordmark` local override; the generator has no text primitive.
export function addWordmark(parent: THREE.Object3D, { url, radius, y, width, color = 0x2a2a2a }: WordmarkOptions): THREE.Mesh {
  const arc = width / radius
  const geometry = new THREE.CylinderGeometry(radius, radius, width / LOGO_ASPECT, 48, 1, true, -arc / 2, arc)
  const material = new THREE.MeshPhysicalMaterial({
    color,
    map: logoTexture(url),
    transparent: true,
    depthWrite: false,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'wordmark'
  mesh.position.y = y
  parent.add(mesh)
  return mesh
}
