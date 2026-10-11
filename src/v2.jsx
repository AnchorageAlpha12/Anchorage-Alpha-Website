import React, { useEffect, useRef, useState } from 'react'

export const Split = ({ text, as: T = 'h2', className = '', seenRef }) => {
  const [ref, seen] = seenRef
  return (
    <T ref={ref} className={`${className} split-w ${seen ? 'in' : ''}`} aria-label={text}>
      {text.split(' ').map((w, i) => <span className="w" aria-hidden="true" key={i}><span style={{ '--i': i }}>{w}&nbsp;</span></span>)}
    </T>
  )
}

/* Depth gauge: steps down through six stops, one per approach point */
const STOPS = [0, 2000, 4000, 6000, 8000, 10000]
const posOf = i => 8 + i * (84 / 5)
export function DepthMeter() {
  const [step, setStep] = useState(0)
  const [on, setOn] = useState(false)
  const [shown, setShown] = useState(STOPS[0])
  const [geo, setGeo] = useState(null)
  const geoRef = useRef(null)
  const cur = useRef(STOPS[0])
  useEffect(() => {
    const el = document.getElementById('approach')
    if (!el) return
    let raf = 0
    const f = () => {
      raf = 0
      /* mobile: the meter is drawn inside the list (moves natively with the text);
         here we only pick the active point — the last one whose centre has passed the reading line.
         No React state changes, so nothing re-renders while scrolling. */
      if (window.innerWidth <= 900) {
        const items = el.querySelectorAll('.ap-item'), line = window.innerHeight * 0.55
        const host = el.querySelector('.ap-in'), hr = host ? host.getBoundingClientRect() : null
        let a = 0
        items.forEach((li, i) => {
          const q = li.getBoundingClientRect(), c = q.top + q.height / 2
          if (c <= line) a = i
          /* checkpoint positions, relative to the list container (written only when layout changes) */
          if (hr) {
            const v = Math.round(c - hr.top) + 'px', k = '--c' + i
            if (host.style.getPropertyValue(k) !== v) host.style.setProperty(k, v)
          }
        })
        const v = String(a)
        if (el.dataset.step !== v) el.dataset.step = v
        if (geoRef.current) { geoRef.current = null; setGeo(null) }
        setOn(false)
        return
      }
      const r = el.getBoundingClientRect(), vh = window.innerHeight
      const pin = el.querySelector('.ap-pin'), track = el.querySelector('.ap-track')
      const pinned = pin && getComputedStyle(pin).position === 'sticky'
      const pr = pin ? pin.getBoundingClientRect() : r
      let vis = pr.top < vh * 0.12 && pr.bottom > vh * 0.7
      let p = 0
      if (pinned && track) {
        const cs = getComputedStyle(track), t = parseFloat(cs.paddingTop) || 0, b = parseFloat(cs.paddingBottom) || 0
        const tr = track.getBoundingClientRect()
        p = Math.min(0.999, Math.max(0, (-(tr.top + t)) / Math.max(1, tr.height - t - b - vh)))
      }
      let s = Math.min(5, Math.floor(p * 6))
      const pv = pinned ? Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh))) : 0
      el.style.setProperty('--ap', pv.toFixed(4))
      /* align the gauge to the six points: first tick on the centre of point 1, last on the centre of point 6 */
      const items = el.querySelectorAll('.ap-item')
      if (items.length === STOPS.length && (pinned || window.innerWidth <= 900)) {
        const c = Array.from(items, li => { const q = li.getBoundingClientRect(); return q.top + q.height / 2 })
        if (!pinned) {
          /* mobile: the list scrolls, so the gauge travels with it and the point nearest the reading line is active */
          const line = vh * 0.5
          let best = 0
          c.forEach((y, i) => { if (Math.abs(y - line) < Math.abs(c[best] - line)) best = i })
          s = best
          vis = c[0] < vh * 0.85 && c[c.length - 1] > vh * 0.15
        }
        const top = c[0], h = Math.max(1, c[c.length - 1] - c[0])
        const g = { top: Math.round(top), h: Math.round(h), pos: c.map(y => ((y - top) / h) * 100) }
        const o = geoRef.current
        if (!o || Math.abs(o.top - g.top) > 0.5 || Math.abs(o.h - g.h) > 0.5) { geoRef.current = g; setGeo(g) }
      } else if (geoRef.current) { geoRef.current = null; setGeo(null) }
      el.dataset.step = s
      setOn(vis); setStep(s)
    }
    const h = () => { if (!raf) raf = requestAnimationFrame(f) }
    window.addEventListener('scroll', h, { passive: true }); window.addEventListener('resize', h); window.addEventListener('load', h); document.fonts && document.fonts.ready.then(h); f()
    return () => { window.removeEventListener('scroll', h); window.removeEventListener('resize', h); window.removeEventListener('load', h) }
  }, [])
  useEffect(() => {
    let raf = 0
    const to = STOPS[step]
    const tick = () => {
      cur.current += (to - cur.current) * 0.12
      if (Math.abs(to - cur.current) < 6) cur.current = to
      setShown(Math.round(cur.current / 10) * 10)
      if (cur.current !== to) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [step])
  const fmt = n => n.toLocaleString('en-US')
  const P = i => geo ? geo.pos[i] : posOf(i)
  return (
    <div className={`depth ${on ? 'on' : ''} ${geo ? 'geo' : ''}`} aria-hidden="true" style={geo ? { top: geo.top + 'px', height: geo.h + 'px' } : undefined}>
      <div className="d-track">
        {STOPS.map((m, i) => <span key={m} className={`d-tick ${i === step ? 'act' : ''} ${i < step ? 'past' : ''}`} style={{ top: P(i) + '%' }}><em>{fmt(m)} m</em></span>)}
        <i className="d-fill" style={{ height: P(step) + '%' }} />
        <b className="d-mk" style={{ top: P(step) + '%' }}><span>{fmt(shown)} m</span></b>
      </div>
    </div>
  )
}
