import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, memo } from 'react'
import Lenis from 'lenis'
import C0 from './content.json'
import { Split, DepthMeter } from './v2.jsx'
import { HeroVoices, Glow } from './v3.jsx'
import { useSpot } from './useSpot.js'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')
const U = p => BASE + p
const withBase = v => {
  if (typeof v === 'string') return v.charCodeAt(0) === 47 ? BASE + v : v
  if (Array.isArray(v)) return v.map(withBase)
  if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = withBase(v[k]); return o }
  return v
}
const C = withBase(C0)

const NAV = [['top','Home'],['about','About us'],['legacy','Legacy'],['team','Team'],['approach','Approach'],['portfolio','Investments'],['investors','Investors'],['contact','Contact']]
const html = (h) => ({ dangerouslySetInnerHTML: { __html: h } })
let lenis = null

const pauseScroll = (pause) => {
  if (lenis) {
    if (pause) lenis.stop()
    else lenis.start()
  }
}

/* the header is 68px plus the device safe-area inset (notch/home indicator), so measure the
   real bar instead of a hardcoded number - otherwise anchors land under it on those devices */
const navH = () => {
  const n = document.querySelector('.nav')
  const h = n && n.getBoundingClientRect().height
  return h > 0 ? h : 68
}
/* where each nav item should land: the section's key content, centred in the space below the fixed header
   (top-aligned under the header when it is taller than the screen) */
const FOCUS = {
  about: ['#about .label', '.schemes-sec .note'],
  legacy: ['#legacy .panel-g', '#legacy .panel-g'],
  investors: ['#investors .label', '#investors .panel']
}
const targetOf = (id) => {
  if (id === 'top') return 0
  const el = document.getElementById(id)
  if (!el) return 0
  const sy = window.scrollY, NAV_H = navH(), avail = window.innerHeight - NAV_H
  if (id === 'approach') {
    const track = el.querySelector('.ap-track'), pin = el.querySelector('.ap-pin')
    if (pin && track && getComputedStyle(pin).position === 'sticky') return el.getBoundingClientRect().top + sy + (parseFloat(getComputedStyle(track).paddingTop) || 0)
    const head = el.querySelector('.ap-head')
    if (head) return head.getBoundingClientRect().top + sy - NAV_H - 28
  }
  const f = FOCUS[id]
  const a = f && document.querySelector(f[0]), b = f && document.querySelector(f[1])
  if (a && b) {
    const top = a.getBoundingClientRect().top + sy, bottom = b.getBoundingClientRect().bottom + sy
    const h = bottom - top
    if (h <= avail - 24) return Math.max(0, top - NAV_H - (avail - h) / 2)
    return Math.max(0, top - NAV_H - 20)
  }
  return Math.max(0, el.getBoundingClientRect().top + sy - NAV_H)
}

const goTo = (id) => {
  const to = targetOf(id)
  if (lenis) {
    lenis.scrollTo(to, {
      duration: window.paused ? 0 : 1.6,
      easing: t => 1 - Math.pow(1 - t, 4)
    })
  } else {
    window.scrollTo({ top: to, behavior: window.paused ? 'auto' : 'smooth' })
  }
}

/* Shared IntersectionObserver pools for butter-smooth reveals */
const seenCallbacks = new WeakMap()
let sharedDefaultObserver = null
let sharedZeroObserver = null

function getSharedObserver(margin) {
  if (typeof IntersectionObserver === 'undefined') return null
  if (margin === '0px') {
    if (!sharedZeroObserver) {
      sharedZeroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const cb = seenCallbacks.get(entry.target)
            if (cb) {
              cb()
              seenCallbacks.delete(entry.target)
            }
            sharedZeroObserver.unobserve(entry.target)
          }
        })
      }, { rootMargin: '0px' })
    }
    return sharedZeroObserver
  }

  if (!sharedDefaultObserver) {
    sharedDefaultObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const cb = seenCallbacks.get(entry.target)
          if (cb) {
            cb()
            seenCallbacks.delete(entry.target)
          }
          sharedDefaultObserver.unobserve(entry.target)
        }
      })
    }, { rootMargin: '0px 0px -12% 0px' })
  }
  return sharedDefaultObserver
}

function useSeen(margin = '0px 0px -12% 0px') {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = getSharedObserver(margin)
    if (!obs) {
      setSeen(true)
      return
    }
    seenCallbacks.set(el, () => setSeen(true))
    obs.observe(el)
    return () => {
      seenCallbacks.delete(el)
      obs.unobserve(el)
    }
  }, [margin])

  return [ref, seen]
}

