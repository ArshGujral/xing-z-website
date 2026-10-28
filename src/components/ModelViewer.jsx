import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { MODELS } from '../models/registry.js'
import { useTheme } from '../theme.jsx'

const disposeTree = (root) =>
  root.traverse((o) => {
    o.geometry?.dispose()
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    mats.forEach((m) => {
      Object.values(m).forEach((v) => v?.isTexture && !v.userData.shared && v.dispose())
      m.dispose()
    })
  })

// Turntable stage for a family's 3D model: drag to orbit, slow auto-rotate, soft contact shadow, teal rim light.
// With no model for the family it shows the photo instead, so every product always has a picture.
export default function ModelViewer({ modelId, product, variants = [], photo, alt }) {
  const mountRef = useRef(null)
  const stageRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [rotating, setRotating] = useState(false)
  const { theme } = useTheme()
  const entry = modelId ? MODELS[modelId] : null
  const variantKey = variants.join('|')

  // One renderer per stage; the model inside it is swapped as the product changes.
  useEffect(() => {
    if (!entry) return
    const mount = mountRef.current
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setStatus('fallback')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const environment = pmrem.fromScene(room, 0.04)
    scene.environment = environment.texture
    room.dispose()

    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.autoRotate = false
    controls.autoRotateSpeed = 0.65
    controls.maxPolarAngle = Math.PI * .49
    const stopRotation = () => { controls.autoRotate = false; setRotating(false) }
    controls.addEventListener('start', stopRotation)

    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(3, 5, 4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.radius = 6
    key.shadow.normalBias = .006
    key.shadow.bias = -.0001
    // Low behind-left, so the teal edge rakes the sides of a black housing instead of tinting its top face.
    const rim = new THREE.DirectionalLight(0xffffff, 1.6)
    rim.position.set(-4, 0.8, -3)
    const fill = new THREE.HemisphereLight(0xf1f5f4, 0x292521, 0.6)
    scene.add(key, rim, fill)

    const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShadowMaterial({ opacity: 0.35 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    const state = { renderer, scene, camera, controls, key, rim, fill, floor, model: null, frame: 0, visible: true, pmrem }
    stageRef.current = state

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / Math.max(1, h)
      if (state.fitRadius) {
        const halfV = THREE.MathUtils.degToRad(camera.fov / 2)
        const distance = state.fitRadius / Math.sin(Math.min(halfV, Math.atan(Math.tan(halfV) * camera.aspect))) * 1.16
        const direction = camera.position.clone().sub(controls.target).normalize()
        camera.position.copy(controls.target).addScaledVector(direction, distance)
        controls.minDistance = distance * .5
        controls.maxDistance = distance * 2
        controls.saveState()
      }
      camera.updateProjectionMatrix()
    }
    const loop = () => {
      controls.update()
      renderer.render(scene, camera)
      state.frame = state.visible ? requestAnimationFrame(loop) : 0
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    const io = new IntersectionObserver(([e]) => {
      state.visible = e.isIntersecting
      if (state.visible && !state.frame) state.frame = requestAnimationFrame(loop)
    })
    io.observe(mount)
    resize()
    state.frame = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(state.frame)
      ro.disconnect()
      io.disconnect()
      controls.dispose()
      if (state.model) disposeTree(state.model)
      floor.geometry.dispose()
      floor.material.dispose()
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      stageRef.current = null
    }
  }, [entry])

  // Build (or rebuild) the model for the current product, then frame it.
  useEffect(() => {
    const state = stageRef.current
    if (!entry || !state) return
    let cancelled = false
    setStatus('loading')
    entry
      .load()
      .then((mod) => {
        if (cancelled) return
        const group = mod.createModel(entry.params ? entry.params(product, variantKey ? variantKey.split('|') : []) : {})
        group.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true
            o.receiveShadow = true
          }
        })
        if (state.model) {
          state.scene.remove(state.model)
          disposeTree(state.model)
        }
        // Sit the model on the floor, centred, and frame it so it fills the stage.
        const box = new THREE.Box3().setFromObject(group)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        group.position.sub(new THREE.Vector3(center.x, box.min.y, center.z))
        state.scene.add(group)
        state.model = group
        const radius = Math.max(size.x, size.y, size.z)
        state.floor.scale.setScalar(radius * 0.9)
        state.key.shadow.camera.left = state.key.shadow.camera.bottom = -radius
        state.key.shadow.camera.right = state.key.shadow.camera.top = radius
        state.key.shadow.camera.updateProjectionMatrix()
        // Fit the bounding sphere inside the narrower of the two view angles, from a three-quarter view 18 deg up.
        const sphere = box.getBoundingSphere(new THREE.Sphere())
        state.fitRadius = sphere.radius
        const halfV = THREE.MathUtils.degToRad(state.camera.fov / 2)
        const halfFov = Math.min(halfV, Math.atan(Math.tan(halfV) * state.camera.aspect))
        const distance = (sphere.radius / Math.sin(halfFov)) * 1.16
        const up = THREE.MathUtils.degToRad(18)
        state.controls.target.set(0, size.y / 2, 0)
        state.camera.position.set(
          distance * Math.cos(up) * 0.30,
          size.y / 2 + distance * Math.sin(up),
          distance * Math.cos(up) * Math.sqrt(1 - .30 ** 2),
        )
        state.controls.minDistance = distance * 0.5
        state.controls.maxDistance = distance * 2
        state.camera.near = radius / 100
        state.camera.far = radius * 20
        state.camera.updateProjectionMatrix()
        state.controls.update()
        state.controls.saveState()
        state.controls.autoRotate = false
        setRotating(false)
        setStatus('ready')
      })
      .catch((error) => { console.error('Product model failed to load', error); if (!cancelled) setStatus('fallback') })
    return () => {
      cancelled = true
    }
  }, [entry, product, variantKey])

  // Lighting follows the theme: brighter rim on the dark stage, softer on the light one.
  useEffect(() => {
    const state = stageRef.current
    if (!state) return
    const light = theme === 'light'
    state.rim.intensity = light ? 1.1 : 1.8
    state.fill.intensity = light ? 0.9 : 0.55
    state.floor.material.opacity = light ? 0.18 : 0.35
  }, [theme, status])

  const showPhoto = !entry || status === 'fallback'

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" style={{ visibility: showPhoto ? 'hidden' : 'visible' }} aria-label={alt} role="img" />
      {showPhoto && (
        <img
          key={photo}
          src={photo}
          alt={alt}
          className="absolute inset-0 w-full h-full object-contain p-10 sm:p-14 animate-dropdown drop-shadow-[0_24px_30px_rgba(0,0,0,0.45)] light:drop-shadow-[0_18px_24px_rgba(20,70,62,0.2)]"
        />
      )}
      {entry && status === 'ready' && (
        <div className="absolute top-4 right-4 flex gap-2">
          <button type="button" className="rounded-full border border-white/15 bg-page/80 px-3 py-2 text-xs text-white" aria-pressed={rotating}
            onClick={() => { const next = !rotating; setRotating(next); if (stageRef.current) stageRef.current.controls.autoRotate = next }}>
            {rotating ? 'Pause rotation' : 'Rotate'}
          </button>
          <button type="button" className="rounded-full border border-white/15 bg-page/80 px-3 py-2 text-xs text-white"
            onClick={() => { stageRef.current?.controls.reset(); if (stageRef.current) stageRef.current.controls.autoRotate = false; setRotating(false) }}>Reset view</button>
        </div>
      )}
      {entry && status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">Building the model…</div>
      )}
    </div>
  )
}
