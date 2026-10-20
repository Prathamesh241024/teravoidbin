'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
import Avatar from '@/components/Avatar'

export default function Chat({ params }) {
  const fid = params.id
  const [me, setMe] = useState(null), [friend, setFriend] = useState(null), [msgs, setMsgs] = useState([]), [text, setText] = useState(''), [err, setErr] = useState('')
  const [wall, setWall] = useState(''), [dim, setDim] = useState(0.45), [panel, setPanel] = useState(false)
  const end = useRef(), router = useRouter()

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem('wall:' + fid) || '{}'); setWall(s.wall || ''); if (s.dim != null) setDim(s.dim) } catch {}
  }, [fid])
  const saveWall = (w, d) => {
    setWall(w); setDim(d)
    try { localStorage.setItem('wall:' + fid, JSON.stringify({ wall: w, dim: d })) } catch { alert('That photo is too big to save') }
  }
  const pick = file => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement('canvas')
      c.width = img.width * k; c.height = img.height * k
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      saveWall(c.toDataURL('image/jpeg', 0.7), dim)
    }
    img.src = URL.createObjectURL(file)
  }

  const markRead = uid => supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('receiver', uid).eq('sender', fid).is('read_at', null).then(() => {})

  useEffect(() => {
    let ch
    ;(async () => {
      const m = await getMe(); if (!m) return router.push('/login')
      setMe(m)
      const { data: p } = await supabase.from('public_profiles').select('*').eq('id', fid).single()
      setFriend(p)
      const { data } = await supabase.from('messages').select('*')
        .or(`and(sender.eq.${m.user.id},receiver.eq.${fid}),and(sender.eq.${fid},receiver.eq.${m.user.id})`)
        .order('created_at', { ascending: true }).limit(300)
      setMsgs(data || [])
      markRead(m.user.id)
      ch = supabase.channel('chat-' + m.user.id + '-' + fid)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: n }) => {
          if (!((n.sender === fid && n.receiver === m.user.id) || (n.sender === m.user.id && n.receiver === fid))) return
          setMsgs(cur => (cur.some(x => x.id === n.id) ? cur : [...cur, n]))
          if (n.sender === fid) markRead(m.user.id)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, ({ new: n }) => {
          setMsgs(cur => cur.map(x => (x.id === n.id ? n : x)))
        })
        .subscribe()
    })()
    return () => { if (ch) supabase.removeChannel(ch) }
  }, [fid])

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const send = async e => {
    e.preventDefault()
    const body = text.trim(); if (!body) return
    setText('')
    const { data, error } = await supabase.from('messages').insert({ receiver: fid, body }).select().single()
    if (error) { setText(body); return setErr('Could not send. You can only chat with friends.') }
    setErr(''); setMsgs(cur => (cur.some(x => x.id === data.id) ? cur : [...cur, data]))
  }

  if (!me) return null
  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: wall ? `url("${wall}") center/cover` : '#0b0b1a' }}>
      {wall && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${dim})` }} />}
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center gap-3 bg-black/60 p-3 text-white backdrop-blur" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <Link href="/chats" className="btn">←</Link>
          <Link href={`/u/${fid}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar path={friend?.avatar_path} name={friend?.username} />
            <b className="truncate">{friend?.username || 'Reader'}</b>
          </Link>
          <button className="btn" onClick={() => setPanel(!panel)}>🖼</button>
        </div>
        {panel && (
          <div className="space-y-2 bg-slate-900/95 p-3 text-sm text-white">
            <label className="btn block text-center">🖼 Choose wallpaper
              <input type="file" accept="image/*" hidden onChange={e => e.target.files[0] && pick(e.target.files[0])} />
            </label>
            {wall && <button className="underline" onClick={() => saveWall('', dim)}>Remove wallpaper</button>}
            <label className="block">Darkness {Math.round(dim * 100)}%
              <input type="range" min="0" max="0.9" step="0.05" value={dim} onChange={e => saveWall(wall, +e.target.value)} className="w-full" />
            </label>
          </div>
        )}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {msgs.map(m => {
            const mine = m.sender === me.user.id
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] break-words rounded-2xl px-3 py-2 text-sm text-white ${mine ? 'bg-indigo-700' : 'bg-slate-700'}`}>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className="mt-1 text-right text-[10px] opacity-70">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{mine && (m.read_at ? ' ✓✓' : ' ✓')}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={end} />
        </div>
        {err && <p className="bg-black/60 px-3 pt-2 text-sm text-red-400">{err}</p>}
        <form onSubmit={send} className="flex gap-2 bg-black/60 p-3 backdrop-blur" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <input className="input" placeholder="Message…" maxLength={2000} value={text} onChange={e => setText(e.target.value)} />
          <button className="btn">Send</button>
        </form>
      </div>
    </div>
  )
}