const Rv = ({ as: T = 'div', d = 0, className = '', children, style, ...p }) => {
  const [ref, seen] = useSeen()
  return <T ref={ref} className={`rv ${seen ? 'in' : ''} ${className}`} style={{ '--d': d + 'ms', ...style }} {...p}>{children}</T>
}

/* keeps Tab inside an open drawer or dialog */
function useTrap(on, ref) {
  useEffect(() => {
    if (!on) return
    const el = ref.current
    if (!el) return
    const sel = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
    const k = e => {
      if (e.key !== 'Tab') return
      const f = el.querySelectorAll(sel)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [on, ref])
}

const Unveil = ({ src, alt, className = '' }) => {
  const [ref, seen] = useSeen()
  return <figure ref={ref} className={`unveil ${seen ? 'in' : ''} ${className}`}><img src={src} alt={alt} loading="lazy" /></figure>
}

const Label = ({ children }) => {
  const [ref, seen] = useSeen()
  return <div ref={ref} className={`label ${seen ? 'in' : ''}`}><span>{children}</span><i /></div>
}

const SecLabel = ({ children }) => <div className="slabel"><span>{children}</span><i aria-hidden="true" /></div>

function Count({ html: h }) {
  const m = h.match(/^(\D*)(\d+)(.*)$/s)
  const [ref, seen] = useSeen('0px')
  const numSpanRef = useRef(null)

  useEffect(() => {
    if (!seen || !m) return
    const to = +m[2]
    if (window.paused) {
      if (numSpanRef.current) numSpanRef.current.textContent = `${m[1]}${to}`
      return
    }
    const t0 = performance.now()
    let r
    const f = (t) => {
      const k = Math.min(1, (t - t0) / 1800)
      const current = Math.round(to * (1 - Math.pow(1 - k, 4)))
      if (numSpanRef.current) {
        numSpanRef.current.textContent = `${m[1]}${current}`
      }
      if (k < 1) {
        r = requestAnimationFrame(f)
      }
    }
    r = requestAnimationFrame(f)
    return () => cancelAnimationFrame(r)
  }, [seen])

  if (!m) return <b {...html(h)} />
  return (
    <b ref={ref}>
      <span ref={numSpanRef} aria-hidden="true">{m[1]}0</span>
      <span className="vh">{m[1]}{m[2]}</span>
      <span className="sfx" {...html(m[3])} />
    </b>
  )
}

/* Seamless looping video: two stacked players cross-fade over the last 1.4s of each pass.
   Pictures only (sound = false) simply play while on screen.
   The hero (sound = true) also carries its own audio:
   - it starts muted (required for autoplay) and becomes audible on the visitor's first tap/click/key;
   - the level is read from the scroll position on every animation frame: full on the hero,
     easing down as About rises, silent before About arrives; then the picture pauses;
   - volume is set directly on the <video> elements; where the browser ignores that (iOS),
     the same level is applied through a Web Audio gain node. */
function LoopVideo({ src = '/video/hero.mp4', poster = '/video/poster.jpg', sound = false }) {
  const containerRef = useRef(null)
  const A = useRef(null)
  const B = useRef(null)

  useEffect(() => {
    const a = A.current, b = B.current, container = containerRef.current
    if (!a || !b || !container) return
    ;[a, b].forEach(v => { v.muted = true; v.defaultMuted = true; v.setAttribute('muted', ''); v.playsInline = true })
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const F = 1.4
    let cur = a, nxt = b, busy = false, inView = true, alive = true, swapT = 0
    const playSafe = v => { try { const p = v.play(); if (p && p.catch) p.catch(() => {}) } catch (e) {} }

    /* ---------- sound (hero only) ---------- */
    let unlocked = false, ctx = null, useGain = false
    const gainOf = new Map()
    const w = new Map([[a, 1], [b, 0]])          /* loop cross-fade weights */
    let level = 0                                  /* smoothed output level 0..1 */
    const heroH = () => window.innerHeight || 1
    const scrollY = () => window.scrollY || document.documentElement.scrollTop || 0
    const covered = () => sound && scrollY() >= heroH() * 0.98
    const target = () => {
      if (!sound || !unlocked || document.hidden || window.paused || !inView) return 0
      const k = Math.min(1, Math.max(0, 1 - scrollY() / (heroH() * 0.8)))
      return k * k * (3 - 2 * k)
    }
    const out = (v, x) => {
      x = Math.max(0, Math.min(1, x))
      if (useGain) { const g = gainOf.get(v); if (g) g.gain.value = x }
      else { try { v.volume = x } catch (e) {} }
    }
    let loop = 0, lastT = 0
    const tick = now => {
      loop = 0
      const dt = Math.min(0.1, lastT ? (now - lastT) / 1000 : 0.016); lastT = now
      const t = target()
      /* glide: quicker on the way down, gentle on the way up */
      const rate = t < level ? 5 : 1.6
      level += (t - level) * (1 - Math.exp(-rate * dt))
      if (Math.abs(t - level) < 0.002) level = t
      out(a, level * w.get(a)); out(b, level * w.get(b))
      if (alive && (level > 0 || t > 0 || busy)) loop = requestAnimationFrame(tick)
      else lastT = 0
    }
    const kick = () => { if (sound && unlocked && !loop && alive) loop = requestAnimationFrame(tick) }

    const unlock = () => {
      if (unlocked || !sound) return
      unlocked = true
      /* can this browser change element volume? iOS reports 1 regardless */
      let canVol = true
      try { a.volume = 0.5; canVol = Math.abs(a.volume - 0.5) < 0.01; a.volume = 0 } catch (e) { canVol = false }
      if (!canVol) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext
          ctx = new AC()
          ;[a, b].forEach(v => { const g = ctx.createGain(); g.gain.value = 0; ctx.createMediaElementSource(v).connect(g); g.connect(ctx.destination); gainOf.set(v, g) })
          ctx.resume && ctx.resume().catch(() => {})
          useGain = true
        } catch (e) { useGain = false }
      }
      out(a, 0); out(b, 0)
      a.muted = false; b.muted = false
      if (!covered() && inView && !document.hidden && !window.paused && cur.paused) playSafe(cur)
      evs.forEach(n => window.removeEventListener(n, unlock, true))
      kick()
    }
    const evs = ['pointerdown', 'touchend', 'keydown', 'click']
    if (sound) evs.forEach(n => window.addEventListener(n, unlock, { capture: true, passive: true }))

    /* ---------- seamless loop ---------- */
    const animW = (from, to) => {
      const t0 = performance.now()
      const step = now => {
        if (!alive) return
        const k = Math.min(1, (now - t0) / (F * 1000)), e = k * k * (3 - 2 * k)
        w.set(to, e); w.set(from, 1 - e)
        if (k < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    const swap = () => {
      if (busy || !running()) return
      busy = true
      const old = cur
      playSafe(nxt)
      if (sound) { animW(old, nxt); kick() }
      nxt.style.zIndex = '2'; old.style.zIndex = '1'
      nxt.classList.add('on')
      swapT = setTimeout(() => {
        if (!alive) return
        try { old.pause(); old.classList.remove('on'); old.currentTime = 0 } catch (e) {}
        cur = nxt; nxt = old; busy = false
      }, F * 1000 + 80)
    }
    const running = () => inView && !covered() && !document.hidden && !window.paused
    const near = v => v === cur && !busy && v.duration && v.currentTime >= v.duration - F
    const onTime = e => { if (running() && near(e.target)) swap() }
    const onEnded = e => { if (e.target === cur) { try { e.target.currentTime = 0 } catch (err) {} playSafe(e.target) } }
    ;[a, b].forEach(v => { v.addEventListener('timeupdate', onTime, { passive: true }); v.addEventListener('ended', onEnded, { passive: true }) })
    const safety = setInterval(() => { if (running() && near(cur)) swap() }, 250)

    /* ---------- play / pause ---------- */
    let pauseT = 0
    const sync = () => {
      kick()
      if (running()) { clearTimeout(pauseT); pauseT = 0; if (cur.paused) playSafe(cur) }
      else if (!pauseT) {
        /* let the sound settle first, then stop the picture */
        pauseT = setTimeout(() => { pauseT = 0; if (!running()) { try { a.pause(); b.pause() } catch (e) {} } }, sound && unlocked ? 700 : 0)
      }
    }
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync() }, { threshold: 0.02 })
    io.observe(container)
    let sRaf = 0
    const onScroll = () => { if (!sRaf) sRaf = requestAnimationFrame(() => { sRaf = 0; sync() }) }
    if (sound) window.addEventListener('scroll', onScroll, { passive: true })
    const onVis = () => sync()
    document.addEventListener('visibilitychange', onVis)

    if (running()) playSafe(a)

    return () => {
      alive = false
      clearInterval(safety); clearTimeout(swapT); clearTimeout(pauseT)
      cancelAnimationFrame(loop); cancelAnimationFrame(sRaf)
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVis)
      evs.forEach(n => window.removeEventListener(n, unlock, true))
      ;[a, b].forEach(v => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('ended', onEnded); try { v.pause() } catch (e) {} })
      if (ctx) ctx.close().catch(() => {})
    }
  }, [sound])

  const p = { playsInline: true, poster: U(poster), 'aria-hidden': true, disablePictureInPicture: true }
  return (
    <div ref={containerRef} className="vid">
      <video ref={A} className="on" muted preload="auto" {...p}><source src={U(src)} type="video/mp4" /></video>
      <video ref={B} muted preload={sound ? 'auto' : 'metadata'} {...p}><source src={U(src)} type="video/mp4" /></video>
    </div>
  )
}

