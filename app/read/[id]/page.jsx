'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe, download } from '@/lib/supabase'

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/'
const loadPdfJs = () => new Promise((res, rej) => {
  if (window.pdfjsLib) return res(window.pdfjsLib)
  const s = document.createElement('script')
  s.src = PDFJS + 'pdf.min.js'
  s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib) }
  s.onerror = () => rej(new Error('PDF engine failed to load'))
  document.head.appendChild(s)
})
const splitPos = v => { const i = v.indexOf('|'); return i < 0 ? ['main', v] : [v.slice(0, i), v.slice(i + 1)] }
const wait = ms => new Promise(r => setTimeout(r, ms))

async function findChapters(pdf, cacheKey, alive, emit) {
  try { const c = JSON.parse(localStorage.getItem(cacheKey) || 'null'); if (c?.length) return emit(c) } catch {}
  const save = list => { try { if (list.length) localStorage.setItem(cacheKey, JSON.stringify(list)) } catch {} }
  try {
    const out = await pdf.getOutline()
    if (out?.length) {
      const list = []
      const walk = async (items, depth) => {
        for (const it of items) {
          try {
            let d = it.dest
            if (typeof d === 'string') d = await pdf.getDestination(d)
            if (d) list.push({ label: '– '.repeat(depth) + (it.title || 'Section').trim(), page: (typeof d[0] === 'object' ? await pdf.getPageIndex(d[0]) : d[0]) + 1 })
          } catch {}
          if (it.items?.length) await walk(it.items, depth + 1)
        }
      }
      await walk(out, 0)
      if (list.length) { save(list); return emit(list) }
    }
  } catch {}
  const list = [], seen = new Set()
  for (let i = 1; i <= pdf.numPages; i++) {
    if (!alive()) return
    await wait(120)
    try {
      const tc = await (await pdf.getPage(i)).getTextContent()
      const full = tc.items.map(t => t.str).join(' ').replace(/\s+/g, ' ').trim()
      if ((full.match(/chapter\s*\d+/gi) || []).length > 2) continue
      const m = full.slice(0, 60).match(/^(chapter|ch\.?)\s*(\d+)/i)
      if (m && !seen.has(m[2])) { seen.add(m[2]); list.push({ label: `Chapter ${m[2]}`, page: i }); emit([...list]) }
    } catch {}
  }
  save(list)
}

