'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, getMe } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
export default function Chats() {
  const [me, setMe] = useState(null), [rows, setRows] = useState([]), [people, setPeople] = useState({}), [loaded, setLoaded] = useState(false), router = useRouter()
  const load = async uid => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(300)
    const map = {}
    for (const m of data || []) {
      const other = m.sender === uid ? m.receiver : m.sender
      map[other] ||= { id: other, last: m, unread: 0 }
      if (m.receiver === uid && !m.read_at) map[other].unread++
    }
    const list = Object.values(map)
    setRows(list)
    if (list.length) {
      const { data: p } = await supabase.from('public_profiles').select('*').in('id', list.map(r => r.id))
      setPeople(Object.fromEntries((p || []).map(x => [x.id, x])))
    }
    setLoaded(true)
  }
  useEffect(() => {
    let ch
    getMe().then(m => {
      if (!m) return router.push('/login')
      setMe(m); load(m.user.id)
      ch = supabase.channel('inbox-' + m.user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load(m.user.id)).subscribe()
    })
    return () => { if (ch) supabase.removeChannel(ch) }
  }, [])
  if (!me) return null
  return (
    <div className="space-y-3 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">💬 Messages</h1>
        <Link href="/friends" className="btn">👥 Friends</Link>
      </div>
      {rows.map(r => {
        const p = people[r.id]
        return (
          <Link key={r.id} href={`/chat/${r.id}`} className="card flex items-center gap-3">
            <Avatar path={p?.avatar_path} name={p?.username} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <b className="truncate">{p?.username || 'Reader'}</b>
                <span className="text-xs opacity-60">{new Date(r.last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="truncate text-sm opacity-70">{r.last.sender === me.user.id ? 'You: ' : ''}{r.last.body}</p>
            </div>
            {r.unread > 0 && <span className="rounded-full bg-indigo-700 px-2 py-0.5 text-xs font-bold text-white">{r.unread}</span>}
          </Link>
        )
      })}
      {loaded && !rows.length && <p className="text-sm opacity-60">No chats yet. Open Friends, tap a friend and start one.</p>}
    </div>
  )
}
