// Fade out the loading screen from src/loader/loader.html once the page has rendered.
// Keep it up for at least one run of the animation so a fast load doesn't flash it.
const MIN_MS = 900

export function hideLoader() {
  const el = document.getElementById('xz-loader')
  if (!el) return
  const wait = Math.max(0, MIN_MS - performance.now())
  setTimeout(() => requestAnimationFrame(() => {
    el.classList.add('is-done')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
    setTimeout(() => el.remove(), 800)
  }), wait)
}
