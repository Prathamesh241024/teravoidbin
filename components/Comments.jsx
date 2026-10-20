'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, getMe } from '@/lib/supabase'
import Avatar from '@/components/Avatar'
export default function Comments({ itemId }) {
  const [me, setMe] = useState(null), [list, setList] = useState([]), [people, setPeople] = useState({}), [text, setText] = useState(''), [msg, setMsg] = useState('')
  const load = async () => {
    const { data } = await supabase.from('comments').select('*').eq('item_id', itemId).order('created_at', { ascending: false }).limit(100)
    setList(data || [])
    const ids = [...new Set((data || []).map(c => c.user_id))]
    if (ids.length) {
      const { data: p } = await supabase.from('public_profiles').select('*').in('id', ids)
      setPeople(Object.fromEntries((p || []).map(x => [x.id, x])))
    }
  }
  useEffect(() => { getMe().then(setMe); load() }, [itemId])
  const send = async e => {
    e.preventDefault()
    if (!text.trim()) return
    const { error } = await supabase.from('comments').insert({ item_id: itemId, body: text.trim() })
    if (error) return setMsg(error.message)
    setText(''); setMsg(''); load()
  }
  const del = async id => { await supabase.from('comments').delete().eq('id', id); load() }
  if (!me) return <p className="card text-sm">Log in to read and write comments.</p>
  return (
    <div id="comments" className="space-y-4">
      <form onSubmit={send} className="card space-y-2">
        <textarea className="input" rows={3} maxLength={1000} placeholder="Write a comment…" value={text} onChange={e => setText(e.target.value)} />
        <div className="flex items-center justify-between">
          <Link href="/profile" className="text-sm underline">Set your name & photo</Link>
          <button className="btn">Post</button>
        </div>
        {msg && <p className="text-sm text-red-500">{msg}</p>}
      </form>
      {list.map(c => {
        const p = people[c.user_id]
        return (
          <div key={c.id} className="card flex gap-3">
            <Avatar path={p?.avatar_path} name={p?.username} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-sm"><b>{p?.username || 'Reader'}</b><span className="opacity-60">{new Date(c.created_at).toLocaleString()}</span></div>
              <p className="whitespace-pre-wrap break-words">{c.body}</p>
              {(me.user.id === c.user_id || me.admin) && <button className="text-sm text-red-500" onClick={() => del(c.id)}>Delete</button>}
            </div>
          </div>
        )
      })}
      {!list.length && <p className="text-sm opacity-60">No comments yet. Be the first.</p>}
    </div>
  )
}