/* Background video that only runs while on screen and degrades to the poster if it fails */
function BgVideo({ src, poster }) {
  const ref = useRef(null)
  const [live, setLive] = useState(true)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause()
      return
    }
    const playSafe = () => {
      try {
        const r = v.play()
        if (r && r.catch) r.catch(() => {})
      } catch (e) {}
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !document.hidden && !window.paused) {
        playSafe()
      } else {
        try { v.pause() } catch (e) {}
      }
    }, { threshold: 0.05 })
    io.observe(v)

    const onVis = () => {
      if (document.hidden || window.paused) {
        try { v.pause() } catch (e) {}
      } else {
        playSafe()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  if (!live) return null
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      disablePictureInPicture
      onError={() => setLive(false)}
    />
  )
}

const Nav = memo(function Nav({ active, solid }) {
  const [open, setOpen] = useState(false)
  const refs = useRef({})
  const [ind, setInd] = useState({ x: 0, w: 0 })

  useLayoutEffect(() => {
    const move = () => {
      const el = refs.current[active]
      if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth })
    }
    move()
    window.addEventListener('resize', move, { passive: true })
    document.fonts?.ready.then(move)
    return () => window.removeEventListener('resize', move)
  }, [active])

  const go = (id) => (e) => {
    e.preventDefault()
    setOpen(false)
    setTimeout(() => goTo(id), open ? 350 : 0)
  }

  return (
    <header className={`nav ${solid ? 'solid' : ''} ${open ? 'open' : ''}`}>
      <a href="#top" className="brand" onClick={go('top')} aria-label="Anchorage Alpha, back to top"><i /></a>
      <nav className="links" aria-label="Sections">
        {NAV.map(([id, l]) => (
          <a
            key={id}
            href={'#' + id}
            ref={el => refs.current[id] = el}
            className={active === id ? 'on' : ''}
            aria-current={active === id ? 'true' : undefined}
            onClick={go(id)}
          >
            {l}
          </a>
        ))}
        <span className="ind" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} />
      </nav>
      <button className="burger" aria-expanded={open} onClick={() => setOpen(!open)}><span>{open ? 'Close' : 'Menu'}</span></button>
      <div className="sheet" aria-hidden={!open}>{NAV.map(([id, l]) => <a key={id} href={'#' + id} onClick={go(id)} tabIndex={open ? 0 : -1}>{l}</a>)}</div>
      <b className="prog" />
    </header>
  )
})

