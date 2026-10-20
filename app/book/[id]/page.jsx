'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase, getMe, download } from '@/lib/supabase'
import Comments from '@/components/Comments'
const cover = p => p ? supabase.storage.from('covers').getPublicUrl(p).data.publicUrl : null
export default function Book({ params }) {
  const [item, setItem] = useState(null), [me, setMe] = useState(null)
  useEffect(() => {
    getMe().then(setMe)
    supabase.from('items').select('*').eq('id', params.id).single().then(({ data }) => setItem(data))
  }, [params.id])
  if (!item) return <p className="pt-8">Loading…</p>
  return (
    <div className="space-y-6 pt-6">
      <div className="card flex gap-4">
        {cover(item.cover_path)
          ? <img src={cover(item.cover_path)} alt="" className="h-48 w-32 shrink-0 rounded-lg object-cover" />
          : <div className="flex h-48 w-32 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-4xl dark:bg-slate-800">📖</div>}
        <div className="min-w-0 flex-1 space-y-2">
          <span className="text-sm text-indigo-600 dark:text-indigo-300">{item.category} · {item.format}</span>
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <p className="text-sm opacity-70">{item.author}</p>
          <p className="text-sm">{item.description}</p>
          <div className="flex gap-2">
            {me ? <><Link className="btn" href={`/read/${item.id}`}>Read</Link><button className="btn" onClick={() => download(item)}>Download</button></>
                : <Link className="btn" href="/login">Sign up to read</Link>}
          </div>
        </div>
      </div>
      <h2 className="text-xl font-bold">💬 Comments</h2>
      <Comments itemId={item.id} />
    </div>
  )
}
