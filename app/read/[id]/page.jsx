'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe, download } from '@/lib/supabase'
export default function Read({ params }) {
  const [item, setItem] = useState(null), [url, setUrl] = useState(''), box = useRef(), rend = useRef(), router = useRouter()
  useEffect(() => {
    (async () => {
      if (!(await getMe())) return router.push('/login')
      const { data: it } = await supabase.from('items').select('*').eq('id', params.id).single()
      if (!it) return router.push('/')
      setItem(it)
      const { data: s } = await supabase.storage.from('library').createSignedUrl(it.file_path, 3600)
      setUrl(s.signedUrl)
      if (it.format === 'epub') {
        const ePub = (await import('epubjs')).default
        const buf = await (await fetch(s.signedUrl)).arrayBuffer()
        rend.current = ePub(buf).renderTo(box.current, { width: '100%', height: '75vh' })
        rend.current.display()
      }
    })()
  }, [params.id])
  if (!item) return <p className="pt-8">Loading…</p>
  return (
    <div className="space-y-3 pt-6">
      <h1 className="text-2xl font-bold">{item.title}</h1>
      <div className="flex gap-2">
        <button className="btn" onClick={() => download(item)}>Download</button>
        {item.format === 'pdf' && url && <a className="btn" href={url} target="_blank">Open full screen</a>}
      </div>
      {item.format === 'epub' ? (
        <>
          <div ref={box} className="rounded-xl bg-white text-black" />
          <div className="flex gap-2">
            <button className="btn" onClick={() => rend.current?.prev()}>← Previous</button>
            <button className="btn" onClick={() => rend.current?.next()}>Next →</button>
          </div>
        </>
      ) : item.format === 'pdf' && url ? (
        <iframe src={url} className="h-[80vh] w-full rounded-xl bg-white" />
      ) : <p>Preview isn't available for .{item.format} files. Use Download.</p>}
    </div>
  )
}