const Hero = memo(() => (
  <section id="top" className="hero">
    <LoopVideo /><div className="scrim" />
    <div className="hero-in">
      <img className="hero-logo a11y-keep" src={U('/img/logo-white.png')} alt="Anchorage Alpha" />
      <p className="hero-line">Anchored in Insight.<br/>Steered by Purpose.</p>
    </div>
    <HeroVoices items={C.feat} />
    <button className="cue" onClick={() => goTo('about')} aria-label="Scroll to About us"><i /></button>
  </section>
))

const About = memo(() => {
  const a = C.about, k = useSeen(), sp = useSpot()
  return (
    <section id="about" ref={sp} className="about2 spot">
      <div className="ab2-bg" aria-hidden="true"><Glow /></div>
      <div className="ab2-blur" aria-hidden="true" />
      <div className="ab2-veil" aria-hidden="true" />
      <div className="wrap ab2-in">
        <Label>About us</Label>
        <div className="ab2-grid">
          <Split text={a.h} className="h2 ab2-h" seenRef={k} />
          <div className="ab2-copy">{a.p.map((p, i) => <Rv key={i} as="p" d={450 + 160 * i} className="ab2-p" {...html(p)} />)}</div>
        </div>
      </div>
    </section>
  )
})

const Schemes = memo(() => {
  const a = C.about, aum = a.schemes[3], sp = useSpot()
  const [usd, inr] = aum.n.replace('*', '').split('\u20B9')
  return (
    <section id="schemes" ref={sp} className="sec bgsec schemes-sec spot">
      <Glow />
      <div className="wrap">
        <SecLabel>Our schemes</SecLabel>
        <div className="pl-scene">
          <div className="pl-cards">{a.schemes.slice(0, 3).map((s, i) => (
            <Rv key={i} d={i * 120} className="pl-card" tabIndex={0}>
              <span className="k">{s.l}</span>
              <span className="big">{s.n}</span>
              <span className="sdiv" aria-hidden="true" />
              <span className="sfoot"><span>Inception</span><b>{s.d.replace(/^Inception\s*/, '')}</b></span>
            </Rv>))}
          </div>
          <Rv d={360} className="plinth">
            <span className="pl-k"><span>{aum.l}</span><em>{aum.d}</em></span>
            <i aria-hidden="true" />
            <span className="pl-val">{usd.trim()}<sup>*</sup></span>
            <i aria-hidden="true" />
            <span className="pl-inr">{'\u20B9'}{inr}</span>
          </Rv>
        </div>
        <p className="note" {...html(a.note)} />
      </div>
    </section>
  )
})

