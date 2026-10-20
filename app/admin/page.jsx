'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
const cover = p => p ? supabase.storage.from('covers').getPublicUrl(p).data.publicUrl : null
const shrink = file => new Promise(res => {
  const img = new Image()
  img.onload = () => {
    const k = Math.min(1, 600 / Math.max(img.width, img.height)), c = document.createElement('canvas')
    c.width = img.width * k; c.height = img.height * k
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    c.toBlob(b => res(b), 'image/jpeg', 0.8)
  }
  img.src = URL.createObjectURL(file)
})
const putCover = async file => {
  const blob = await shrink(file), path = `${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('covers').upload(path, blob, { contentType: 'image/jpeg' })
  return error ? { error } : { path }
}
export default function Admin() {
  const [ok, setOk] = useState(false), [items, setItems] = useState([]), [stats, setStats] = useState({}), [members, setMembers] = useState({ count: 0, rows: [] }), [msg, setMsg] = useState(''), router = useRouter()
  const load = () => {
    supabase.from('items').select('*').order('created_at', { ascending: false }).then(({ data }) => setItems(data || []))
    supabase.from('item_stats').select('*').then(({ data }) => setStats(Object.fromEntries((data || []).map(s => [s.item_id, s]))))
    supabase.from('profiles').select('email,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(10).then(({ data, count }) => setMembers({ count: count || 0, rows: data || [] }))
  }
  useEffect(() => { getMe().then(m => { if (!m?.admin) return router.push('/'); setOk(true); load() }) }, [])
  const sum = k => Object.values(stats).reduce((a, s) => a + Number(s[k]), 0)
  const up = async e => {
    e.preventDefault()
    const form = e.target, f = new FormData(form), file = f.get('file'), cf = f.get('cover')
    if (!file?.name) return
    const ext = file.name.split('.').pop().toLowerCase(), cat = f.get('category')
    const path = `${cat}/${crypto.randomUUID()}.${ext}`
    setMsg('Uploading…')
    let cover_path = null
    if (cf?.name) { const r = await putCover(cf); if (r.error) return setMsg(r.error.message); cover_path = r.path }
    const { error: e1 } = await supabase.storage.from('library').upload(path, file)
    if (e1) return setMsg(e1.message)
    const { error: e2 } = await supabase.from('items').insert({ title: f.get('title'), author: f.get('author'), description: f.get('description'), category: cat, format: ext, file_path: path, cover_path })
    setMsg(e2 ? e2.message : 'Uploaded')
    if (!e2) { form.reset(); load() }
  }
  const setCover = async (i, file) => {
    if (!file) return
    setMsg('Uploading cover…')
    const r = await putCover(file)
    if (r.error) return setMsg(r.error.message)
    if (i.cover_path) await supabase.storage.from('covers').remove([i.cover_path])
    await supabase.from('items').update({ cover_path: r.path }).eq('id', i.id)
    setMsg('Cover updated'); load()
  }
  const del = async i => {
    if (!confirm(`Delete "${i.title}"?`)) return
    await supabase.storage.from('library').remove([i.file_path])
    if (i.cover_path) await supabase.storage.from('covers').remove([i.cover_path])
    await supabase.from('items').delete().eq('id', i.id); load()
  }
  if (!ok) return null
  return (
    <div className="space-y-6 pt-6">
      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div className="card"><div className="text-3xl font-bold">{members.count}</div>members</div>
        <div className="card"><div className="text-3xl font-bold">{sum('reads')}</div>reads</div>
        <div className="card"><div className="text-3xl font-bold">{sum('downloads')}</div>downloads</div>
        <div className="card"><div className="text-3xl font-bold">{items.length}</div>files</div>
      </div>
      <div className="card space-y-1">
        <h2 className="text-lg font-bold">Recent signups</h2>
        {members.rows.map(m => (
          <div key={m.email} className="flex justify-between text-sm"><span>{m.email}</span><span className="opacity-60">{new Date(m.created_at).toLocaleDateString()}</span></div>
        ))}
      </div>
      <form onSubmit={up} className="card space-y-3">
        <h1 className="text-2xl font-bold">Upload a file</h1>
        <input name="title" className="input" placeholder="Title" required />
        <input name="author" className="input" placeholder="Author" />
        <textarea name="description" className="input" placeholder="Description" />
        <select name="category" className="input">
          <option value="novel">Novel</option><option value="manga">Manga</option>
          <option value="paper">Academic paper</option><option value="book">Book</option>
        </select>
        <label className="block text-sm">🖼 Cover image (optional)
          <input name="cover" type="file" accept="image/*" className="mt-1 block" />
        </label>
        <label className="block text-sm">📄 Book file (PDF, EPUB or CBZ)
          <input name="file" type="file" accept=".pdf,.epub,.cbz" required className="mt-1 block" />
        </label>
        <button className="btn">Upload</button>
        <p className="text-sm">{msg}</p>
      </form>
      {items.map(i => (
        <div key={i.id} className="card flex items-center gap-3">
          {cover(i.cover_path)
            ? <img src={cover(i.cover_path)} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
            : <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-indigo-100 dark:bg-slate-800">📖</div>}
          <span className="min-w-0 flex-1">{i.title} <small className="opacity-60">({i.format}) · 👁 {stats[i.id]?.reads ?? 0} · ⬇ {stats[i.id]?.downloads ?? 0}</small></span>
          <label className="cursor-pointer text-sm underline">Cover
            <input type="file" accept="image/*" hidden onChange={e => setCover(i, e.target.files[0])} />
          </label>
          <button onClick={() => del(i)} className="text-red-500">Delete</button>
        </div>
      ))}
    </div>
  )
}
