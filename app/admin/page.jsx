'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
export default function Admin() {
  const [ok, setOk] = useState(false), [items, setItems] = useState([]), [msg, setMsg] = useState(''), router = useRouter()
  const load = () => supabase.from('items').select('*').order('created_at', { ascending: false }).then(({ data }) => setItems(data || []))
  useEffect(() => { getMe().then(m => { if (!m?.admin) return router.push('/'); setOk(true); load() }) }, [])
  const up = async e => {
    e.preventDefault()
    const form = e.target, f = new FormData(form), file = f.get('file')
    if (!file?.name) return
    const ext = file.name.split('.').pop().toLowerCase(), cat = f.get('category')
    const path = `${cat}/${crypto.randomUUID()}.${ext}`
    setMsg('Uploading…')
    const { error: e1 } = await supabase.storage.from('library').upload(path, file)
    if (e1) return setMsg(e1.message)
    const { error: e2 } = await supabase.from('items').insert({ title: f.get('title'), author: f.get('author'), description: f.get('description'), category: cat, format: ext, file_path: path })
    setMsg(e2 ? e2.message : 'Uploaded')
    if (!e2) { form.reset(); load() }
  }
  const del = async i => {
    if (!confirm(`Delete "${i.title}"?`)) return
    await supabase.storage.from('library').remove([i.file_path])
    await supabase.from('items').delete().eq('id', i.id); load()
  }
  if (!ok) return null
  return (
    <div className="space-y-6 pt-6">
      <form onSubmit={up} className="card space-y-3">
        <h1 className="text-2xl font-bold">Upload a file</h1>
        <input name="title" className="input" placeholder="Title" required />
        <input name="author" className="input" placeholder="Author" />
        <textarea name="description" className="input" placeholder="Description" />
        <select name="category" className="input">
          <option value="novel">Novel</option><option value="manga">Manga</option>
          <option value="paper">Academic paper</option><option value="book">Book</option>
        </select>
        <input name="file" type="file" accept=".pdf,.epub,.cbz" required />
        <button className="btn">Upload</button>
        <p className="text-sm">{msg}</p>
      </form>
      {items.map(i => (
        <div key={i.id} className="card flex items-center justify-between">
          <span>{i.title} <small className="opacity-60">({i.format})</small></span>
          <button onClick={() => del(i)} className="text-red-500">Delete</button>
        </div>
      ))}
    </div>
  )
}