const Legacy = memo(() => {
  const l = C.legacy, k = useSeen()
  return (
    <section id="legacy" className="sec bgsec legacy-sec lg2">
      <div className="lg-bg" aria-hidden="true" />
      <div className="wrap">
        <div className="panel-g">
          <Label>Legacy</Label>
          <Split text={l.h} className="h2" seenRef={k} />
          <Rv as="p" d={500} className="sub-h">{l.sub}</Rv>
          {l.p.slice(0, 2).map((p, i) => <Rv key={i} as="p" d={600 + i * 120} className="lede blurin">{p}</Rv>)}
        </div>
        <div className="stats">{l.stats.map((s, i) => <div key={i} className="stat"><Count html={s.b} /><span>{s.s}</span>{s.e && <em>{s.e}</em>}</div>)}</div>
        <p className="note">* Assets under management of the sponsor group and the Kothari family office, including listed and unlisted holdings.</p>
        <Founder />
      </div>
    </section>
  )
})

const Founder = () => {
  const f = C.founder
  return (
    <div id="founder" className="fd2">
      <Unveil src={f.img} alt={f.name} className="fd2-photo" />
      <div className="fd2-text">
        <Label>{f.role}</Label>
        <Rv as="h3" className="fd2-name">{f.name}</Rv>
        {f.p.map((p, i) => <Rv key={i} as="p" d={120 + i * 120} className="fd2-p">{p}</Rv>)}
        <Rv d={500} className="fd-cred">{f.chips.map(c => <span key={c}>{c}</span>)}</Rv>
      </div>
    </div>
  )
}

function Team() {
  const [p, setP] = useState(null)
  const panel = useRef()
  useTrap(!!p, panel)

  useEffect(() => {
    pauseScroll(!!p)
    const k = e => e.key === 'Escape' && setP(null)
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener('keydown', k)
      pauseScroll(false)
    }
  }, [p])

  return (
    <section id="team" className="sec team-sec">
      <div className="wrap">
        <Label>Team</Label>
        <div className="head2">
          <Rv as="h2" className="h2">Our People</Rv>
          <Rv as="p" d={120} className="lede">Led by Rohit Kothari, Founder &amp; Executive Chairman, our specialists cover every major sector.</Rv>
        </div>
        <div className="grid">{C.team.members.map((m, i) => (
          <Rv key={m.id} d={(i % 5) * 70}><button className="card" onClick={() => setP(m)}>
            <span className="ph"><img src={m.img} alt="" loading="lazy" /></span>
            <span className="nm">{m.name}</span><span className="rl" {...html(m.role)} />
          </button></Rv>))}</div>
        <p className="note">{C.team.note}</p>
      </div>
      <div className={`drawer tm ${p ? 'open' : ''}`} aria-hidden={!p}>
        <div className="veil" onClick={() => setP(null)} />
        <aside role="dialog" aria-label={p?.name} ref={panel} data-lenis-prevent>
          {p && <><button className="x" onClick={() => setP(null)}>Close</button>
            <figure className="tm-ph"><img src={p.img} alt={p.name} /></figure><div className="tm-id"><h3 className="h3">{p.name}</h3><p className="role" {...html(p.role)} /></div>
            <dl>{p.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></>}
        </aside>
      </div>
    </section>
  )
}

