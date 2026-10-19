'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase, getMe, download } from '@/lib/supabase'
const CATS = [['all', '📚 All'], ['paper', '🧬 Papers'], ['novel', '📖 Novels'], ['manga', '🎌 Manga'], ['book', '📕 Books']]
export default function Home() {
  const [q, setQ] = useState(''), [cat, setCat] = useState('all'), [items, setItems] = useState([]), [me, setMe] = useState(null)
  useEffect(() => { getMe().then(setMe) }, [])
  useEffect(() => {
    let r = supabase.from('items').select('*').order('created_at', { ascending: false }).limit(60)
    if (cat !== 'all') r = r.eq('category', cat)
    const t = q.trim().replace(/[,()%]/g, ' ')
    if (t) r = r.or(`title.ilike.%${t}%,author.ilike.%${t}%`)
    r.then(({ data }) => setItems(data || []))
  }, [q, cat])
  return (
    <div className="space-y-6 pt-6">
      <input className="input" placeholder="Search title or author…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto">
        {CATS.map(([k, l]) => (
          <button key={k} onClick={() => setCat(k)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${cat === k ? 'bg-indigo-700 text-white' : 'bg-white dark:bg-slate-800'}`}>{l}</button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map(i => (
          <div key={i.id} className="card">
            <span className="text-sm text-indigo-600 dark:text-indigo-300">{i.category} · {i.format}</span>
            <h3 className="text-lg font-bold">{i.title}</h3>
            <p className="text-sm opacity-70">{i.author}</p>
            <p className="mt-1 line-clamp-2 text-sm">{i.description}</p>
            <div className="mt-3 flex gap-2">
              {me ? <><Link className="btn" href={`/read/${i.id}`}>Read</Link><button className="btn" onClick={() => download(i)}>Download</button></>
                  : <Link className="btn" href="/login">Sign up to read</Link>}
            </div>
          </div>
        ))}
        {!items.length && <p className="opacity-60">Nothing here yet.</p>}
      </div>
    </div>
  )
}
