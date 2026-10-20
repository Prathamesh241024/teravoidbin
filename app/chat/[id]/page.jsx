'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
export default function Chat({ params }) {
  const fid = params.id
  const [me, setMe] = useState(null), [friend, setFriend] = useState(null), [msgs, setMsgs] = useState([]), [text, setText] = useState(''), [err, setErr] = useState(''), end = useRef(), router = useRouter()
  useEffect(() => {
    let ch
    ;(async () => {
      const m = await getMe(); if (!m) return router.push('/login')
      setMe(m)
      const { data: p } = await supabase.from('public_profiles').select('*').eq('id', fid).single()
      setFriend(p)
      const { data } = await supabase.from('messages').select('*')
        .or(`and(sender.eq.${m.user.id},receiver.eq.${fid}),and(sender.eq.${fid},receiver.eq.${m.user.id})`)
        .order('created_at', { ascending: true }).limit(200)
      setMsgs(data || [])
      ch = supabase.channel('chat-' + m.user.id + '-' + fid)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: n }) => {
          if ((n.sender === fid && n.receiver === m.user.id) || (n.sender === m.user.id && n.receiver === fid))
            setMsgs(cur => (cur.some(x => x.id === n.id) ? cur : [...cur, n]))
        }).subscribe()
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
    <div className="flex h-[calc(100dvh-8rem)] flex-col pt-4">
      <div className="flex items-center gap-3 pb-3">
        <Link href="/friends" className="btn">←</Link>
        <Avatar path={friend?.avatar_path} name={friend?.username} />
        <b className="truncate">{friend?.username || 'Reader'}</b>
      </div>
      <div className="card flex-1 space-y-2 overflow-y-auto">
        {msgs.map(m => {
          const mine = m.sender === me.user.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] break-words rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-900 dark:bg-slate-800 dark:text-slate-100'}`}>{m.body}</div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      {err && <p className="pt-2 text-sm text-red-500">{err}</p>}
      <form onSubmit={send} className="flex gap-2 pt-3">
        <input className="input" placeholder="Message…" maxLength={2000} value={text} onChange={e => setText(e.target.value)} />
        <button className="btn">Send</button>
      </form>
    </div>
  )
}
