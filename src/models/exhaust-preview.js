import * as THREE from 'three'

const ROTOR_DIAMETER_MM = 18 * 25.4
// Approximate casing diameter for the visual preview until a motor drawing is available.
const PREVIEW_CASING_DIAMETER_MM = 120
const BLADE_PITCH = 0.17

// The homepage rotor follows the photographed four-blade assembly.
export function attachPreviewFan(motor) {
  const shaft = motor.getObjectByName('shaft')
  const housing = motor.getObjectByName('formed-housing')
  if (!shaft || !housing) throw new Error('The exhaust preview requires a motor shaft and housing')

  const shaftBounds = new THREE.Box3().setFromObject(shaft)
  const fan = new THREE.Group()
  fan.name = 'preview-fan'
  shaftBounds.getCenter(fan.position)
  fan.position.y = shaftBounds.max.y - 0.06

  const blade = new THREE.Shape()
  blade.moveTo(0.08, -0.14)
  blade.bezierCurveTo(0.24, -0.23, 0.37, -0.3, 0.49, -0.26)
  blade.bezierCurveTo(0.62, -0.21, 0.69, -0.11, 0.69, 0.04)
  blade.lineTo(0.68, 0.28)
  blade.quadraticCurveTo(0.68, 0.35, 0.59, 0.34)
  blade.bezierCurveTo(0.39, 0.32, 0.22, 0.27, 0.08, 0.23)
  blade.closePath()
  const bladeGeometry = new THREE.ExtrudeGeometry(blade, {
    depth: 0.016, bevelEnabled: true, bevelSize: 0.007, bevelThickness: 0.006,
    bevelSegments: 2, curveSegments: 16,
  })
  bladeGeometry.rotateX(-Math.PI / 2)

  const coat = housing.material
  const ribGeometry = new THREE.CapsuleGeometry(0.018, 0.16, 4, 12)
  ribGeometry.rotateZ(Math.PI / 2)
  const brass = new THREE.MeshStandardMaterial({ color: '#8c7953', metalness: 0.68, roughness: 0.38 })
  const screwGeometry = new THREE.CylinderGeometry(0.016, 0.018, 0.013, 6)
  for (let i = 0; i < 4; i++) {
    const mount = new THREE.Group()
    mount.rotation.y = i * Math.PI / 2

    const paddle = new THREE.Group()
    paddle.rotation.x = BLADE_PITCH
    const mesh = new THREE.Mesh(bladeGeometry, coat)
    mesh.name = 'fan-blade'
    paddle.add(mesh)

    const rib = new THREE.Mesh(ribGeometry, coat)
    rib.position.set(0.415, 0.016, -0.045)
    rib.rotation.y = -0.37
    rib.scale.y = 0.32
    paddle.add(rib)

    const screw = new THREE.Mesh(screwGeometry, brass)
    screw.position.set(0.226, 0.025, -0.093)
    paddle.add(screw)
    mount.add(paddle)
    fan.add(mount)
  }

  // The shallow dished plate caps the blade roots and carries the shaft fastener.
  const hubProfile = [
    [0, -0.064], [0.14, -0.064], [0.188, -0.022], [0.222, 0.024],
    [0.228, 0.043], [0.22, 0.05], [0.207, 0.044], [0.169, 0.018],
    [0.09, 0.004], [0, 0.004],
  ].map(([radius, height]) => new THREE.Vector2(radius, height))
  const hub = new THREE.Mesh(new THREE.LatheGeometry(hubProfile, 64), coat)
  fan.add(hub)

  const steel = new THREE.MeshStandardMaterial({ color: '#596267', metalness: 0.62, roughness: 0.38 })
  const shaftCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.041, 32), steel)
  shaftCollar.position.y = 0.022
  fan.add(shaftCollar)
  const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.069, 0.019, 32), steel)
  washer.position.y = 0.043
  fan.add(washer)
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.024, 6), steel)
  nut.position.y = 0.064
  fan.add(nut)

  // Use the full tip sweep around the shaft, including the pitch and bevel.
  const pitchMatrix = new THREE.Matrix4().makeRotationX(BLADE_PITCH)
  const point = new THREE.Vector3()
  const vertices = bladeGeometry.attributes.position
  let tipRadius = 0
  for (let i = 0; i < vertices.count; i++) {
    point.fromBufferAttribute(vertices, i).applyMatrix4(pitchMatrix)
    tipRadius = Math.max(tipRadius, Math.hypot(point.x, point.z))
  }
  const housingWidth = new THREE.Box3().setFromObject(housing).getSize(point).x
  const targetDiameter = housingWidth * ROTOR_DIAMETER_MM / PREVIEW_CASING_DIAMETER_MM
  const radialScale = targetDiameter / (2 * tipRadius)
  fan.scale.set(radialScale, 1, radialScale)

  motor.add(fan)
  motor.rotation.z = -Math.PI / 2
  return fan
}