const Approach = memo(() => (
  <section id="approach" className="dark approach-sec" data-step="0">
    <div className="ap-bgtrack" aria-hidden="true">
      <div className="ap-v ap-v-top"><LoopVideo src="/video/approach.mp4" poster="/video/approach-poster.jpg" /></div>
      <div className="ap-v ap-v-bot"><LoopVideo src="/video/approach.mp4" poster="/video/approach-poster.jpg" /></div>
    </div>
    <div className="ap-track">
      <div className="ap-pin">
        <div className="wrap ap-in">
          <div className="ap-head"><Label>Our approach</Label><Rv as="h2" className="h2">A Deeper Perspective</Rv></div>
          <div className="ap-mg" aria-hidden="true"><i className="mg-track" /><i className="mg-fill" />{C.approach.map((_, i) => <i key={i} className={`mg-tick t${i}`} />)}<b className="mg-dot" /></div>
          <ol className="ap-list">{C.approach.map((a, i) => (
            <Rv as="li" key={i} d={i * 90} className="ap-item"><div><h3>{a.h}</h3><p>{a.p}</p></div></Rv>))}</ol>
        </div>
      </div>
    </div>
  </section>
))

function Portfolio() {
  const arrow = <svg className="inv-arrow" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 10.5 10.5 3.5M5 3.5h5.5V9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  return (
    <section id="portfolio" className="sec">
      <div className="wrap">
        <SecLabel>A selection of our investments</SecLabel>
        <Rv as="h2" className="h2">Key Investments</Rv>
        <ul className="inv-grid">{C.grid.map((g, i) => {
          const inner = <>
            <span className="inv-logo">{g.logo ? <img src={g.logo} alt="" loading="lazy" /> : <span className="inv-logo-tx">{g.name}</span>}</span>
            <span className="inv-name">{g.name}</span>
            <span className="inv-d">{g.d}</span>
            {g.url && arrow}
          </>
          return (
            <Rv as="li" key={g.name} d={i * 40} className="inv-item">
              {g.url
                ? <a className="inv-card" href={g.url} target="_blank" rel="noopener noreferrer" aria-label={`${g.name} website (opens in a new tab)`}>{inner}</a>
                : <div className="inv-card is-static">{inner}</div>}
            </Rv>
          )
        })}</ul>
      </div>
    </section>
  )
}