export default function Read({ params }) {
  const [item, setItem] = useState(null), [extras, setExtras] = useState([]), [cur, setCur] = useState({ key: 'main', format: '' })
  const [mainChapters, setMainChapters] = useState([]), [err, setErr] = useState(''), [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1), [pages, setPages] = useState(0), [atEnd, setAtEnd] = useState(false), [href, setHref] = useState('')
  const [bg, setBg] = useState(''), [tone, setTone] = useState('dark'), [dim, setDim] = useState(0.6), [size, setSize] = useState(110), [night, setNight] = useState(false)
  const [panel, setPanel] = useState(false), [jump, setJump] = useState(''), [zoom, setZoom] = useState(1), [chapterOpen, setChapterOpen] = useState(false), [q, setQ] = useState('')
  const [marks, setMarks] = useState([]), [bmOpen, setBmOpen] = useState(false)
  const box = useRef(), holder = useRef(), pdfWrap = useRef(), rend = useRef(), pdfRef = useRef(), pdfCache = useRef(new Map()), modeRef = useRef()
  const loc = useRef({}), data = useRef({ item: null, extras: [] }), themeRef = useRef({}), keyRef = useRef('main'), tokenRef = useRef(0)
  const zoomRef = useRef(1), pageRef = useRef(1), touch = useRef(null), lastW = useRef(0), router = useRouter()
  themeRef.current = { tone, size }
  zoomRef.current = zoom
  if (item) data.current = { item, extras }

  const docOf = key => {
    const { item: it, extras: ex } = data.current
    if (key === 'main') return { key, format: it.format, path: it.file_path, label: it.title }
    const r = ex.find(x => x.id === key)
    return r && { key, format: r.format, path: r.file_path, label: `Chapter ${r.number}${r.title ? ' – ' + r.title : ''}` }
  }
  const nextKeyOf = key => { const o = ['main', ...data.current.extras.map(x => x.id)]; return o[o.indexOf(key) + 1] || null }

  const applyTheme = () => {
    const r = rend.current; if (!r) return
    const { tone: t, size: s } = themeRef.current
    r.themes.override('color', t === 'dark' ? '#f2f2f2' : '#111111', true)
    r.themes.override('background', 'transparent', true)
    r.themes.fontSize(s + '%')
  }
  const teardown = () => {
    try { rend.current?.destroy() } catch {}
    rend.current = null
    tokenRef.current++
    try { pdfRef.current?.destroy() } catch {}
    pdfRef.current = null; pdfCache.current.clear()
    if (box.current) box.current.innerHTML = ''
    if (holder.current) holder.current.innerHTML = ''
  }

  // ---------- PDF: one sharp page at a time ----------
  const renderPdfPage = async n => {
    const pdf = pdfRef.current, wrap = pdfWrap.current
    if (!pdf || !wrap) return null
    const z = zoomRef.current, avail = wrap.clientWidth || 360
    const key = `${n}@${z}@${avail}`, cache = pdfCache.current
    if (!cache.has(key)) {
      const p = (async () => {
        const pg = await pdf.getPage(n)
        const v = pg.getViewport({ scale: 1 })
        const css = (avail / v.width) * z
        const scale = Math.min(css * Math.min(window.devicePixelRatio || 1, 3), 4096 / Math.max(v.width, v.height))
        const vp = pg.getViewport({ scale })
        const c = document.createElement('canvas')
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height)
        c.style.cssText = `width:${Math.round(v.width * css)}px;height:${Math.round(v.height * css)}px;display:block;margin:0 auto;background:#fff`
        await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
        return c
      })()
      cache.set(key, p)
      p.catch(() => cache.delete(key))
      while (cache.size > 6) cache.delete(cache.keys().next().value)
    }
    return cache.get(key)
  }
  const showPdfPage = async n => {
    const pdf = pdfRef.current; if (!pdf) return
    n = Math.max(1, Math.min(n, pdf.numPages))
    const my = ++tokenRef.current
    pageRef.current = n; setPage(n); setAtEnd(n >= pdf.numPages)
    loc.current = { pos: 'p' + n }
    try { localStorage.setItem(`pos:${data.current.item.id}:${keyRef.current}`, 'p' + n) } catch {}
    let c
    try { c = await renderPdfPage(n) } catch { return }
    if (!c || my !== tokenRef.current || !holder.current) return
    holder.current.replaceChildren(c)
    pdfWrap.current?.scrollTo(0, 0)
    if (n < pdf.numPages) renderPdfPage(n + 1).catch(() => {})
    if (n > 1) renderPdfPage(n - 1).catch(() => {})
  }
  const nextPage = () => {
    const pdf = pdfRef.current; if (!pdf) return
    if (pageRef.current >= pdf.numPages) { if (nextKey) openDoc(nextKey) } else showPdfPage(pageRef.current + 1)
  }
  const onTouchStart = e => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY } }
  const onTouchEnd = e => {
    const s = touch.current; touch.current = null
    if (!s || zoomRef.current > 1.05 || e.changedTouches.length !== 1) return
    const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y
    if (Math.abs(dx) > 70 && Math.abs(dy) < 45) { if (dx < 0) nextPage(); else showPdfPage(pageRef.current - 1) }
  }

  const startPdf = async (buf, key, target) => {
    const lib = await loadPdfJs()
    const pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise
    pdfRef.current = pdf; pdfCache.current.clear(); setPages(pdf.numPages)
    const start = target && target[0] === 'p' ? parseInt(target.slice(1)) || 1 : 1
    await new Promise(r => requestAnimationFrame(r))
    await showPdfPage(start)
    if (key === 'main') setTimeout(() => {
      if (pdfRef.current === pdf) findChapters(pdf, 'chap:' + docOf('main').path, () => pdfRef.current === pdf, list => setMainChapters(list.map(c => ({ label: c.label, value: 'main|p' + c.page })))).catch(() => {})
    }, 2500)
  }

  // ---------- EPUB ----------
  const startEpub = async (buf, key, target) => {
    const ePub = (await import('epubjs')).default
    const book = ePub(buf)
    await book.ready
    const fixed = book.packaging?.metadata?.layout === 'pre-paginated'
    modeRef.current = async (mode, at) => {
      try { rend.current?.destroy() } catch {}
      box.current.innerHTML = ''
      const r = book.renderTo(box.current, mode === 'page'
        ? { width: '100%', height: '100%', flow: 'paginated', spread: 'none' }
        : { width: '100%', height: '100%', flow: 'scrolled-doc' })
      rend.current = r
      r.on('relocated', l => {
        loc.current = { pos: l.start.cfi, href: l.start.href }
        setHref(l.start.href); setAtEnd(!!l.atEnd)
        try { localStorage.setItem(`pos:${data.current.item.id}:${key}`, l.start.cfi) } catch {}
      })
      try { await r.display(at || undefined) } catch { await r.display() }
      applyTheme()
    }
    await modeRef.current(fixed ? 'page' : 'scroll', target)
    if (key === 'main') {
      try {
        const nav = await book.loaded.navigation
        let list = nav.toc.map(c => ({ label: c.label.trim(), value: 'main|' + c.href }))
        if (!list.length) { const sp = await book.loaded.spine; list = sp.spineItems.map((x, i) => ({ label: `Section ${i + 1}`, value: 'main|' + x.href })) }
        setMainChapters(list)
      } catch {}
    }
  }

  const openDoc = async (key, target) => {
    const d = docOf(key); if (!d) return
    teardown(); keyRef.current = key
    setErr(''); setLoading(true); setCur({ key, format: d.format }); setAtEnd(false); setPage(1); setPages(0); setBmOpen(false)
    try {
      if (d.format !== 'epub' && d.format !== 'pdf') throw new Error(`.${d.format} files can't be read here`)
      const { data: s, error } = await supabase.storage.from('library').createSignedUrl(d.path, 3600)
      if (error) throw error
      const buf = await (await fetch(s.signedUrl)).arrayBuffer()
      let saved; try { saved = localStorage.getItem(`pos:${data.current.item.id}:${key}`) } catch {}
      if (d.format === 'epub') await startEpub(buf, key, target || saved)
      else await startPdf(buf, key, target || saved)
    } catch (e) { setErr('This file could not be opened (' + (e?.message || e) + '). Use ⬇ to download it instead.') }
    setLoading(false)
  }

  useEffect(() => {
    try { const s = JSON.parse(localStorage.reader || '{}'); if (s.bg) setBg(s.bg); if (s.tone) setTone(s.tone); if (s.dim != null) setDim(s.dim); if (s.size) setSize(s.size); if (s.night) setNight(true) } catch {}
  }, [])
  useEffect(() => { try { localStorage.reader = JSON.stringify({ bg, tone, dim, size, night }) } catch {} }, [bg, tone, dim, size, night])
  useEffect(() => { applyTheme() }, [tone, size, cur.key, loading])
  useEffect(() => { if (pdfRef.current) showPdfPage(pageRef.current) }, [zoom])
  useEffect(() => {
    let t
    const on = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const w = pdfWrap.current?.clientWidth || 0
        if (!pdfRef.current || w === lastW.current) return
        lastW.current = w; showPdfPage(pageRef.current)
      }, 300)
    }
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('resize', on); clearTimeout(t) }
  }, [])

  useEffect(() => {
    (async () => {
      if (!(await getMe())) return router.push('/login')
      const { data: it } = await supabase.from('items').select('*').eq('id', params.id).single()
      if (!it) return router.push('/')
      let ex = []
      for (let from = 0; ; from += 1000) {
        const { data: part } = await supabase.from('chapters').select('*').eq('item_id', it.id).order('number', { ascending: true }).range(from, from + 999)
        ex = ex.concat(part || [])
        if (!part || part.length < 1000) break
      }
      data.current = { item: it, extras: ex }
      setItem(it); setExtras(ex)
      supabase.from('events').insert({ item_id: it.id, kind: 'read' }).then(() => {})
      supabase.rpc('award_xp', { k: 'read', r: it.id }).then(() => {})
      supabase.from('bookmarks').select('*').eq('item_id', it.id).order('created_at', { ascending: false }).then(({ data: m }) => setMarks(m || []))
      openDoc('main')
    })()
    return () => teardown()
  }, [params.id])

  const goChapter = v => {
    const [key, pos] = splitPos(v)
    if (key === keyRef.current) {
      if (cur.format === 'pdf') showPdfPage(parseInt(pos.slice(1)) || 1)
      else rend.current?.display(pos || undefined)
    } else openDoc(key, pos || undefined)
  }
  const goJump = () => {
    if (cur.format === 'pdf') return showPdfPage(+jump || 1)
    const x = extras.find(e => e.number === +jump)
    const c = x ? { value: x.id + '|' } : mainChapters[jump - 1]
    if (c) goChapter(c.value)
  }

  const pick = file => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas')
      c.width = img.width * k; c.height = img.height * k
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      setBg(c.toDataURL('image/jpeg', 0.7))
    }
    img.src = URL.createObjectURL(file)
  }

  const addMark = async () => {
    const pos = loc.current.pos
    if (!pos) return alert('Scroll a little, then try again.')
    let guess = docOf(cur.key).label
    if (cur.key === 'main') guess = cur.format === 'pdf' ? (here?.label ? `${here.label} · page ${page}` : `${item.title} · page ${page}`) : (here?.label || 'Bookmark')
    const label = prompt('Name this bookmark', guess)
    if (label === null) return
    const { data: row, error } = await supabase.from('bookmarks').insert({ item_id: item.id, cfi: `${cur.key}|${pos}`, label: label || 'Bookmark' }).select().single()
    if (error) return alert(error.message)
    setMarks([row, ...marks])
  }
  const delMark = async id => {
    await supabase.from('bookmarks').delete().eq('id', id)
    setMarks(marks.filter(m => m.id !== id))
  }

  if (!item) return <p className="fixed inset-0 z-40 bg-slate-950 p-6 text-white">Loading…</p>
  const options = [...mainChapters, ...extras.map(x => ({ label: `📘 Chapter ${x.number}${x.title ? ' – ' + x.title : ''}`, value: x.id + '|' }))]
  const here = (() => {
    if (cur.key !== 'main') return options.find(o => o.value === cur.key + '|')
    if (cur.format === 'pdf') return mainChapters.filter(c => (parseInt(c.value.slice(6)) || 0) <= page).pop()
    const base = (href || '').split('#')[0]
    const hits = base ? mainChapters.filter(c => { const h = c.value.slice(5).split('#')[0]; return h === base || h.endsWith(base) || base.endsWith(h) }) : []
    return hits.length === 1 ? hits[0] : undefined
  })()
  const nextKey = nextKeyOf(cur.key)
  const filtered = options.filter(o => o.label.toLowerCase().includes(q.trim().toLowerCase()))
  const veil = tone === 'dark' ? `rgba(0,0,0,${dim})` : `rgba(255,255,255,${dim})`
  const title = cur.key === 'main' ? item.title : docOf(cur.key)?.label
  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: bg ? `url("${bg}") center/cover` : tone === 'dark' ? '#0b0b1a' : '#f5f5f5' }}>
      <div className="absolute inset-0" style={{ background: veil }} />
      <div className="relative z-10 flex h-full flex-col">
        <div className="max-h-[65vh] space-y-2 overflow-y-auto bg-black/80 p-3 text-white" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => router.push('/')}>← Back</button>
            <h1 className="min-w-0 flex-1 truncate font-bold">{title}</h1>
            <button className="btn" onClick={() => download({ file_path: docOf(cur.key).path })}>⬇</button>
            <button className="btn" onClick={() => router.push('/book/' + item.id)}>💬</button>
            <button className="btn" onClick={() => { setBmOpen(!bmOpen); setPanel(false) }}>🔖</button>
            <button className="btn" onClick={() => { setPanel(!panel); setBmOpen(false) }}>⚙</button>
          </div>
          {(options.length > 0 || cur.format === 'pdf') && (
            <div className="flex gap-2">
              <button className="btn min-w-0 flex-1 truncate text-left" onClick={() => { setQ(''); setChapterOpen(true) }}>📑 {here?.label || (options.length ? `Chapters (${options.length})` : 'Chapters')}</button>
              <input className="w-16 rounded-lg bg-slate-800 px-2 py-2 text-sm" type="number" min="1" placeholder={cur.format === 'pdf' ? 'page' : '#'} value={jump} onChange={e => setJump(e.target.value)} />
              <button className="btn" onClick={goJump}>Go</button>
            </div>
          )}
          {bmOpen && (
            <div className="space-y-2 rounded-xl bg-slate-900 p-3 text-sm">
              <button className="btn w-full" onClick={addMark}>🔖 Bookmark this spot</button>
              {marks.length === 0 && <p className="opacity-70">No bookmarks yet.</p>}
              {marks.map(m => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2">
                  <button className="min-w-0 flex-1 truncate text-left" onClick={() => { goChapter(m.cfi.includes('|') ? m.cfi : 'main|' + m.cfi); setBmOpen(false) }}>
                    🔖 {m.label} <span className="opacity-50">· {new Date(m.created_at).toLocaleDateString()}</span>
                  </button>
                  <button onClick={() => delMark(m.id)} aria-label="Delete bookmark">✕</button>
                </div>
              ))}
            </div>
          )}
          {panel && (
            <div className="space-y-2 rounded-xl bg-slate-900 p-3 text-sm">
              {cur.format === 'epub' && (
                <div className="flex gap-2">
                  <button className="btn flex-1" onClick={() => modeRef.current?.('scroll', loc.current.pos)}>📜 Scroll view</button>
                  <button className="btn flex-1" onClick={() => modeRef.current?.('page', loc.current.pos)}>📄 Page view</button>
                </div>
              )}
              {cur.format === 'pdf' && <button className="btn w-full" onClick={() => setNight(!night)}>🌓 PDF night mode: {night ? 'On' : 'Off'}</button>}
              <label className="btn block text-center">🖼 Choose background photo
                <input type="file" accept="image/*" hidden onChange={e => e.target.files[0] && pick(e.target.files[0])} />
              </label>
              {bg && <button className="underline" onClick={() => setBg('')}>Remove photo</button>}
              <div className="flex gap-2">
                <button className="btn flex-1" onClick={() => setTone('dark')}>🌙 Dark veil</button>
                <button className="btn flex-1" onClick={() => setTone('light')}>☀️ Light veil</button>
              </div>
              <label className="block">Veil strength {Math.round(dim * 100)}%
                <input type="range" min="0" max="0.9" step="0.05" value={dim} onChange={e => setDim(+e.target.value)} className="w-full" />
              </label>
              {cur.format === 'epub' && (
                <div className="flex items-center gap-3">
                  <button className="btn" onClick={() => setSize(Math.max(70, size - 10))}>A−</button>
                  <span>Text {size}%</span>
                  <button className="btn" onClick={() => setSize(Math.min(200, size + 10))}>A+</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="relative min-h-0 flex-1">
          {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-white">Loading…</div>}
          {err && <p className="p-6 text-red-300">{err}</p>}
          <div ref={box} className={cur.format === 'epub' && !err ? 'h-full' : 'hidden'} />
          <div ref={pdfWrap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className={cur.format === 'pdf' && !err ? 'h-full overflow-auto' : 'hidden'}>
            <div ref={holder} style={{ filter: night ? 'invert(0.92) hue-rotate(180deg)' : 'none' }} />
          </div>
        </div>
        {!err && cur.format === 'epub' && (
          <div className="flex gap-2 bg-black/80 p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button className="btn flex-1" onClick={() => rend.current?.prev()}>← Previous</button>
            <button className="btn flex-1" onClick={() => (atEnd && nextKey ? openDoc(nextKey) : rend.current?.next())}>{atEnd && nextKey ? 'Next chapter →' : 'Next →'}</button>
          </div>
        )}
        {!err && cur.format === 'pdf' && (
          <div className="flex items-center gap-2 bg-black/80 p-3 text-white" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button className="btn" onClick={() => showPdfPage(page - 1)}>←</button>
            <button className="btn" onClick={() => setZoom(Math.max(1, +(zoom - 0.25).toFixed(2)))}>−</button>
            <span className="flex-1 text-center text-sm">Page {page} / {pages}{zoom > 1 ? ` · ${Math.round(zoom * 100)}%` : ''}</span>
            <button className="btn" onClick={() => setZoom(Math.min(3, +(zoom + 0.25).toFixed(2)))}>＋</button>
            <button className="btn" onClick={nextPage}>{atEnd && nextKey ? 'Next ch →' : '→'}</button>
          </div>
        )}
      </div>
      {chapterOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70" onClick={() => setChapterOpen(false)}>
          <div className="mt-auto flex max-h-[80vh] flex-col rounded-t-2xl bg-slate-900 p-3 text-white" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 pb-2">
              <input className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm" placeholder="Search chapter…" value={q} onChange={e => setQ(e.target.value)} />
              <button className="btn" onClick={() => setChapterOpen(false)}>✕</button>
            </div>
            <div className="overflow-y-auto">
              {filtered.slice(0, 200).map((c, i) => (
                <button key={i} className={`block w-full rounded-lg px-3 py-3 text-left text-sm ${c === here ? 'bg-indigo-700' : ''}`} onClick={() => { goChapter(c.value); setChapterOpen(false) }}>{c.label}</button>
              ))}
              {filtered.length > 200 && <p className="p-2 text-xs opacity-60">Showing 200 of {filtered.length}. Type to narrow down.</p>}
              {!filtered.length && <p className="p-3 text-sm opacity-70">{options.length ? 'No match.' : cur.format === 'pdf' ? 'Looking for chapters in this PDF… this can take a minute. You can still use the page box.' : 'No chapter list in this file.'}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
