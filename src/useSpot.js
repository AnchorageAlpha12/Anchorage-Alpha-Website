import { useEffect, useRef } from 'react'

/* soft light that follows the pointer (very subtle, desktop only) */
export function useSpot() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches)) return
    let tx = 50, ty = 30, x = 50, y = 30, raf = 0
    const loop = () => {
      x += (tx - x) * 0.07; y += (ty - y) * 0.07
      el.style.setProperty('--mx', x + '%'); el.style.setProperty('--my', y + '%')
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.05 ? requestAnimationFrame(loop) : 0
    }
    const mv = e => {
      const r = el.getBoundingClientRect()
      tx = ((e.clientX - r.left) / r.width) * 100; ty = ((e.clientY - r.top) / r.height) * 100
      if (!raf) raf = requestAnimationFrame(loop)
    }
    el.addEventListener('pointermove', mv)
    return () => { el.removeEventListener('pointermove', mv); cancelAnimationFrame(raf) }
  }, [])
  return ref
}
export default useSpot
