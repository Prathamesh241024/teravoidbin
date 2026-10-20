'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe, download } from '@/lib/supabase'

export default function Read({ params }) {
  const [item, setItem] = useState(null), [url, setUrl] = useState(''), [chapters, setChapters] = useState([]), [ready, setReady] = useState(false)
  const [bg, setBg] = useState(''), [tone, setTone] = useState('dark'), [dim, setDim] = useState(0.6), [size, setSize] = useState(110), [panel, setPanel] = useState(false), [jump, setJump] = useState('')
  const [marks, setMarks] = useState([]), [bmOpen, setBmOpen] = useState(false)
  const box = useRef(), rend = useRef(), loc = useRef({}), router = useRouter()

  useEffect(() => {
    try { const s = JSON.parse(localStorage.reader || '{}'); if (s.bg) setBg(s.bg); if (s.tone) setTone(s.tone); if (s.dim != null) setDim(s.dim); if (s.size) setSize(s.size) } catch {}
  }, [])
  useEffect(() => { try { localStorage.reader = JSON.stringify({ bg, tone, dim, size }) } catch {} }, [bg, tone, dim, size])

  useEffect(() => {
    (async () => {
      if (!(await getMe())) return router.push('/login')
      const { data: it } = await supabase.from('items').select('*').eq('id', params.id).single()
      if (!it) return router.push('/')
      setItem(it)
      await supabase.from('events').insert({ item_id: it.id, kind: 'read' })
      const { data: m } = await supabase.from('bookmarks').select('*').eq('item_id', it.id).order('created_at', { ascending: false })
      setMarks(m || [])
      const { data: s } = await supabase.storage.from('library').createSignedUrl(it.file_path, 3600)
      setUrl(s.signedUrl)
      if (it.format !== 'epub') return
      const ePub = (await import('epubjs')).default
      const buf = await (await fetch(s.signedUrl)).arrayBuffer()
      const book = ePub(buf)
      rend.current = book.renderTo(box.current, { width: '100%', height: '100%', flow: 'scrolled-doc' })
      rend.current.on('relocated', l => {
        loc.current = { cfi: l.start.cfi, href: l.start.href }
        try { localStorage.setItem('pos:' + it.id, l.start.cfi) } catch {}
      })
      let saved; try { saved = localStorage.getItem('pos:' + it.id) } catch {}
      try { await rend.current.display(saved || undefined) } catch { await rend.current.display() }
      setReady(true)
      try {
        const nav = await book.loaded.navigation
        let list = nav.toc.map(c => ({ label: c.label.trim(), href: c.href }))
        if (!list.length) { const sp = await book.loaded.spine; list = sp.spineItems.map((x, i) => ({ label: `Section ${i + 1}`, href: x.href })) }
        setChapters(list)
      } catch {}
    })()
  }, [params.id])

  useEffect(() => {
    const r = rend.current; if (!r) return
    r.themes.override('color', tone === 'dark' ? '#f2f2f2' : '#111111', true)
    r.themes.override('background', 'transparent', true)
    r.themes.fontSize(size + '%')
  }, [tone, size, ready])

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
  const go = href => rend.current?.display(href)

  const addMark = async () => {
    const { cfi, href } = loc.current
    if (!cfi) return alert('Scroll a little, then try again.')
    const base = (href || '').split('#')[0]
    const ch = chapters.find(c => { const h = c.href.split('#')[0]; return base && (h === base || h.endsWith(base) || base.endsWith(h)) })
    const label = prompt('Name this bookmark', ch?.label || 'Bookmark')
    if (label === null) return
    const { data, error } = await supabase.from('bookmarks').insert({ item_id: item.id, cfi, label: label || 'Bookmark' }).select().single()
    if (error) return alert(error.message)
    setMarks([data, ...marks])
  }
  const delMark = async id => {
    await supabase.from('bookmarks').delete().eq('id', id)
    setMarks(marks.filter(m => m.id !== id))
  }

  if (!item) return <p className="fixed inset-0 z-40 bg-slate-950 p-6 text-white">Loading…</p>
  const epub = item.format === 'epub'
  const veil = tone === 'dark' ? `rgba(0,0,0,${dim})` : `rgba(255,255,255,${dim})`
  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: bg ? `url("${bg}") center/cover` : tone === 'dark' ? '#0b0b1a' : '#f5f5f5' }}>
      <div className="absolute inset-0" style={{ background: veil }} />
      <div className="relative z-10 flex h-full flex-col">
        <div className="max-h-[65vh] space-y-2 overflow-y-auto bg-black/60 p-3 text-white backdrop-blur" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={() => router.push('/')}>← Back</button>
            <h1 className="min-w-0 flex-1 truncate font-bold">{item.title}</h1>
            <button className="btn" onClick={() => download(item)}>⬇</button> 
            <button className="btn" onClick={() => router.push('/book/' + item.id)}>💬</button>
            {epub && <button className="btn" onClick={() => { setBmOpen(!bmOpen); setPanel(false) }}>🔖</button>}
            {epub && <button className="btn" onClick={() => { setPanel(!panel); setBmOpen(false) }}>⚙</button>}
          </div>
          {epub && chapters.length > 0 && (
            <div className="flex gap-2">
              <select className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm" defaultValue="" onChange={e => go(e.target.value)}>
                <option value="" disabled>📑 Chapters ({chapters.length})</option>
                {chapters.map((c, i) => <option key={i} value={c.href}>{c.label}</option>)}
              </select>
              <input className="w-16 rounded-lg bg-slate-800 px-2 py-2 text-sm" type="number" min="1" max={chapters.length} placeholder="#" value={jump} onChange={e => setJump(e.target.value)} />
              <button className="btn" onClick={() => { const c = chapters[jump - 1]; if (c) go(c.href) }}>Go</button>
            </div>
          )}
          {bmOpen && (
            <div className="space-y-2 rounded-xl bg-slate-900/90 p-3 text-sm">
              <button className="btn w-full" onClick={addMark}>🔖 Bookmark this spot</button>
              {marks.length === 0 && <p className="opacity-70">No bookmarks yet.</p>}
              {marks.map(m => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2">
                  <button className="min-w-0 flex-1 truncate text-left" onClick={() => { rend.current?.display(m.cfi); setBmOpen(false) }}>
                    🔖 {m.label} <span className="opacity-50">· {new Date(m.created_at).toLocaleDateString()}</span>
                  </button>
                  <button onClick={() => delMark(m.id)} aria-label="Delete bookmark">✕</button>
                </div>
              ))}
            </div>
          )}
          {panel && (
            <div className="space-y-2 rounded-xl bg-slate-900/90 p-3 text-sm">
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
              <div className="flex items-center gap-3">
                <button className="btn" onClick={() => setSize(Math.max(70, size - 10))}>A−</button>
                <span>Text {size}%</span>
                <button className="btn" onClick={() => setSize(Math.min(200, size + 10))}>A+</button>
              </div>
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1">
          {epub ? <div ref={box} className="h-full" />
            : item.format === 'pdf' && url ? <iframe src={url} className="h-full w-full bg-white" />
            : <p className="p-6 text-white">Preview isn't available for .{item.format} files. Use ⬇ to download.</p>}
        </div>
        {epub && (
          <div className="flex gap-2 bg-black/60 p-3 backdrop-blur" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button className="btn flex-1" onClick={() => rend.current?.prev()}>← Previous chapter</button>
            <button className="btn flex-1" onClick={() => rend.current?.next()}>Next chapter →</button>
          </div>
        )}
      </div>
    </div>
  )
}