function Investors() {
  const T = ['FAQs', 'Policies', 'Definitions']
  const [t, setT] = useState(0)
  const [qs, setQs] = useState(() => new Set())
  const refs = useRef([])
  const [ind, setInd] = useState({ x: 0, w: 0 })

  useLayoutEffect(() => {
    const e = refs.current[t]
    if (e) setInd({ x: e.offsetLeft, w: e.offsetWidth })
  }, [t])
  /* desktop: if the newly opened tab runs past the bottom of the screen, bring the whole block into view */
  const firstTab = useRef(true)
  useEffect(() => {
    if (firstTab.current) { firstTab.current = false; return }
    if (window.innerWidth < 861) return
    const panel = document.querySelector('#investors .panel')
    if (panel && panel.getBoundingClientRect().bottom > window.innerHeight - 8) goTo('investors')
  }, [t])

  const toggle = (i) => setQs(s => {
    const n = new Set(s)
    n.has(i) ? n.delete(i) : n.add(i)
    return n
  })

  const onKey = (e) => {
    const n = T.length
    let j = t
    if (e.key === 'ArrowRight') j = (t + 1) % n
    else if (e.key === 'ArrowLeft') j = (t - 1 + n) % n
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = n - 1
    else return
    e.preventDefault()
    setT(j)
    refs.current[j]?.focus()
  }

  return (
    <section id="investors" className="sec tint">
      <div className="wrap inv2">
        <Label>Investors</Label>
        <Rv as="h2" className="h2">Investor information</Rv>
        <div className="tabs" role="tablist" aria-label="Investor information" onKeyDown={onKey}>
          {T.map((x, i) => (
            <button
              key={x}
              id={`tab-${i}`}
              role="tab"
              aria-selected={t === i}
              aria-controls={`panel-${i}`}
              tabIndex={t === i ? 0 : -1}
              ref={el => refs.current[i] = el}
              onClick={() => setT(i)}
            >
              {x}
            </button>
          ))}
          <span className="ind" aria-hidden="true" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} />
        </div>
        <div className="panel" id={`panel-${t}`} role="tabpanel" aria-labelledby={`tab-${t}`} tabIndex={0} key={t}>
          {t === 0 && <div className="faq-cols">{[0, 1].map(col => (
            <div key={col} className="faq-list">{C.faq.map((f, i) => {
              if ((i < Math.ceil(C.faq.length / 2)) !== (col === 0)) return null
              const on = qs.has(i)
              return (
                <div key={i} className={`faq ${on ? 'on' : ''}`}>
                  <button id={`faq-q-${i}`} aria-expanded={on} aria-controls={`faq-a-${i}`} onClick={() => toggle(i)}>
                    <span>{f.q}</span><i aria-hidden="true" />
                  </button>
                  <div className="ans" id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`}>
                    <div><p {...html(f.a)} /></div>
                  </div>
                </div>
              )
            })}</div>))}</div>}
          {t === 1 && <>
            <p className="note first">Policies of Anchorage Capital and its schemes, available to download as PDF.</p>
            <div className="pol-grid">{C.pol.map(p => (
              <div key={p.t} className="pol">
                <div><h3>{p.t}</h3><p>{p.d}</p></div>
                <div className="pol-act">
                  <a className="dl" href={p.href} download aria-label={`Download ${p.t}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/>
                    </svg>Download
                  </a>
                  <small>{p.meta}</small>
                </div>
              </div>
            ))}</div>
          </>}
          {t === 2 && <>
            <p className="note first">{C.defs.note}</p>
            <dl className="defs">{C.defs.items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </>}
        </div>
      </div>
    </section>
  )
}

function Contact() {
  const [doc, setDoc] = useState(null)
  const panel = useRef()
  useTrap(!!doc, panel)

  useEffect(() => {
    if (!doc) return
    pauseScroll(true)
    const k = e => e.key === 'Escape' && setDoc(null)
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener('keydown', k)
      pauseScroll(false)
    }
  }, [doc])

  return (
    <section id="contact" className="sec ct2">
      <div className="ct2-stage">
      <div className="ct2-bg" aria-hidden="true" />
      <div className="wrap ct2-wrap">
        <SecLabel>Contact</SecLabel>
        <div className="ct2-grid">
          <div className="ct2-lead">
            <Rv as="h2" className="h1">Speak with us.</Rv>
            <Rv as="p" d={120} className="lede">For investor enquiries, write to the team directly.</Rv>
            <Rv d={200}><a className="ct-mail" href="mailto:investor@anchoragealpha.com"><span>investor@anchoragealpha.com</span><svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg></a></Rv>
          </div>
          <div className="ct2-info">
            <Rv className="ct2-row">
              <div><h3 className="c-h">Office</h3><address>209/210, 2nd Floor, Arcadia Building<br />NCPA Marg, Nariman Point<br />Mumbai, Maharashtra 400021<br /><a href="tel:+912240198600">022-40198600</a></address></div>
              <div><h3 className="c-h">Enquiries</h3><p><b>Investors:</b> <a href="mailto:investor@anchoragealpha.com">investor@anchoragealpha.com</a></p><p><b>General:</b> <a href="mailto:contact@anchoragealpha.com">contact@anchoragealpha.com</a></p></div>
            </Rv>
            <Rv d={100} className="ct2-reg">
              <h3 className="c-h">Fund &amp; regulatory</h3>
              <div className="reg-cols">
                <div><p><b>Fund:</b> Anchorage Capital</p><p><b>Category:</b> Category II AIF</p><p><b>SEBI registration:</b> IN/AIF2/21-22/1003</p></div>
                <div><p><b>Sponsor:</b> Rohit Kothari</p><p><b>Investment manager:</b> Anchorage Alpha Investments Advisor Private Limited</p><p><b>Trustee:</b> Orbis Trusteeship Services Private Limited</p><p><b>Compliance officer:</b> Bhaven Jain</p></div>
              </div>
            </Rv>
            <Rv d={180} className="ct2-odr" id="grievance">
              <h3 className="c-h">Investor grievance redressal</h3>
              <div className="reg-cols">
                <p>SEBI SCORES link:<br /><a href="https://scores.sebi.gov.in/" target="_blank" rel="noopener">https://scores.sebi.gov.in/</a></p>
                <p>Online Dispute Resolution Portal link:<br /><a href="https://smartodr.in/" target="_blank" rel="noopener">https://smartodr.in/</a></p>
              </div>
            </Rv>
          </div>
        </div>
      </div>
      </div>
      <div className="wrap">
        <footer onClick={e => { if (e.target.closest('.nw')) { e.preventDefault(); setDoc('legal') } }}>
          <div className="foot-top">
            <p className="foot-copy">{C.footer[2]}</p>
            <nav className="foot-links" aria-label="Legal and privacy">
              <button type="button" className="foot-link" onClick={() => setDoc('legal')}>Legal information</button>
              <button type="button" className="foot-link" onClick={() => setDoc('privacy')}>Privacy</button>
            </nav>
          </div>
          <div className="foot-main">{C.footer.slice(0, 2).map((p, i) => <p key={i} {...html(p)} />)}</div>
        </footer>
      </div>
      <div className={`drawer doc ${doc ? 'open' : ''}`} aria-hidden={!doc}>
        <div className="veil" onClick={() => setDoc(null)} />
        <aside role="dialog" aria-label={doc === 'privacy' ? 'Privacy' : 'Legal information'} ref={panel}>
          {doc && <>
            <button className="x" onClick={() => setDoc(null)}>Close</button>
            <h3 className="h3">{doc === 'privacy' ? 'Privacy' : 'Legal information'}</h3>
            {(doc === 'privacy' ? C.privacy : C.legal).map((p, i) => <p key={i} className="doc-p" {...html(p)} />)}
          </>}
        </aside>
      </div>
    </section>
  )
}

const ToTop = () => {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let raf = 0
    const on = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setShow(window.scrollY > window.innerHeight * 0.9)
      })
    }
    window.addEventListener('scroll', on, { passive: true })
    on()
    return () => {
      window.removeEventListener('scroll', on)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <button
      type="button"
      className={`to-top ${show ? 'show' : ''}`}
      aria-label="Back to top"
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() => goTo('top')}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5.5 11.5 12 5l6.5 6.5"/></svg>
    </button>
  )
}

