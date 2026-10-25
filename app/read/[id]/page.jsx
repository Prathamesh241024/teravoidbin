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

async function findChapters(pdf) {
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
          if (it.items?.length && list.length < 300) await walk(it.items, depth + 1)
        }
      }
      await walk(out, 0)
      if (list.length) return list
    }
  } catch {}
  const list = [], seen = new Set()
  for (let i = 1; i <= pdf.numPages && i <= 800; i++) {
    try {
      const tc = await (await pdf.getPage(i)).getTextContent()
      const full = tc.items.map(t => t.str).join(' ').replace(/\s+/g, ' ').trim()
      if ((full.match(/chapter\s*\d+/gi) || []).length > 2) continue
      const m = full.slice(0, 60).match(/^(chapter|ch\.?)\s*(\d+)/i)
      if (m && !seen.has(m[2])) { seen.add(m[2]); list.push({ label: `Chapter ${m[2]}`, page: i }) }
    } catch {}
  }
  return list
}

export default function Read({ params }) {
  const [item, setItem] = useState(null), [extras, setExtras] = useState([]), [cur, setCur] = useState({ key: 'main', format: '' })
  const [mainChapters, setMainChapters] = useState([]), [err, setErr] = useState(''), [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1), [pages, setPages] = useState(0), [atEnd, setAtEnd] = useState(false)
  const [bg, setBg] = useState(''), [tone, setTone] = useState('dark'), [dim, setDim] = useState(0.6), [size, setSize] = useState(110), [panel, setPanel] = useState(false), [jump, setJump] = useState('')
  const [marks, setMarks] = useState([]), [bmOpen, setBmOpen] = useState(false)
  const box = useRef(), pdfBox = useRef(), rend = useRef(), pdfRef = useRef(), pagesRef = useRef([]), io = useRef(), modeRef = useRef()
  const loc = useRef({}), data = useRef({ item: null, extras: [] }), themeRef = useRef({}), lastPage = useRef(0), keyRef = useRef('main'), router = useRouter()
  themeRef.current = { tone, size }
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
    io.current?.disconnect(); io.current = null
    try { pdfRef.current?.destroy() } catch {}
    pdfRef.current = null; pagesRef.current = []
    if (box.current) box.current.innerHTML = ''
    if (pdfBox.current) pdfBox.current.innerHTML = ''
  }
  const goPage = n => {
    const els = pagesRef.current; if (!els.length) return
    const el = els[Math.max(1, Math.min(n, els.length)) - 1]
    if (el && pdfBox.current) pdfBox.current.scrollTop = el.offsetTop
  }

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
        setAtEnd(!!l.atEnd)
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

  const startPdf = async (buf, key, target) => {
    const lib = await loadPdfJs()
    const pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise
    pdfRef.current = pdf; setPages(pdf.numPages)
    const root = pdfBox.current
    const wrap = document.createElement('div')
    wrap.style.cssText = 'max-width:900px;margin:0 auto;padding:8px'
    root.appendChild(wrap)
    const v0 = (await pdf.getPage(1)).getViewport({ scale: 1 })
    const w = Math.min(root.clientWidth - 16, 884) || 360
    const els = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const d = document.createElement('div')
      d.dataset.p = i
      d.style.cssText = `background:#fff;margin-bottom:8px;overflow:hidden;height:${Math.round(w * v0.height / v0.width)}px`
      wrap.appendChild(d); els.push(d)
    }
    pagesRef.current = els
    const draw = async (el, i) => {
      const pg = await pdf.getPage(i), v = pg.getViewport({ scale: 1 })
      const scale = el.clientWidth / v.width, dpr = Math.min(window.devicePixelRatio || 1, 2)
      const vp = pg.getViewport({ scale: scale * dpr })
      const c = document.createElement('canvas')
      c.width = vp.width; c.height = vp.height
      c.style.cssText = 'width:100%;display:block'
      el.style.height = Math.round(v.height * scale) + 'px'
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
      if (el.dataset.done) el.replaceChildren(c)
    }
    io.current = new IntersectionObserver(es => es.forEach(e => {
      const el = e.target
      if (e.isIntersecting && !el.dataset.done) { el.dataset.done = '1'; draw(el, +el.dataset.p).catch(() => {}) }
      else if (!e.isIntersecting && el.dataset.done) { delete el.dataset.done; el.replaceChildren() }
    }), { root, rootMargin: '1200px 0px' })
    els.forEach(el => io.current.observe(el))
    const start = target && target[0] === 'p' ? parseInt(target.slice(1)) || 1 : 1
    requestAnimationFrame(() => goPage(start))
    if (key === 'main') findChapters(pdf).then(list => setMainChapters(list.map(c => ({ label: c.label, value: 'main|p' + c.page }))))
  }

  const openDoc = async (key, target) => {
    const d = docOf(key); if (!d) return
    teardown(); keyRef.current = key; lastPage.current = 0
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
    try { const s = JSON.parse(localStorage.reader || '{}'); if (s.bg) setBg(s.bg); if (s.tone) setTone(s.tone); if (s.dim != null) setDim(s.dim); if (s.size) setSize(s.size) } catch {}
  }, [])
  useEffect(() => { try { localStorage.reader = JSON.stringify({ bg, tone, dim, size }) } catch {} }, [bg, tone, dim, size])
  useEffect(() => { applyTheme() }, [tone, size, cur.key, loading])

  useEffect(() => {
    (async () => {
      if (!(await getMe())) return router.push('/login')
      const { data: it } = await supabase.from('items').select('*').eq('id', params.id).single()
      if (!it) return router.push('/')
      const { data: ex } = await supabase.from('chapters').select('*').eq('item_id', it.id).order('number', { ascending: true })
      data.current = { item: it, extras: ex || [] }
      setItem(it); setExtras(ex || [])
      supabase.from('events').insert({ item_id: it.id, kind: 'read' }).then(() => {})
      supabase.rpc('award_xp', { k: 'read', r: it.id }).then(() => {})
      supabase.from('bookmarks').select('*').eq('item_id', it.id).order('created_at', { ascending: false }).then(({ data: m }) => setMarks(m || []))
      openDoc('main')
    })()
    return () => teardown()
  }, [params.id])

  const onPdfScroll = () => {
    const root = pdfBox.current, els = pagesRef.current; if (!root || !els.length) return
    const y = root.scrollTop + root.clientHeight * 0.3
    let lo = 0, hi = els.length - 1
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (els[mid].offsetTop <= y) lo = mid; else hi = mid - 1 }
    const n = lo + 1
    setAtEnd(root.scrollTop + root.clientHeight >= root.scrollHeight - 60)
    if (n !== lastPage.current) {
      lastPage.current = n; setPage(n); loc.current = { pos: 'p' + n }
      try { localStorage.setItem(`pos:${data.current.item.id}:${keyRef.current}`, 'p' + n) } catch {}
    }
  }

  const goChapter = v => {
    const [key, pos] = splitPos(v)
    if (key === keyRef.current) {
      if (cur.format === 'pdf') goPage(parseInt(pos.slice(1)) || 1)
      else rend.current?.display(pos || undefined)
    } else openDoc(key, pos || undefined)
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
    if (cur.key === 'main') {
      if (cur.format === 'pdf') guess = `${item.title} · page ${page}`
      else {
        const base = (loc.current.href || '').split('#')[0]
        const ch = mainChapters.find(c => { const h = c.value.slice(5).split('#')[0]; return base && (h === base || h.endsWith(base) || base.endsWith(h)) })
        guess = ch?.label || 'Bookmark'
      }
    }
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
  const nextKey = nextKeyOf(cur.key)
  const veil = tone === 'dark' ? `rgba(0,0,0,${dim})` : `rgba(255,255,255,${dim})`
  const title = cur.key === 'main' ? item.title : docOf(cur.key)?.label
  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: bg ? `url("${bg}") center/cover` : tone === 'dark' ? '#0b0b1a' : '#f5f5f5' }}>
      <div className="absolute inset-0" style={{ background: veil }} />
      <div className="relative z-10 flex h-full flex-col">
        <div className="max-h-[65vh] space-y-2 overflow-y-auto bg-black/60 p-3 text-white backdrop-blur" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => router.push('/')}>← Back</button>
            <h1 className="min-w-0 flex-1 truncate font-bold">{title}</h1>
            <button className="btn" onClick={() => download({ file_path: docOf(cur.key).path })}>⬇</button>
            <button className="btn" onClick={() => router.push('/book/' + item.id)}>💬</button>
            <button className="btn" onClick={() => { setBmOpen(!bmOpen); setPanel(false) }}>🔖</button>
            <button className="btn" onClick={() => { setPanel(!panel); setBmOpen(false) }}>⚙</button>
          </div>
          {options.length > 0 && (
            <div className="flex gap-2">
              <select className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm" defaultValue="" onChange={e => { goChapter(e.target.value); e.target.value = '' }}>
                <option value="" disabled>📑 Chapters ({options.length})</option>
                {options.map((c, i) => <option key={i} value={c.value}>{c.label}</option>)}
              </select>
              <input className="w-16 rounded-lg bg-slate-800 px-2 py-2 text-sm" type="number" min="1" placeholder={cur.format === 'pdf' ? 'page' : '#'} value={jump} onChange={e => setJump(e.target.value)} />
              <button className="btn" onClick={() => { if (cur.format === 'pdf') goPage(+jump); else { const c = options[jump - 1]; if (c) goChapter(c.value) } }}>Go</button>
            </div>
          )}
          {bmOpen && (
            <div className="space-y-2 rounded-xl bg-slate-900/90 p-3 text-sm">
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
            <div className="space-y-2 rounded-xl bg-slate-900/90 p-3 text-sm">
              {cur.format === 'epub' && (
                <div className="flex gap-2">
                  <button className="btn flex-1" onClick={() => modeRef.current?.('scroll', loc.current.pos)}>📜 Scroll view</button>
                  <button className="btn flex-1" onClick={() => modeRef.current?.('page', loc.current.pos)}>📄 Page view</button>
                </div>
              )}
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
          <div ref={pdfBox} onScroll={onPdfScroll} className={cur.format === 'pdf' && !err ? 'relative h-full overflow-y-auto' : 'hidden'} />
        </div>
        {!err && cur.format === 'epub' && (
          <div className="flex gap-2 bg-black/60 p-3 backdrop-blur" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button className="btn flex-1" onClick={() => rend.current?.prev()}>← Previous</button>
            <button className="btn flex-1" onClick={() => (atEnd && nextKey ? openDoc(nextKey) : rend.current?.next())}>{atEnd && nextKey ? 'Next chapter →' : 'Next →'}</button>
          </div>
        )}
        {!err && cur.format === 'pdf' && (
          <div className="flex items-center gap-2 bg-black/60 p-3 text-white backdrop-blur" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button className="btn" onClick={() => goPage(page - 1)}>←</button>
            <span className="flex-1 text-center text-sm">Page {page} / {pages}</span>
            {atEnd && nextKey ? <button className="btn" onClick={() => openDoc(nextKey)}>Next chapter →</button> : <button className="btn" onClick={() => goPage(page + 1)}>→</button>}
          </div>
        )}
      </div>
    </div>
  )
}
