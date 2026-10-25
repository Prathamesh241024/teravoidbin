'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
export default function AddChapters() {
  const [ok, setOk] = useState(false), [items, setItems] = useState([]), [sel, setSel] = useState(''), [list, setList] = useState([]), [num, setNum] = useState(''), [msg, setMsg] = useState(''), router = useRouter()
  useEffect(() => {
    getMe().then(m => {
      if (!m?.admin) return router.push('/')
      setOk(true)
      supabase.from('items').select('id,title,format').order('created_at', { ascending: false }).then(({ data }) => setItems(data || []))
    })
  }, [])
  const choose = async id => {
    setSel(id); setMsg('')
    if (!id) { setList([]); return }
    const { data } = await supabase.from('chapters').select('*').eq('item_id', id).order('number')
    setList(data || [])
    setNum(data?.length ? String(Math.max(...data.map(c => c.number)) + 1) : '')
  }
  const up = async e => {
    e.preventDefault()
    const form = e.target, f = new FormData(form), file = f.get('file')
    if (!sel || !file?.name) return setMsg('Pick a book and a file')
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext !== 'pdf' && ext !== 'epub') return setMsg('Use a PDF or EPUB file')
    setMsg('Uploading…')
    const path = `chapters/${sel}/${crypto.randomUUID()}.${ext}`
    const { error: e1 } = await supabase.storage.from('library').upload(path, file)
    if (e1) return setMsg(e1.message)
    const { error: e2 } = await supabase.from('chapters').insert({ item_id: sel, number: +f.get('number'), title: f.get('title') || null, format: ext, file_path: path })
    if (e2) { await supabase.storage.from('library').remove([path]); return setMsg(e2.code === '23505' ? 'That chapter number already exists for this book' : e2.message) }
    setMsg('Chapter added ✓'); form.reset(); choose(sel)
  }
  const del = async c => {
    if (!confirm(`Delete chapter ${c.number}?`)) return
    await supabase.storage.from('library').remove([c.file_path])
    await supabase.from('chapters').delete().eq('id', c.id); choose(sel)
  }
  if (!ok) return null
  return (
    <div className="space-y-4 pt-6">
      <form onSubmit={up} className="card space-y-3">
        <h1 className="text-2xl font-bold">➕ Add a chapter</h1>
        <p className="text-sm opacity-70">Add a PDF chapter to the PDF book and an EPUB chapter to the EPUB book.</p>
        <select className="input" value={sel} onChange={e => choose(e.target.value)} required>
          <option value="">Choose the book…</option>
          {items.map(i => <option key={i.id} value={i.id}>{i.title} ({i.format})</option>)}
        </select>
        <input name="number" type="number" min="1" className="input" placeholder="Chapter number, e.g. 11" value={num} onChange={e => setNum(e.target.value)} required />
        <input name="title" className="input" placeholder="Chapter title (optional)" />
        <input name="file" type="file" accept=".pdf,.epub" required />
        <button className="btn">Upload chapter</button>
        <p className="text-sm">{msg}</p>
      </form>
      {list.map(c => (
        <div key={c.id} className="card flex items-center justify-between">
          <span>Chapter {c.number}{c.title ? ' – ' + c.title : ''} <small className="opacity-60">({c.format})</small></span>
          <button onClick={() => del(c)} className="text-red-500">Delete</button>
        </div>
      ))}
    </div>
  )
}