export default function App() {
  const [active, setActive] = useState('top')
  const [solid, setSolid] = useState(false)

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

    lenis = new Lenis({
      lerp: (window.paused || reduce) ? 1 : 0.085,
      wheelMultiplier: 0.95,
      smoothWheel: true,
      smoothTouch: false,
      prevent: node => !!(node && node.closest && node.closest('#a11y'))
    })
    window.__lenis = lenis
    lenis.scrollTo(0, { immediate: true })

    let raf = 0
    const loop = (t) => {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        raf = requestAnimationFrame(loop)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    const heroEl = document.getElementById('top')
    const progEl = document.querySelector('.prog')
    let lastSolid = false

    const onScroll = () => {
      const y = window.scrollY
      const h = window.innerHeight
      const docHeight = document.documentElement.scrollHeight
      const max = docHeight - h
      const p = Math.min(1, Math.max(0, y / h))
      const prog = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0

      if (heroEl) {
        heroEl.style.setProperty('--p', p.toString())
      }
      if (progEl) {
        progEl.style.setProperty('--prog', prog.toString())
      }

      const isSolid = y > h * 0.82
      if (isSolid !== lastSolid) {
        lastSolid = isSolid
        setSolid(isSolid)
      }
    }

    lenis.on('scroll', onScroll)
    onScroll()

    /* active nav item: the last section whose top has passed the reading line */
    let lastActive = 'top'
    const pickActive = () => {
      const line = window.innerHeight * 0.45
      let cur = 'top'
      for (const [id] of NAV) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) cur = id
      }
      if (window.scrollY < 4) cur = 'top'
      if (cur !== lastActive) { lastActive = cur; setActive(cur) }
    }
    lenis.on('scroll', pickActive)
    window.addEventListener('resize', pickActive, { passive: true })
    pickActive()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVis)
      lenis.destroy()
      window.__lenis = null
      lenis = null
      window.removeEventListener('resize', pickActive)
    }
  }, [])

  return (
    <>
      <a className="a11y-skip" href="#a11y-main">Skip to main content</a>
      <Nav active={active} solid={solid} />
      <main id="a11y-main" tabIndex={-1}>
        <div className="hero-stack">
          <Hero />
          <About />
        </div>
        <Schemes />
        <Legacy />
        <Team />
        <Approach />
        <Portfolio />
        <Investors />
        <Contact />
      </main>
      <DepthMeter />
      <ToTop />
    </>
  )
}
