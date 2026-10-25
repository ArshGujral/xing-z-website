import { useEffect, useRef } from 'react'

const rand = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const STEP = 5

// Copper palette, sampled from polished wire photography.
const SHADOW = [60, 18, 9]
const DARK = [150, 56, 32]
const MID = [218, 112, 80]
const LIGHT = [250, 180, 145]
const SPEC = [255, 236, 224]

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * k)}, ${Math.round(c[1] * k)}, ${Math.round(c[2] * k)})`

// Colour across a round wire: t = -1 (bottom edge) … 1 (top edge), lit from above.
function shade(t) {
  const lam = clamp(1 - ((t - 0.3) / 1.3) ** 2, 0, 1)
  let c = lam < 0.5 ? mix(DARK, MID, lam * 2) : mix(MID, LIGHT, (lam - 0.5) * 2)
  c = mix(SHADOW, c, 0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - t * t)))
  c = mix(c, LIGHT, 0.3 * Math.exp(-(((t + 0.72) / 0.1) ** 2)))
  return mix(c, SPEC, 0.9 * Math.exp(-(((t - 0.42) / 0.13) ** 2)))
}

// A smooth path that wanders in from an edge, curving away from the copy in the middle.
function walk(w, h, start, heading, avoid) {
  const pts = []
  let { x, y } = start
  let a = heading
  let turn = rand(-0.02, 0.02)
  let entered = false

  for (let i = 0; i < 1400; i++) {
    pts.push({ x, y })
    turn = clamp(turn + rand(-0.006, 0.006), -0.03, 0.03)
    a += turn

    const dx = (x - avoid.x) / avoid.rx
    const dy = (y - avoid.y) / avoid.ry
    const e = dx * dx + dy * dy
    if (e < 1.7) {
      const out = Math.atan2(dy / avoid.ry, dx / avoid.rx)
      const diff = Math.atan2(Math.sin(out - a), Math.cos(out - a))
      a += diff * 0.09 * (1.7 - e)
    }

    x += Math.cos(a) * STEP
    y += Math.sin(a) * STEP
    const inside = x > 0 && x < w && y > 0 && y < h
    if (inside) entered = true
    if (entered && (x < -90 || x > w + 90 || y < -90 || y > h + 90)) break
  }
  return pts
}

function withNormals(pts) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { x: p.x, y: p.y, nx: -(b.y - a.y) / len, ny: (b.x - a.x) / len }
  })
}

// Flip normals so +normal points "up" on average, keeping highlights on the lit side.
function orientUp(pts) {
  const avg = pts.reduce((s, p) => s + p.ny, 0)
  if (avg > 0) for (const p of pts) { p.nx = -p.nx; p.ny = -p.ny }
  return pts
}

function buildCables(w, h) {
  const s = clamp(Math.min(w, h) / 800, 0.55, 1.4)
  const mobile = w < 768
  const avoid = mobile
    ? { x: w / 2, y: h * 0.45, rx: w * 0.62, ry: h * 0.3 }
    : { x: w / 2, y: h * 0.5, rx: w * 0.26, ry: h * 0.5 }

  const starts = []
  const edge = (n, fn) => { for (let i = 0; i < n; i++) starts.push(fn()) }
  edge(mobile ? 3 : 7, () => [{ x: -40, y: h * rand(0.05, 1) }, rand(-0.7, 0.7)])
  edge(mobile ? 3 : 7, () => [{ x: w + 40, y: h * rand(0.05, 1) }, Math.PI + rand(-0.7, 0.7)])
  edge(mobile ? 5 : 4, () => [{ x: w * rand(0, 1), y: h + 40 }, -Math.PI / 2 + rand(-0.9, 0.9)])
  edge(2, () => [{ x: w * (Math.random() < 0.5 ? rand(0, 0.2) : rand(0.8, 1)), y: -40 }, Math.PI / 2 + rand(-0.6, 0.6)])

  const cables = []
  starts.forEach(([start, heading], gi) => {
    const depth = gi % 3 === 0 ? 0 : gi % 3 === 1 ? 2 : 1
    const spine = withNormals(walk(w, h, start, heading, avoid))
    const count = 1 + Math.floor(Math.random() * 4)
    let off = 0
    for (let c = 0; c < count; c++) {
      const bundle = Math.random() < 0.35
      const r = (bundle ? rand(7, 14) : rand(2.2, 6)) * s * (0.75 + depth * 0.2)
      off += (c === 0 ? 0 : r) + rand(0.5, 3) * s
      const phase = rand(0, Math.PI * 2)
      const pts = orientUp(
        withNormals(
          spine.map((p, i) => {
            const k = off * (1 + 0.18 * Math.sin(i * 0.02 + phase))
            return { x: p.x + p.nx * k, y: p.y + p.ny * k }
          }),
        ),
      )
      off += r
      cables.push({ pts, r, bundle, depth, twist: rand(55, 110) * s, strands: Math.round(rand(16, 28)) })
    }
  })

  cables.sort((a, b) => a.depth - b.depth)
  return cables
}

function offsetPath(pts, k) {
  const path = new Path2D()
  pts.forEach((p, i) => (i ? path.lineTo : path.moveTo).call(path, p.x + p.nx * k, p.y + p.ny * k))
  return path
}

function drawSolid(ctx, { pts, r }, tint) {
  const bands = clamp(Math.round((2 * r) / 1.1), 4, 16)
  ctx.lineWidth = r * 2 + 1.5
  ctx.strokeStyle = 'rgba(10, 3, 1, 0.6)'
  ctx.stroke(offsetPath(pts, -r * 0.25))
  for (let b = 0; b < bands; b++) {
    const t = -1 + (2 * b + 1) / bands
    ctx.lineWidth = (2 * r) / bands + 0.9
    ctx.strokeStyle = rgb(shade(t), tint)
    ctx.stroke(offsetPath(pts, t * r))
  }
}

// Many fine strands twisted around the cable spine, back half first.
function drawBundle(ctx, cable, tint) {
  const { pts, r, twist, strands } = cable
  ctx.lineWidth = r * 1.9
  ctx.strokeStyle = 'rgb(72, 24, 12)'
  ctx.stroke(offsetPath(pts, 0))

  const sw = clamp((r * 2.6) / strands, 0.9, 2.2)
  const groups = { back: new Map(), front: new Map() }
  let s = 0
  const arc = pts.map((p, i) => (s += i ? Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0))

  for (let k = 0; k < strands; k++) {
    const phase = (k / strands) * Math.PI * 2 + rand(-0.1, 0.1)
    const rk = r * rand(0.7, 1)
    const at = (i) => {
      const th = (arc[i] / twist) * Math.PI * 2 + phase
      return { off: Math.sin(th) * rk, depth: Math.cos(th) }
    }
    let prev = at(0)
    for (let i = 1; i < pts.length; i++) {
      const cur = at(i)
      const t = (prev.off + cur.off) / (2 * r)
      const d = (prev.depth + cur.depth) / 2
      const key = `${Math.round(clamp(t, -1, 1) * 6)}|${Math.round(d * 2)}`
      const bucket = d < 0 ? groups.back : groups.front
      if (!bucket.has(key)) bucket.set(key, new Path2D())
      const path = bucket.get(key)
      const a = pts[i - 1]
      const b = pts[i]
      path.moveTo(a.x + a.nx * prev.off, a.y + a.ny * prev.off)
      path.lineTo(b.x + b.nx * cur.off, b.y + b.ny * cur.off)
      prev = cur
    }
  }

  for (const bucket of [groups.back, groups.front]) {
    ctx.strokeStyle = 'rgba(40, 12, 5, 0.5)'
    ctx.lineWidth = sw + 0.6
    for (const path of bucket.values()) ctx.stroke(path)
    for (const [key, path] of bucket) {
      const [tq, dq] = key.split('|').map(Number)
      const lit = 0.7 + 0.3 * (dq + 2) / 4
      ctx.strokeStyle = rgb(shade(tq / 6), tint * lit)
      ctx.lineWidth = sw
      ctx.stroke(path)
      if (dq >= 1) {
        ctx.strokeStyle = rgb(mix(LIGHT, SPEC, 0.5), tint * (0.65 + 0.25 * (tq / 6)))
        ctx.lineWidth = sw * 0.4
        ctx.stroke(path)
      }
    }
  }
}

function drawCables(ctx, cables) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const cable of cables) {
    const tint = [0.5, 0.82, 1][cable.depth]
    ctx.filter = ['blur(2.2px)', 'blur(0.6px)', 'none'][cable.depth]
    if (cable.bundle) drawBundle(ctx, cable, tint)
    else drawSolid(ctx, cable, tint)
  }
  ctx.filter = 'none'
}

function trackOf(cable) {
  const cum = [0]
  for (let i = 1; i < cable.pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(cable.pts[i].x - cable.pts[i - 1].x, cable.pts[i].y - cable.pts[i - 1].y))
  }
  return { cable, cum, length: cum[cum.length - 1] }
}

function pointAt(track, d) {
  const { cable, cum } = track
  const pts = cable.pts
  let i = Math.min(pts.length - 1, Math.max(1, Math.ceil(d / STEP)))
  while (i > 1 && cum[i - 1] > d) i--
  while (i < cum.length - 1 && cum[i] < d) i++
  const t = clamp((d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), 0, 1)
  const k = cable.r * 0.35
  const a = pts[i - 1]
  const b = pts[i]
  return { x: a.x + (b.x - a.x) * t + a.nx * k, y: a.y + (b.y - a.y) * t + a.ny * k }
}

// Nearby points on different foreground cables, where arcs can jump the gap.
function findGaps(cables, w, h) {
  const s = clamp(Math.min(w, h) / 800, 0.55, 1.4)
  const samples = []
  cables.forEach((c, ci) => {
    if (c.depth === 0) return
    for (let i = 0; i < c.pts.length; i += 6) {
      const p = c.pts[i]
      if (p.x > 0 && p.x < w && p.y > 0 && p.y < h) samples.push({ x: p.x + p.nx * c.r, y: p.y + p.ny * c.r, ci })
    }
  })
  const gaps = []
  for (let i = 0; i < samples.length && gaps.length < 600; i += 1 + Math.floor(Math.random() * 3)) {
    for (let j = i + 1; j < samples.length; j += 2) {
      const a = samples[i]
      const b = samples[j]
      if (a.ci === b.ci) continue
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d > 14 * s && d < 70 * s) { gaps.push([a, b]); break }
    }
  }
  return gaps
}

function jagged(x1, y1, x2, y2, displace) {
  if (displace < 1.5) return [[x1, y1], [x2, y2]]
  const mx = (x1 + x2) / 2 + rand(-displace, displace)
  const my = (y1 + y2) / 2 + rand(-displace, displace)
  return jagged(x1, y1, mx, my, displace / 2).concat(jagged(mx, my, x2, y2, displace / 2).slice(1))
}

function strokeBolt(ctx, points, width, alpha) {
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
  ctx.strokeStyle = `rgba(110, 190, 255, ${0.35 * alpha})`
  ctx.lineWidth = width * 4
  ctx.stroke()
  ctx.strokeStyle = `rgba(235, 248, 255, ${alpha})`
  ctx.lineWidth = width
  ctx.stroke()
}

function glow(ctx, x, y, r, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
  g.addColorStop(0.25, `rgba(150, 215, 255, ${alpha * 0.6})`)
  g.addColorStop(1, 'rgba(60, 140, 255, 0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

export default function CopperWires({ className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const wiresLayer = document.createElement('canvas')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0
    let h = 0
    let tracks = []
    let gaps = []
    let pulses = []
    let surges = []
    let sparks = []
    let arcs = []
    let nextPulse = 0
    let nextArc = 0
    let nextSurge = 0.6
    let raf = 0
    let last = performance.now()
    let visible = true

    const setup = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = wiresLayer.width = Math.round(w * dpr)
      canvas.height = wiresLayer.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const cables = buildCables(w, h)
      const wctx = wiresLayer.getContext('2d')
      wctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawCables(wctx, cables)
      tracks = cables.filter((c) => c.depth > 0).map(trackOf)
      gaps = findGaps(cables, w, h)
      pulses = []
      surges = []
      sparks = []
      arcs = []

      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(wiresLayer, 0, 0, w, h)
    }

    const pick = (list) => list[Math.floor(Math.random() * list.length)]

    const burst = (x, y, count) => {
      for (let i = 0; i < count; i++) {
        const angle = rand(0, Math.PI * 2)
        const speed = rand(40, 220)
        sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: rand(0.25, 0.6), age: 0 })
      }
    }

    const tracePath = (track, from, to) => {
      ctx.beginPath()
      for (let d = from, first = true; d <= to; d += 6, first = false) {
        const p = pointAt(track, d)
        if (first) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
    }

    const frame = (now) => {
      if (!visible) {
        raf = 0
        return
      }
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      if ((nextPulse -= dt) <= 0 && tracks.length && pulses.length < 18) {
        const track = pick(tracks)
        const reverse = Math.random() < 0.5
        pulses.push({ track, d: 0, reverse, speed: rand(520, 950), trail: rand(70, 140) })
        nextPulse = rand(0.1, 0.4)
      }
      if ((nextArc -= dt) <= 0 && gaps.length) {
        const [a, b] = pick(gaps)
        arcs.push({ a, b, life: rand(0.08, 0.22), age: 0, fresh: true })
        nextArc = rand(0.2, 0.8)
      }
      if ((nextSurge -= dt) <= 0 && tracks.length) {
        const track = pick(tracks)
        const span = rand(160, 420)
        const from = rand(0, Math.max(0, track.length - span))
        surges.push({ track, from, to: from + span, life: rand(0.18, 0.35), age: 0 })
        nextSurge = rand(0.9, 2.2)
      }

      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(wiresLayer, 0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      surges = surges.filter((sg) => {
        sg.age += dt
        if (sg.age >= sg.life) return false
        const alpha = (1 - sg.age / sg.life) * (Math.random() < 0.3 ? 0.4 : 1)
        tracePath(sg.track, sg.from, sg.to)
        ctx.strokeStyle = `rgba(90, 170, 255, ${0.25 * alpha})`
        ctx.lineWidth = sg.track.cable.r * 2 + 10
        ctx.stroke()
        ctx.strokeStyle = `rgba(220, 240, 255, ${0.8 * alpha})`
        ctx.lineWidth = 1.6
        ctx.stroke()
        return true
      })

      pulses = pulses.filter((p) => {
        p.d += p.speed * dt
        if (p.d >= p.track.length) return false

        const pos = (d) => (p.reverse ? p.track.length - d : d)
        const headD = pos(p.d)
        const tailD = pos(Math.max(0, p.d - p.trail))
        tracePath(p.track, Math.min(headD, tailD), Math.max(headD, tailD))
        const head = pointAt(p.track, headD)
        const tail = pointAt(p.track, tailD)
        const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y)
        g.addColorStop(0, 'rgba(255, 140, 60, 0)')
        g.addColorStop(0.6, 'rgba(255, 175, 110, 0.4)')
        g.addColorStop(1, 'rgba(210, 238, 255, 0.95)')
        ctx.strokeStyle = g
        ctx.lineWidth = 3
        ctx.stroke()

        if (head.x < -20 || head.x > w + 20 || head.y < -20 || head.y > h + 20) return true
        glow(ctx, head.x, head.y, rand(12, 22), 0.95)
        if (Math.random() < 0.4) {
          const a = rand(0, Math.PI * 2)
          const len = rand(8, 20)
          strokeBolt(ctx, jagged(head.x, head.y, head.x + Math.cos(a) * len, head.y + Math.sin(a) * len, 4), 0.8, 0.8)
        }
        if (Math.random() < 0.04) burst(head.x, head.y, 3 + Math.floor(Math.random() * 4))
        return true
      })

      arcs = arcs.filter((arc) => {
        arc.age += dt
        if (arc.age >= arc.life) return false
        const alpha = Math.random() < 0.2 ? 0.25 : 1 - arc.age / arc.life
        const dist = Math.hypot(arc.b.x - arc.a.x, arc.b.y - arc.a.y)
        strokeBolt(ctx, jagged(arc.a.x, arc.a.y, arc.b.x, arc.b.y, dist * 0.22), 1.1, alpha)
        glow(ctx, arc.a.x, arc.a.y, 16, alpha * 0.8)
        glow(ctx, arc.b.x, arc.b.y, 16, alpha * 0.8)
        if (arc.fresh) {
          burst(arc.b.x, arc.b.y, 5)
          arc.fresh = false
        }
        return true
      })

      sparks = sparks.filter((sp) => {
        sp.age += dt
        if (sp.age >= sp.life) return false
        sp.vy += 260 * dt
        sp.vx *= 0.96
        const px = sp.x
        const py = sp.y
        sp.x += sp.vx * dt
        sp.y += sp.vy * dt
        const fade = 1 - sp.age / sp.life
        ctx.strokeStyle = `rgba(255, ${190 + 60 * fade}, ${120 + 135 * fade}, ${fade})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(sp.x, sp.y)
        ctx.stroke()
        return true
      })

      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(frame)
    }

    setup()
    if (!reduceMotion) raf = requestAnimationFrame(frame)

    let resizeTimer = 0
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(setup, 150)
    })
    observer.observe(canvas)

    // Only animate while on screen.
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !raf && !reduceMotion) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    })
    visibility.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      observer.disconnect()
      visibility.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
