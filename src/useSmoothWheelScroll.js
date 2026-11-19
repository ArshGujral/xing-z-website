import { useEffect } from 'react'

function usesNativeScroll(event) {
  return event.composedPath().some((node) => {
    if (!(node instanceof Element) || node === document.body || node === document.documentElement) return false
    if (node.matches('input, select, textarea, [contenteditable]')) return true
    return node.scrollHeight > node.clientHeight && /^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)
  })
}

// Soften coarse vertical wheel steps on the homepage. Fine deltas and nested scrollers stay native.
export function useSmoothWheelScroll() {
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = window.matchMedia('(any-pointer: fine)')
    let frame = 0
    let previousTime = 0
    let target = 0
    let position = 0

    const stop = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
    }

    const tick = (time) => {
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 16
      previousTime = time
      position += (target - position) * (1 - Math.exp(-elapsed / 58))
      if (Math.abs(target - position) < 0.8) position = target
      window.scrollTo({ top: position, behavior: 'instant' })
      if (position === target) stop()
      else frame = requestAnimationFrame(tick)
    }

    const onWheel = (event) => {
      const { deltaMode, deltaY } = event
      const magnitude = Math.abs(deltaY)
      const coarse = deltaMode !== WheelEvent.DOM_DELTA_PIXEL || (magnitude >= 60 && magnitude % 10 === 0)
      if (!coarse || !deltaY || event.deltaX || event.ctrlKey || event.metaKey || event.shiftKey
        || !event.cancelable || event.defaultPrevented || usesNativeScroll(event)) {
        stop()
        return
      }

      const root = document.scrollingElement
      const current = window.scrollY
      const unit = deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : deltaMode === WheelEvent.DOM_DELTA_PAGE ? root.clientHeight : 1
      const continuing = frame && Math.sign(target - current) === Math.sign(deltaY)
      const next = Math.min(root.scrollHeight - root.clientHeight, Math.max(0, (continuing ? target : current) + deltaY * unit))
      if (!frame && Math.abs(next - current) < 0.8) return

      event.preventDefault()
      target = next
      if (!frame || !continuing) position = current
      if (!frame) frame = requestAnimationFrame(tick)
    }

    const syncWheel = () => {
      window.removeEventListener('wheel', onWheel)
      stop()
      if (!motion.matches && pointer.matches) window.addEventListener('wheel', onWheel, { passive: false })
    }

    syncWheel()
    motion.addEventListener('change', syncWheel)
    pointer.addEventListener('change', syncWheel)
    const interruptions = ['pointerdown', 'touchstart', 'keydown', 'popstate', 'hashchange']
    for (const event of interruptions) window.addEventListener(event, stop, { passive: true })
    return () => {
      stop()
      window.removeEventListener('wheel', onWheel)
      motion.removeEventListener('change', syncWheel)
      pointer.removeEventListener('change', syncWheel)
      for (const event of interruptions) window.removeEventListener(event, stop)
    }
  }, [])
}
