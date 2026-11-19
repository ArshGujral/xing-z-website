import * as THREE from 'three'

// Fit an illustrative fan to the motor's shaft for the homepage animation.
export function attachPreviewFan(motor) {
  const shaft = motor.getObjectByName('shaft')
  if (!shaft) throw new Error('The exhaust preview requires a motor shaft')

  const shaftBounds = new THREE.Box3().setFromObject(shaft)
  const fan = new THREE.Group()
  fan.name = 'preview-fan'
  shaftBounds.getCenter(fan.position)
  fan.position.y = shaftBounds.max.y - 0.06

  const blade = new THREE.Shape()
  blade.moveTo(0.07, -0.06)
  blade.bezierCurveTo(0.22, -0.11, 0.37, -0.31, 0.51, -0.33)
  blade.bezierCurveTo(0.62, -0.33, 0.66, -0.17, 0.64, -0.07)
  blade.bezierCurveTo(0.59, 0.08, 0.34, 0.17, 0.1, 0.07)
  blade.closePath()
  const bladeGeometry = new THREE.ExtrudeGeometry(blade, {
    depth: 0.023, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.009,
    bevelSegments: 2, curveSegments: 16,
  })
  bladeGeometry.rotateX(-Math.PI / 2)
  const metal = new THREE.MeshStandardMaterial({ color: '#a9b7b9', metalness: 0.65, roughness: 0.32 })
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(bladeGeometry, metal)
    mesh.rotation.y = i * Math.PI * 2 / 3
    fan.add(mesh)
  }

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.128, 0.106, 0.135, 36),
    new THREE.MeshStandardMaterial({ color: '#262c30', metalness: 0.28, roughness: 0.4 }),
  )
  hub.position.y = 0.021
  fan.add(hub)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.067, 0.015, 24), metal)
  cap.position.y = 0.092
  fan.add(cap)
  motor.add(fan)
  motor.rotation.z = -Math.PI / 2
  return fan
}
