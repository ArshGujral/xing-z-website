import { useEffect, useRef } from 'react'

// A WebGL "neural noise" field: glowing filaments that fold and drift, brightening near the pointer.
// Each pixel runs a short loop of rotated sine layers; where the layers line up, a filament lights.

const VERTEX = `
attribute vec2 a_position;
varying vec2 vUv;
void main() {
  vUv = 0.5 * (a_position + 1.0);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`

const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform float u_time;
uniform float u_ratio;
uniform vec2 u_pointer;
uniform vec3 u_base;
uniform vec3 u_glow;
uniform float u_strength;
uniform float u_unit;

vec2 rotate(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, s, -s, c) * uv;
}

float filaments(vec2 uv, float t, float lift) {
  vec2 drift = vec2(0.0);
  vec2 sum = vec2(0.0);
  float scale = 8.0;
  for (int i = 0; i < 15; i++) {
    uv = rotate(uv, 1.0);
    drift = rotate(drift, 1.0);
    vec2 layer = uv * scale + float(i) + drift - t;
    drift += sin(layer) + 2.4 * lift;
    sum += (0.5 + 0.5 * cos(layer)) / scale;
    scale *= 1.2;
  }
  return sum.x + sum.y;
}

void main() {
  // Sized in screen pixels, so a tall section gets more filaments rather than stretched ones.
  vec2 uv = 0.5 * gl_FragCoord.xy / u_unit;

  vec2 toPointer = vUv - u_pointer;
  toPointer.x *= u_ratio;
  float lift = 0.5 * pow(1.0 - clamp(length(toPointer), 0.0, 1.0), 2.0);

  float n = filaments(uv, 0.001 * u_time, lift);
  n = 1.2 * pow(n, 3.0);
  n += pow(n, 10.0);
  n = max(0.0, n - 0.5);
  n *= 1.0 - 0.8 * length((vUv - 0.5) * vec2(1.0, 0.7));

  vec3 color = mix(u_base, u_glow, clamp(n * 0.8, 0.0, 1.0));
  float alpha = clamp(n * u_strength * 2.5, 0.0, 1.0);
  gl_FragColor = vec4(color * alpha, alpha);
}`

const hexToRgb = (hex) => {
  const v = parseInt(hex.replace('#', ''), 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

// `base` is the filaments' body colour, `glow` where they are brightest; `strength` scales their opacity.
export function NeuralNoise({ className = 'absolute inset-0 w-full h-full', base = '#229784', glow = '#a0d5cd', strength = 0.9 }) {
  const canvasRef = useRef(null)
  const colorsRef = useRef({ base, glow, strength })
  colorsRef.current = { base, glow, strength }

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
    if (!gl) return // No WebGL: the section's own background shows instead.

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    if (!vs || !fs) return
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const u = Object.fromEntries(
      ['u_time', 'u_ratio', 'u_pointer', 'u_base', 'u_glow', 'u_strength', 'u_unit'].map((n) => [n, gl.getUniformLocation(program, n)]),
    )

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
    let frame = 0
    let visible = true
    let start = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform1f(u.u_ratio, canvas.width / canvas.height)
      gl.uniform1f(u.u_unit, 760 * dpr)
    }

    const draw = (now) => {
      pointer.x += (pointer.tx - pointer.x) * 0.1
      pointer.y += (pointer.ty - pointer.y) * 0.1
      const { base: b, glow: g, strength: s } = colorsRef.current
      gl.uniform1f(u.u_time, reduced ? 4000 : now - start + 4000)
      gl.uniform2f(u.u_pointer, pointer.x, pointer.y)
      gl.uniform3fv(u.u_base, hexToRgb(b))
      gl.uniform3fv(u.u_glow, hexToRgb(g))
      gl.uniform1f(u.u_strength, s)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const loop = (now) => {
      draw(now)
      frame = visible && !reduced ? requestAnimationFrame(loop) : 0
    }

    // The pointer pulls the filaments towards it; coordinates are relative to the canvas.
    const onPointer = (e) => {
      const r = canvas.getBoundingClientRect()
      pointer.tx = (e.clientX - r.left) / r.width
      pointer.ty = 1 - (e.clientY - r.top) / r.height
    }

    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (!frame) draw(performance.now())
    })
    resizeObserver.observe(canvas)

    // Only animate while the section is on screen.
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !frame && !reduced) frame = requestAnimationFrame(loop)
    })
    visibility.observe(canvas)

    resize()
    frame = requestAnimationFrame(loop)
    window.addEventListener('pointermove', onPointer, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibility.disconnect()
      window.removeEventListener('pointermove', onPointer)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
